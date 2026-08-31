"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { logShipmentAudit } from "@/lib/audit"
import { requireRole } from "@/lib/auth-utils"
import { formatDateTime } from "@/lib/format"
import { prisma } from "@/lib/prisma"
import { SHIPMENT_STATUS_ORDER } from "@/lib/shipment-labels"

const scheduleSchema = z.object({
  containerId: z.string().min(1),
  offloadScheduledAt: z.string().min(1, "Scheduled date/time is required"),
})

function revalidateOffloadPaths(shipmentId: string) {
  revalidatePath("/shipments/offload")
  revalidatePath(`/shipments/${shipmentId}`)
  revalidatePath("/shipments")
  revalidatePath("/shipments/tracking")
  revalidatePath("/dashboard")
}

export async function scheduleContainerOffload(input: {
  containerId: string
  offloadScheduledAt: string
}) {
  const session = await requireRole(["ADMIN", "LOGISTICS_OPERATOR"])
  const parsed = scheduleSchema.parse(input)

  const container = await prisma.container.update({
    where: { id: parsed.containerId },
    data: { offloadScheduledAt: new Date(parsed.offloadScheduledAt) },
    select: { shipmentId: true, containerNumber: true },
  })

  await logShipmentAudit({
    shipmentId: container.shipmentId,
    userId: session.user.id,
    action: "OFFLOAD_SCHEDULED",
    newValue: {
      containerNumber: container.containerNumber,
      offloadScheduledAt: formatDateTime(new Date(parsed.offloadScheduledAt)),
    },
  })

  revalidateOffloadPaths(container.shipmentId)
}

export async function confirmContainerOffload(containerId: string) {
  const session = await requireRole(["ADMIN", "LOGISTICS_OPERATOR"])

  const container = await prisma.container.findUnique({
    where: { id: containerId },
  })
  if (!container) {
    throw new Error("Container not found")
  }

  const now = new Date()

  await prisma.$transaction([
    prisma.container.update({
      where: { id: containerId },
      data: {
        status: "OFFLOADED",
        actualOffloadedAt: now,
        offloadScheduledAt: container.offloadScheduledAt ?? now,
      },
    }),
    prisma.shipmentAudit.create({
      data: {
        shipmentId: container.shipmentId,
        userId: session.user.id,
        action: "CONTAINER_OFFLOAD_CONFIRMED",
        newValue: {
          containerNumber: container.containerNumber,
          actualOffloadedAt: formatDateTime(now),
        },
      },
    }),
  ])

  const siblingContainers = await prisma.container.findMany({
    where: { shipmentId: container.shipmentId },
    select: { status: true },
  })
  const allOffloaded = siblingContainers.every(
    (c) => c.status === "OFFLOADED" || c.status === "EMPTY_RETURNED_TO_DEPOT"
  )

  if (allOffloaded) {
    const shipment = await prisma.shipment.findUnique({
      where: { id: container.shipmentId },
      select: { status: true },
    })
    if (
      shipment &&
      SHIPMENT_STATUS_ORDER.indexOf(shipment.status) <
        SHIPMENT_STATUS_ORDER.indexOf("OFFLOADED")
    ) {
      await prisma.shipment.update({
        where: { id: container.shipmentId },
        data: { status: "OFFLOADED" },
      })
    }
  }

  revalidateOffloadPaths(container.shipmentId)
}
