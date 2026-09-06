import { logShipmentAudit } from "@/lib/audit"
import { ensureDetentionTrackers } from "@/lib/detention-trackers"
import {
  describeStageSkipAlert,
  findStageSkipAlert,
} from "@/lib/document-stage-alerts"
import { createNotification } from "@/lib/notifications"
import { prisma } from "@/lib/prisma"
import {
  ARRIVED_OR_LATER_STATUSES,
  SHIPMENT_STATUS_LABELS,
} from "@/lib/shipment-labels"
import { getStage2Gaps, STAGE2_GAP_LABELS } from "@/lib/stage2-readiness"

// Matches the dashboard's "Needs Attention" labels for these same two
// conditions (src/app/(app)/dashboard/page.tsx) -- also doubles as the
// de-dup key below, so don't change one without the other.
const STAGE_SKIP_NOTIFICATION_TITLE = "Out-of-Order Paperwork"
const STAGE2_GAP_NOTIFICATION_TITLE = "Stage 2 Details Needed"

function startOfToday() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

// Once a shipment's ETA has passed while it's still shown as at sea, treat
// it as having reached the discharge port -- there's no separate "vessel
// arrival" signal in this system, so the ETA crossing is the trigger.
async function runEtaArrivalAutoAdvance() {
  const dueShipments = await prisma.shipment.findMany({
    where: {
      status: "IN_TRANSIT_SEA",
      currentEta: { lte: new Date() },
    },
    select: { id: true, blNumber: true, currentEta: true },
  })

  if (dueShipments.length === 0) {
    return { shipmentsAdvanced: 0 }
  }

  // Arriving means Stage 2 (Discharge Port Customs) needs attention right
  // away -- clearing agent, customs declaration, transit details -- so the
  // people who manage that get told as soon as the cron makes the change.
  const clearanceUsers = await prisma.user.findMany({
    where: { isActive: true, role: { in: ["ADMIN", "LOGISTICS_OPERATOR"] } },
    select: { id: true },
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

    for (const user of clearanceUsers) {
      await createNotification({
        userId: user.id,
        shipmentId: shipment.id,
        title: "Arrived at Port of Discharge",
        message: `Shipment ${shipment.blNumber} has arrived at the discharge port. Add the Stage 2 clearing agent, transit details, and customs declaration.`,
      })
    }
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

// Pushes the dashboard's "Out-of-Order Paperwork" alert (later-stage
// documents uploaded while an earlier stage is still incomplete) to ops
// instead of leaving it something someone only sees by opening the
// dashboard. At most one notification per shipment per day -- the
// condition can persist for a while, so this acts as a daily reminder
// until it's resolved, not a one-time ping.
async function runStageSkipAlertNotifications() {
  const shipments = await prisma.shipment.findMany({
    where: { status: { not: "COMPLETED" } },
    select: {
      id: true,
      blNumber: true,
      documents: { select: { stage: true, type: true, isVerified: true } },
      transitRateSheet: { select: { finalizedAt: true } },
    },
  })

  const alerts = shipments
    .map((s) => {
      const alert = findStageSkipAlert(s.documents, {
        rateSheetFinalized: s.transitRateSheet?.finalizedAt != null,
      })
      return alert ? { id: s.id, blNumber: s.blNumber, alert } : null
    })
    .filter((a): a is NonNullable<typeof a> => a !== null)

  if (alerts.length === 0) {
    return { shipmentsNotified: 0, messagesSent: 0 }
  }

  const opsUsers = await prisma.user.findMany({
    where: { isActive: true, role: { in: ["ADMIN", "LOGISTICS_OPERATOR"] } },
    select: { id: true },
  })

  const dayStart = startOfToday()
  let messagesSent = 0
  let shipmentsNotified = 0

  for (const { id, blNumber, alert } of alerts) {
    const alreadySentToday = await prisma.notification.findFirst({
      where: {
        shipmentId: id,
        title: STAGE_SKIP_NOTIFICATION_TITLE,
        createdAt: { gte: dayStart },
      },
      select: { id: true },
    })
    if (alreadySentToday) continue

    for (const user of opsUsers) {
      await createNotification({
        userId: user.id,
        shipmentId: id,
        title: STAGE_SKIP_NOTIFICATION_TITLE,
        message: `${blNumber}: ${describeStageSkipAlert(alert)}`,
      })
      messagesSent++
    }
    shipmentsNotified++
  }

  return { shipmentsNotified, messagesSent }
}

// Pushes the dashboard's "Stage 2 Details Needed" alert (shipments arrived
// at the discharge port still missing a clearing agent, customs
// declaration, or container transit details) the same way -- at most one
// notification per shipment per day.
async function runStage2GapNotifications() {
  const arrivedShipments = await prisma.shipment.findMany({
    where: { status: "ARRIVED_PORT_OF_DISCHARGE" },
    select: {
      id: true,
      blNumber: true,
      stageAgents: { where: { stage: "PORT_CLEARANCE" }, select: { id: true } },
      documents: { where: { stage: "PORT_CLEARANCE" }, select: { id: true } },
      containers: { select: { transitDetails: { select: { id: true } } } },
    },
  })

  const gapsByShipment = arrivedShipments
    .map((s) => ({
      id: s.id,
      blNumber: s.blNumber,
      gaps: getStage2Gaps({
        hasAgent: s.stageAgents.length > 0,
        hasCustomsDocument: s.documents.length > 0,
        allContainersHaveTransitDetails: s.containers.every(
          (c) => c.transitDetails !== null
        ),
      }),
    }))
    .filter((s) => s.gaps.length > 0)

  if (gapsByShipment.length === 0) {
    return { shipmentsNotified: 0, messagesSent: 0 }
  }

  const opsUsers = await prisma.user.findMany({
    where: { isActive: true, role: { in: ["ADMIN", "LOGISTICS_OPERATOR"] } },
    select: { id: true },
  })

  const dayStart = startOfToday()
  let messagesSent = 0
  let shipmentsNotified = 0

  for (const { id, blNumber, gaps } of gapsByShipment) {
    const alreadySentToday = await prisma.notification.findFirst({
      where: {
        shipmentId: id,
        title: STAGE2_GAP_NOTIFICATION_TITLE,
        createdAt: { gte: dayStart },
      },
      select: { id: true },
    })
    if (alreadySentToday) continue

    const gapLabels = gaps.map((g) => STAGE2_GAP_LABELS[g]).join(", ")
    for (const user of opsUsers) {
      await createNotification({
        userId: user.id,
        shipmentId: id,
        title: STAGE2_GAP_NOTIFICATION_TITLE,
        message: `${blNumber} arrived at the discharge port but is still missing: ${gapLabels}.`,
      })
      messagesSent++
    }
    shipmentsNotified++
  }

  return { shipmentsNotified, messagesSent }
}

export async function runDailyChecks() {
  // Runs first so a shipment whose ETA has just passed is no longer
  // considered "at sea" by the time the 7-day broadcast below queries for it.
  const etaArrivalAutoAdvance = await runEtaArrivalAutoAdvance()
  const sevenDayBroadcast = await runSevenDayBroadcast()
  const detentionEscalations = await runDetentionEscalations()
  const stageSkipAlerts = await runStageSkipAlertNotifications()
  const stage2GapAlerts = await runStage2GapNotifications()

  return {
    etaArrivalAutoAdvance,
    sevenDayBroadcast,
    detentionEscalations,
    stageSkipAlerts,
    stage2GapAlerts,
  }
}
