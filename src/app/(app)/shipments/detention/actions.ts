"use server"

import { revalidatePath } from "next/cache"

import { requireRole } from "@/lib/auth-utils"
import { formatDate } from "@/lib/format"
import { prisma } from "@/lib/prisma"

const FREE_TIME_DAYS = 30

function revalidateDetentionPaths(shipmentId: string) {
  revalidatePath("/shipments/detention")
  revalidatePath(`/shipments/${shipmentId}`)
  revalidatePath("/shipments")
  revalidatePath("/dashboard")
}

export async function startDetentionClock(containerId: string) {
  const session = await requireRole(["ADMIN", "LOGISTICS_OPERATOR"])

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

  revalidateDetentionPaths(container.shipmentId)
}
