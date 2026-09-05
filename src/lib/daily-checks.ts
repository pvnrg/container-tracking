import { logShipmentAudit } from "@/lib/audit"
import { ensureDetentionTrackers } from "@/lib/detention-trackers"
import { createNotification } from "@/lib/notifications"
import { prisma } from "@/lib/prisma"
import {
  ARRIVED_OR_LATER_STATUSES,
  SHIPMENT_STATUS_LABELS,
} from "@/lib/shipment-labels"

// Once a shipment's ETA has passed while it's still shown as at sea, treat
// it as having reached the discharge port -- there's no separate "vessel
// arrival" signal in this system, so the ETA crossing is the trigger.
async function runEtaArrivalAutoAdvance() {
  const dueShipments = await prisma.shipment.findMany({
    where: {
      status: "IN_TRANSIT_SEA",
      currentEta: { lte: new Date() },
    },
    select: { id: true, currentEta: true },
  })

  for (const shipment of dueShipments) {
    await prisma.shipment.update({
      where: { id: shipment.id },
      data: {
        status: "ARRIVED_PORT_OF_DISCHARGE",
        actualDischargeDate: shipment.currentEta,
      },
    })

    await logShipmentAudit({
      shipmentId: shipment.id,
      action: "STATUS_AUTO_UPDATED",
      oldValue: { status: SHIPMENT_STATUS_LABELS.IN_TRANSIT_SEA },
      newValue: {
        status: SHIPMENT_STATUS_LABELS.ARRIVED_PORT_OF_DISCHARGE,
        reason: "because its ETA was reached",
      },
    })

    await ensureDetentionTrackers(shipment.id)
  }

  return { shipmentsAdvanced: dueShipments.length }
}

async function runSevenDayBroadcast() {
  const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

  const dueShipments = await prisma.shipment.findMany({
    where: {
      sevenDayAlertSent: false,
      currentEta: { lte: sevenDaysFromNow },
      status: { notIn: ARRIVED_OR_LATER_STATUSES },
    },
    select: { id: true, blNumber: true, currentEta: true },
  })

  if (dueShipments.length === 0) {
    return { shipmentsNotified: 0, messagesSent: 0 }
  }

  const activeUsers = await prisma.user.findMany({
    where: { isActive: true },
    select: { id: true },
  })

  let messagesSent = 0
  for (const shipment of dueShipments) {
    const etaLabel = shipment.currentEta.toLocaleDateString()
    for (const user of activeUsers) {
      await createNotification({
        userId: user.id,
        shipmentId: shipment.id,
        title: "Sea Arrival in 7 Days",
        message: `Shipment ${shipment.blNumber} is expected to arrive at the discharge port around ${etaLabel}.`,
      })
      messagesSent++
    }

    await prisma.shipment.update({
      where: { id: shipment.id },
      data: { sevenDayAlertSent: true },
    })
  }

  return { shipmentsNotified: dueShipments.length, messagesSent }
}

async function runDetentionEscalations() {
  const trackers = await prisma.detentionTracker.findMany({
    where: { returnedToDepotDate: null, clockStartDate: { not: null } },
    include: {
      container: {
        include: {
          shipment: {
            select: { id: true, blNumber: true, transporterId: true },
          },
        },
      },
    },
  })

  const milestones: {
    days: number
    flag: "day15AlertSent" | "day22AlertSent" | "day28AlertSent"
  }[] = [
    { days: 15, flag: "day15AlertSent" },
    { days: 22, flag: "day22AlertSent" },
    { days: 28, flag: "day28AlertSent" },
  ]

  const admins = await prisma.user.findMany({
    where: { role: "ADMIN", isActive: true },
    select: { id: true },
  })

  let messagesSent = 0
  let trackersEscalated = 0

  for (const tracker of trackers) {
    const daysElapsed = Math.floor(
      (Date.now() - tracker.clockStartDate!.getTime()) / (1000 * 60 * 60 * 24)
    )

    for (const milestone of milestones) {
      if (daysElapsed < milestone.days || tracker[milestone.flag]) continue

      const message = `Container ${tracker.container.containerNumber} on shipment ${tracker.container.shipment.blNumber} has been held ${daysElapsed} days (day ${milestone.days} of the 30-day free-time window). Please arrange return to depot.`

      const recipientIds = new Set(admins.map((a) => a.id))
      if (tracker.container.shipment.transporterId) {
        recipientIds.add(tracker.container.shipment.transporterId)
      }

      for (const userId of recipientIds) {
        await createNotification({
          userId,
          shipmentId: tracker.container.shipment.id,
          title: `Detention Day ${milestone.days} Reminder`,
          message,
        })
        messagesSent++
      }

      await prisma.detentionTracker.update({
        where: { id: tracker.id },
        data: { [milestone.flag]: true },
      })
      trackersEscalated++
    }
  }

  return { trackersEscalated, messagesSent }
}

export async function runDailyChecks() {
  // Runs first so a shipment whose ETA has just passed is no longer
  // considered "at sea" by the time the 7-day broadcast below queries for it.
  const etaArrivalAutoAdvance = await runEtaArrivalAutoAdvance()
  const sevenDayBroadcast = await runSevenDayBroadcast()
  const detentionEscalations = await runDetentionEscalations()

  return { etaArrivalAutoAdvance, sevenDayBroadcast, detentionEscalations }
}
