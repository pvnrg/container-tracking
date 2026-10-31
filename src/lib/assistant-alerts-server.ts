import type { Session } from "next-auth"

import {
  AssistantAlert,
  buildDetentionAlert,
  sortAssistantAlerts,
} from "./assistant-alerts"
import { shipmentScopeWhere } from "./data-scope"
import { getDetentionRisk } from "./detention"
import { describeStageSkipAlert, findStageSkipAlert } from "./document-stage-alerts"
import { DOCUMENT_TYPE_LABELS } from "./document-labels"
import { formatDate, formatDateTime } from "./format"
import { prisma } from "./prisma"
import { ARRIVED_OR_LATER_STATUSES } from "./shipment-labels"
import { getStage2Gaps, STAGE2_GAP_LABELS } from "./stage2-readiness"

type AssistantSession = {
  user: Pick<Session["user"], "id" | "role" | "restrictToOwnData">
}

const DAY_MS = 24 * 60 * 60 * 1000
const MAX_DOCUMENT_ALERTS = 5

/**
 * Every alert the floating assistant should show this user right now,
 * most urgent first, minus anything they've snoozed. Recomputed from live
 * data each call (same conditions the dashboard and daily checks use), so
 * an alert disappears on its own as soon as the underlying problem is
 * fixed.
 */
export async function getAssistantAlerts(session: AssistantSession) {
  const alerts =
    session.user.role === "TRANSPORTER"
      ? await getTransporterAlerts(session)
      : await getOpsAlerts(session)

  const snoozes = await prisma.assistantSnooze.findMany({
    where: { userId: session.user.id, until: { gt: new Date() } },
    select: { alertKey: true },
  })
  const snoozedKeys = new Set(snoozes.map((s) => s.alertKey))
  const visible = alerts.filter((a) => !snoozedKeys.has(a.key))

  return {
    alerts: sortAssistantAlerts(visible),
    snoozedCount: alerts.length - visible.length,
  }
}

async function getDetentionAlerts(
  shipmentWhere: object,
  audience: "ops" | "transporter"
) {
  const trackers = await prisma.detentionTracker.findMany({
    where: {
      returnedToDepotDate: null,
      deadlineDate: { not: null },
      container: { shipment: shipmentWhere },
    },
    select: {
      id: true,
      deadlineDate: true,
      containerId: true,
      container: {
        select: {
          containerNumber: true,
          shipment: { select: { id: true, blNumber: true } },
        },
      },
    },
    orderBy: { deadlineDate: "asc" },
  })

  return trackers.flatMap((t) => {
    const alert = buildDetentionAlert(
      {
        trackerId: t.id,
        containerId: t.containerId,
        containerNumber: t.container.containerNumber,
        shipmentId: t.container.shipment.id,
        blNumber: t.container.shipment.blNumber,
        deadlineDate: t.deadlineDate!,
        ...getDetentionRisk(t.deadlineDate!),
      },
      audience
    )
    return alert ? [alert] : []
  })
}

