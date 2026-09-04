import { prisma } from "./prisma"

const DETENTION_FREE_TIME_DAYS = 30

// Starts the 30-day detention clock for any container on this shipment
// that doesn't already have one. Called whenever a shipment reaches a
// status where its containers are considered discharged at the seaport
// (see ARRIVED_OR_LATER_STATUSES) -- both from a manual status update and
// from an automatic one.
export async function ensureDetentionTrackers(shipmentId: string) {
  const containers = await prisma.container.findMany({
    where: { shipmentId },
    include: { detentionTracker: true },
  })

  for (const container of containers) {
    if (container.detentionTracker) continue

    const now = new Date()
    const deadlineDate = new Date(
      now.getTime() + DETENTION_FREE_TIME_DAYS * 24 * 60 * 60 * 1000
    )

    await prisma.$transaction([
      prisma.detentionTracker.create({
        data: {
          containerId: container.id,
          freeTimeDays: DETENTION_FREE_TIME_DAYS,
          clockStartDate: now,
          deadlineDate,
        },
      }),
      prisma.container.update({
        where: { id: container.id },
        data: {
          status: container.status === "ON_VESSEL" ? "DISCHARGED_AT_PORT" : undefined,
        },
      }),
    ])
  }
}
