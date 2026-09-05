import { DocumentStage, ShipmentStatus } from "@prisma/client"

import { logShipmentAudit } from "./audit"
import { syncContainerStatusToShipment } from "./container-status-sync"
import { ensureDetentionTrackers } from "./detention-trackers"
import { DOCUMENT_STAGE_LABELS } from "./document-labels"
import { isStageComplete } from "./document-stage-alerts"
import { prisma } from "./prisma"
import {
  ARRIVED_OR_LATER_STATUSES,
  SHIPMENT_STATUS_LABELS,
  SHIPMENT_STATUS_ORDER,
} from "./shipment-labels"

// The status each stage's document set corresponds to once fully verified.
// Chronological (matches SHIPMENT_STATUS_ORDER / DocumentStage enum order).
const STAGE_STATUS_MAP: Record<DocumentStage, ShipmentStatus> = {
  ENTRY_LEVEL: "IN_TRANSIT_SEA",
  PORT_CLEARANCE: "CUSTOMS_CLEARED",
  ROAD_TRANSIT: "LOADED_ROAD_TRANSIT",
  FINAL_CLEARANCE: "OFFLOADED",
}

const STAGE_ORDER: DocumentStage[] = [
  "ENTRY_LEVEL",
  "PORT_CLEARANCE",
  "ROAD_TRANSIT",
  "FINAL_CLEARANCE",
]

function statusIndex(status: ShipmentStatus) {
  return SHIPMENT_STATUS_ORDER.indexOf(status)
}

/**
 * Call after a document is verified. Recomputes which stages are now fully
 * verified across the whole shipment (not just the one that triggered
 * this), maps each complete stage to its corresponding status, and moves
 * the shipment to the furthest one reached -- even if earlier stages are
 * still incomplete, so paperwork completed out of order still advances
 * status to match. The one rule that's still enforced: status only ever
 * moves forward (by SHIPMENT_STATUS_ORDER), never backward, so it can't
 * regress if a later document is later deleted or unverified.
 *
 * Returns the new status if one was applied, otherwise null.
 */
export async function maybeAutoAdvanceStatus({
  shipmentId,
  userId,
}: {
  shipmentId: string
  userId: string
}): Promise<ShipmentStatus | null> {
  const [shipment, docs] = await Promise.all([
    prisma.shipment.findUnique({
      where: { id: shipmentId },
      select: { status: true },
    }),
    prisma.document.findMany({
      where: { shipmentId, stage: { not: null } },
      select: { stage: true, type: true, isVerified: true },
    }),
  ])
  if (!shipment) return null

  const structuredDocs = docs.filter(
    (d): d is { stage: DocumentStage; type: NonNullable<typeof d.type>; isVerified: boolean } =>
      d.stage !== null && d.type !== null
  )

  let furthestEligible: ShipmentStatus | null = null
  for (const stage of STAGE_ORDER) {
    if (!isStageComplete(stage, structuredDocs)) continue

    const target = STAGE_STATUS_MAP[stage]
    if (!furthestEligible || statusIndex(target) > statusIndex(furthestEligible)) {
      furthestEligible = target
    }
  }

  if (!furthestEligible || statusIndex(furthestEligible) <= statusIndex(shipment.status)) {
    return null
  }

  const extra: { transitStartedAt?: Date; isLoadedOnTruck?: boolean } = {}
  if (furthestEligible === "LOADED_ROAD_TRANSIT") {
    // Each container now has its own transit details -- use the earliest
    // recorded journey start across the shipment's containers, since that's
    // when the shipment's road leg actually began.
    const containers = await prisma.container.findMany({
      where: { shipmentId },
      select: { transitDetails: { select: { journeyStartDate: true } } },
    })
    const journeyStartDates = containers
      .map((c) => c.transitDetails?.journeyStartDate)
      .filter((d): d is Date => d != null)
    extra.transitStartedAt =
      journeyStartDates.length > 0
        ? new Date(Math.min(...journeyStartDates.map((d) => d.getTime())))
        : new Date()
    extra.isLoadedOnTruck = true
  }

  await prisma.shipment.update({
    where: { id: shipmentId },
    data: { status: furthestEligible, ...extra },
  })

  await syncContainerStatusToShipment(shipmentId, furthestEligible)

  const triggeringStage = STAGE_ORDER.find(
    (stage) => STAGE_STATUS_MAP[stage] === furthestEligible
  )

  await logShipmentAudit({
    shipmentId,
    userId,
    action: "STATUS_AUTO_UPDATED",
    oldValue: { status: SHIPMENT_STATUS_LABELS[shipment.status] },
    newValue: {
      status: SHIPMENT_STATUS_LABELS[furthestEligible],
      stageLabel: triggeringStage
        ? DOCUMENT_STAGE_LABELS[triggeringStage]
        : undefined,
    },
  })

  if (ARRIVED_OR_LATER_STATUSES.includes(furthestEligible)) {
    await ensureDetentionTrackers(shipmentId)
  }

  return furthestEligible
}