async function getOpsAlerts(session: AssistantSession): Promise<AssistantAlert[]> {
  const scope = shipmentScopeWhere(session)
  const now = new Date()

  const [
    detentionAlerts,
    overdueEtaShipments,
    arrivedAtPort,
    activeForDocCheck,
    awaitingOffload,
    pendingDocuments,
    arrivingSoon,
  ] = await Promise.all([
    getDetentionAlerts(scope, "ops"),
    prisma.shipment.findMany({
      where: {
        currentEta: { lt: now },
        status: { notIn: ARRIVED_OR_LATER_STATUSES },
        ...scope,
      },
      select: { id: true, blNumber: true, currentEta: true, status: true },
      orderBy: { currentEta: "asc" },
    }),
    prisma.shipment.findMany({
      where: { status: "ARRIVED_PORT_OF_DISCHARGE", ...scope },
      select: {
        id: true,
        blNumber: true,
        stageAgents: { where: { stage: "PORT_CLEARANCE" }, select: { id: true } },
        documents: { where: { stage: "PORT_CLEARANCE" }, select: { id: true } },
        containers: { select: { transitDetails: { select: { id: true } } } },
      },
    }),
    prisma.shipment.findMany({
      where: { status: { not: "COMPLETED" }, ...scope },
      select: {
        id: true,
        blNumber: true,
        documents: { select: { stage: true, type: true, isVerified: true } },
        transitRateSheet: { select: { finalizedAt: true } },
      },
    }),
    prisma.container.findMany({
      where: {
        actualOffloadedAt: null,
        shipment: { status: "ARRIVED_DESTINATION", ...scope },
      },
      select: {
        id: true,
        containerNumber: true,
        offloadScheduledAt: true,
        shipment: { select: { id: true, blNumber: true } },
      },
      orderBy: [{ offloadScheduledAt: "asc" }, { createdAt: "asc" }],
    }),
    prisma.document.findMany({
      where: { isVerified: false, shipment: scope },
      select: {
        id: true,
        type: true,
        title: true,
        fileName: true,
        createdAt: true,
        shipment: { select: { id: true, blNumber: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.shipment.count({
      where: {
        currentEta: { gte: now, lte: new Date(now.getTime() + 7 * DAY_MS) },
        status: { notIn: ARRIVED_OR_LATER_STATUSES },
        ...scope,
      },
    }),
  ])

  const alerts: AssistantAlert[] = [...detentionAlerts]

  for (const s of arrivedAtPort) {
    const gaps = getStage2Gaps({
      hasAgent: s.stageAgents.length > 0,
      hasCustomsDocument: s.documents.length > 0,
      allContainersHaveTransitDetails: s.containers.every((c) => c.transitDetails !== null),
    })
    if (gaps.length === 0) continue
    alerts.push({
      key: `stage2:${s.id}`,
      severity: "warning",
      kind: "stage2",
      title: `Stage 2 details missing on ${s.blNumber}`,
      detail: `Arrived at port · missing ${gaps.map((g) => STAGE2_GAP_LABELS[g]).join(", ")}`,
      actionLabel: "Complete Stage 2",
      href: `/shipments/${s.id}`,
      shipmentId: s.id,
    })
  }

  for (const s of activeForDocCheck) {
    const skip = findStageSkipAlert(s.documents, {
      rateSheetFinalized: s.transitRateSheet?.finalizedAt != null,
    })
    if (!skip) continue
    alerts.push({
      key: `paperwork:${s.id}`,
      severity: "warning",
      kind: "paperwork",
      title: `Out-of-order paperwork on ${s.blNumber}`,
      detail: describeStageSkipAlert(skip),
      actionLabel: "Review documents",
      href: `/shipments/${s.id}`,
      shipmentId: s.id,
    })
  }

  for (const s of overdueEtaShipments) {
    alerts.push({
      key: `eta:${s.id}`,
      severity: "warning",
      kind: "eta",
      title: `ETA passed for ${s.blNumber}`,
      detail: `Expected ${formatDate(s.currentEta)} but not marked as arrived`,
      actionLabel: "Update ETA",
      href: "/shipments/tracking",
      shipmentId: s.id,
      quickAction: {
        type: "updateEta",
        shipmentId: s.id,
        status: s.status,
        currentEta: s.currentEta.toISOString(),
      },
    })
  }

  // Offload goes one container at a time per shipment (enforced by
  // confirmContainerOffload), so only the earliest overdue scheduled
  // container gets a "confirm" alert -- confirming any other would fail.
  const confirmableShipments = new Set<string>()
  for (const c of awaitingOffload) {
    if (c.offloadScheduledAt === null) {
      alerts.push({
        key: `offload-schedule:${c.id}`,
        severity: "info",
        kind: "offload",
        title: `Schedule offload for ${c.containerNumber}`,
        detail: `${c.shipment.blNumber} is at the destination warehouse`,
        actionLabel: "Offload page",
        href: "/shipments/offload",
        shipmentId: c.shipment.id,
        quickAction: { type: "scheduleOffload", containerId: c.id },
      })
    } else if (
      c.offloadScheduledAt <= now &&
      !confirmableShipments.has(c.shipment.id)
    ) {
      confirmableShipments.add(c.shipment.id)
      alerts.push({
        key: `offload-confirm:${c.id}`,
        severity: "warning",
        kind: "offload",
        title: `Confirm offload of ${c.containerNumber}`,
        detail: `Was scheduled for ${formatDateTime(c.offloadScheduledAt)} · ${c.shipment.blNumber}`,
        actionLabel: "Offload page",
        href: "/shipments/offload",
        shipmentId: c.shipment.id,
        quickAction: { type: "confirmOffload", containerId: c.id },
      })
    }
  }

  // The oldest few get their own alert with a one-click verify; the rest
  // collapse into a single summary so the panel doesn't turn into a
  // document list.
  for (const d of pendingDocuments.slice(0, MAX_DOCUMENT_ALERTS)) {
    const label = d.type ? DOCUMENT_TYPE_LABELS[d.type] : (d.title ?? d.fileName)
    alerts.push({
      key: `verify:${d.id}`,
      severity: "info",
      kind: "verify",
      title: `Verify ${label} on ${d.shipment.blNumber}`,
      detail: `Uploaded ${formatDate(d.createdAt)} · ${d.fileName}`,
      actionLabel: "Shipment",
      href: `/shipments/${d.shipment.id}`,
      shipmentId: d.shipment.id,
      quickAction: { type: "verifyDocument", documentId: d.id },
    })
  }

  const remainingDocuments = pendingDocuments.length - MAX_DOCUMENT_ALERTS
  if (remainingDocuments > 0) {
    alerts.push({
      key: "verify-documents",
      severity: "info",
      kind: "verify",
      title: `${remainingDocuments} more document${remainingDocuments === 1 ? "" : "s"} waiting for verification`,
      detail: "Uploaded but not yet checked",
      actionLabel: "Verify documents",
      href: "/shipments?status=docs-pending",
    })
  }

  if (arrivingSoon > 0) {
    alerts.push({
      key: "arriving-soon",
      severity: "info",
      kind: "arriving",
      title: `${arrivingSoon} shipment${arrivingSoon === 1 ? "" : "s"} arriving within 7 days`,
      detail: "Get Stage 2 clearing ready before they land",
      actionLabel: "View ETAs",
      href: "/shipments/tracking",
    })
  }

  return alerts
}

// A transporter only sees shipments assigned to them -- the dashboard shows
// company-wide numbers, but the assistant is meant to be their own to-do
// list. They can't change data in the app, so every action is "view".
async function getTransporterAlerts(session: AssistantSession): Promise<AssistantAlert[]> {
  const scope = { transporterId: session.user.id, ...shipmentScopeWhere(session) }
  const now = new Date()

  const [detentionAlerts, readyForPickup, arrivingSoon] = await Promise.all([
    getDetentionAlerts(scope, "transporter"),
    prisma.shipment.findMany({
      where: { status: "CUSTOMS_CLEARED", ...scope },
      select: { id: true, blNumber: true, _count: { select: { containers: true } } },
    }),
    prisma.shipment.findMany({
      where: {
        currentEta: { gte: now, lte: new Date(now.getTime() + 7 * DAY_MS) },
        status: { notIn: ARRIVED_OR_LATER_STATUSES },
        ...scope,
      },
      select: { id: true, blNumber: true, currentEta: true },
      orderBy: { currentEta: "asc" },
    }),
  ])

  const alerts: AssistantAlert[] = [...detentionAlerts]

  for (const s of readyForPickup) {
    const n = s._count.containers
    alerts.push({
      key: `pickup:${s.id}`,
      severity: "warning",
      kind: "pickup",
      title: `${s.blNumber} is ready for loading`,
      detail: `Customs cleared · ${n} container${n === 1 ? "" : "s"} waiting at the port`,
      actionLabel: "View shipment",
      href: `/shipments/${s.id}`,
      shipmentId: s.id,
    })
  }

  for (const s of arrivingSoon) {
    alerts.push({
      key: `arriving:${s.id}`,
      severity: "info",
      kind: "arriving",
      title: `${s.blNumber} arrives at port soon`,
      detail: `Expected ${formatDate(s.currentEta)} · plan trucks for pickup`,
      actionLabel: "View shipment",
      href: `/shipments/${s.id}`,
      shipmentId: s.id,
    })
  }

  return alerts
}
