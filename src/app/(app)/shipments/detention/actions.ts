"use server"

import { revalidatePath } from "next/cache"

import { requireRole } from "@/lib/auth-utils"
import { requireContainerAccess } from "@/lib/data-scope"
import { formatDate } from "@/lib/format"
import { prisma } from "@/lib/prisma"
import { SHIPMENT_STATUS_ORDER } from "@/lib/shipment-labels"

const FREE_TIME_DAYS = 30

function revalidateDetentionPaths(shipmentId: string) {
  revalidatePath("/shipments/detention")
  revalidatePath(`/shipments/${shipmentId}`)
  revalidatePath("/shipments")
  revalidatePath("/dashboard")
}

export async function startDetentionClock(containerId: string) {
  const session = await requireRole(["ADMIN", "LOGISTICS_OPERATOR"])
  await requireContainerAccess(session, containerId)

  const container = await prisma.container.findUnique({
    where: { id: containerId },
    include: { detentionTracker: true },
  })
  if (!container) {
    throw new Error("Container not found")
  }
  if (container.detentionTracker) {
    throw new Error("Detention clock has already been started for this container")
  }

  const now = new Date()
  const deadlineDate = new Date(
    now.getTime() + FREE_TIME_DAYS * 24 * 60 * 60 * 1000
  )

  await prisma.$transaction([
    prisma.detentionTracker.create({
      data: {
        containerId,
        freeTimeDays: FREE_TIME_DAYS,
        clockStartDate: now,
        deadlineDate,
      },
    }),
    prisma.container.update({
      where: { id: containerId },
      data: {
        status: container.status === "ON_VESSEL" ? "DISCHARGED_AT_PORT" : undefined,
      },
    }),
    prisma.shipmentAudit.create({
      data: {
        shipmentId: container.shipmentId,
        userId: session.user.id,
        action: "DETENTION_CLOCK_STARTED",
        newValue: {
          containerNumber: container.containerNumber,
          deadlineDate: formatDate(deadlineDate),
        },
      },
    }),
  ])

  revalidateDetentionPaths(container.shipmentId)
}

export async function markContainerReturned(containerId: string) {
  const session = await requireRole(["ADMIN", "LOGISTICS_OPERATOR"])
  await requireContainerAccess(session, containerId)

  const container = await prisma.container.findUnique({
    where: { id: containerId },
    include: { detentionTracker: true },
  })
  if (!container) {
    throw new Error("Container not found")
  }
  if (!container.detentionTracker) {
    throw new Error("Detention clock has not been started for this container")
  }

  const returnedAt = new Date()

  await prisma.$transaction([
    prisma.detentionTracker.update({
      where: { containerId },
      data: { returnedToDepotDate: returnedAt, isOverdue: false },
    }),
    prisma.container.update({
      where: { id: containerId },
      data: { status: "EMPTY_RETURNED_TO_DEPOT" },
    }),
    prisma.shipmentAudit.create({
      data: {
        shipmentId: container.shipmentId,
        userId: session.user.id,
        action: "CONTAINER_RETURNED_TO_DEPOT",
        newValue: {
          containerNumber: container.containerNumber,
          returnedToDepotDate: formatDate(returnedAt),
        },
      },
    }),
  ])

  // Mirrors confirmContainerOffload's all-offloaded check one stage further
  // on -- without this, a shipment whose containers are all back at the
  // depot stays stuck at OFFLOADED forever, and the dashboard's Shipment
  // vs. Container Pipeline "Completed" counts drift apart.
  const siblingContainers = await prisma.container.findMany({
    where: { shipmentId: container.shipmentId },
    select: { status: true },
  })
  const allReturned = siblingContainers.every(
    (c) => c.status === "EMPTY_RETURNED_TO_DEPOT"
  )

  if (allReturned) {
    const shipment = await prisma.shipment.findUnique({
      where: { id: container.shipmentId },
      select: { status: true },
    })
    if (
      shipment &&
      SHIPMENT_STATUS_ORDER.indexOf(shipment.status) <
        SHIPMENT_STATUS_ORDER.indexOf("COMPLETED")
    ) {
      await prisma.shipment.update({
        where: { id: container.shipmentId },
        data: { status: "COMPLETED" },
      })
    }
  }

  revalidateDetentionPaths(container.shipmentId)
}
