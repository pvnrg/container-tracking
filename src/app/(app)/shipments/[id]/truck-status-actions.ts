"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { logShipmentAudit } from "@/lib/audit"
import { requireRole } from "@/lib/auth-utils"
import { formatDateTime } from "@/lib/format"
import { prisma } from "@/lib/prisma"

const addTruckStatusUpdateSchema = z.object({
  containerId: z.string().min(1),
  location: z.string().trim().min(1, "Location is required"),
  timestamp: z.string().min(1, "Timestamp is required"),
  notes: z.string().trim().optional(),
})

export async function addTruckStatusUpdate(input: {
  containerId: string
  location: string
  timestamp: string
  notes?: string
}) {
  const session = await requireRole(["ADMIN", "LOGISTICS_OPERATOR"])
  const parsed = addTruckStatusUpdateSchema.parse(input)

  const container = await prisma.container.findUnique({
    where: { id: parsed.containerId },
    select: { id: true, shipmentId: true, containerNumber: true },
  })
  if (!container) {
    throw new Error("Container not found")
  }

  const timestamp = new Date(parsed.timestamp)
  const notes = parsed.notes?.trim() || null

  await prisma.truckStatusUpdate.create({
    data: {
      containerId: parsed.containerId,
      location: parsed.location,
      timestamp,
      notes,
      createdById: session.user.id,
    },
  })

  await logShipmentAudit({
    shipmentId: container.shipmentId,
    userId: session.user.id,
    action: "TRUCK_STATUS_UPDATE_ADDED",
    newValue: {
      containerNumber: container.containerNumber,
      location: parsed.location,
      timestamp: formatDateTime(timestamp),
      notes: notes ?? undefined,
    },
  })

  revalidatePath(`/shipments/${container.shipmentId}`)
}

export async function deleteTruckStatusUpdate(updateId: string) {
  const session = await requireRole(["ADMIN", "LOGISTICS_OPERATOR"])

  const update = await prisma.truckStatusUpdate.findUnique({
    where: { id: updateId },
    select: {
      location: true,
      timestamp: true,
      container: { select: { shipmentId: true, containerNumber: true } },
    },
  })
  if (!update) {
    throw new Error("Truck status update not found")
  }

  await prisma.truckStatusUpdate.delete({ where: { id: updateId } })

  await logShipmentAudit({
    shipmentId: update.container.shipmentId,
    userId: session.user.id,
    action: "TRUCK_STATUS_UPDATE_DELETED",
    oldValue: {
      containerNumber: update.container.containerNumber,
      location: update.location,
      timestamp: formatDateTime(update.timestamp),
    },
  })

  revalidatePath(`/shipments/${update.container.shipmentId}`)
}
