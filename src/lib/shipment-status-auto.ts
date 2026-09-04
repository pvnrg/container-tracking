import { DocumentStage, ShipmentStatus } from "@prisma/client"

import { logShipmentAudit } from "./audit"
import { ensureDetentionTrackers } from "./detention-trackers"
import { DOCUMENT_STAGE_LABELS } from "./document-labels"
import { isStageComplete } from "./document-stage-alerts"
import { prisma } from "./prisma"
import { ARRIVED_OR_LATER_STATUSES, SHIPMENT_STATUS_LABELS } from "./shipment-labels"

type AutoAdvanceRule = {
  // Status the shipment must currently be in for this stage's completion
  // to count as "the next real-world step" -- if the shipment is anywhere
  // else (earlier or already past), we don't touch status. Paperwork
  // clearing out of order relative to the shipment's real progress is
  // exactly what the Document Stage Alerts feature is for flagging, not
  // something this should silently paper over by force-jumping status.
  fromStatuses: ShipmentStatus[]
  toStatus: ShipmentStatus
}

// Only stages whose document set genuinely *is* the real-world milestone
// get an entry here (see the design writeup this was built against).
const STAGE_STATUS_AUTO_MAP: Record<DocumentStage, AutoAdvanceRule> = {
  ENTRY_LEVEL: {
    fromStatuses: ["SHIPPED_ON_BOARD"],
    toStatus: "IN_TRANSIT_SEA",
  },
  PORT_CLEARANCE: {
    fromStatuses: ["ARRIVED_PORT_OF_DISCHARGE", "CUSTOMS_PROCESSING"],
    toStatus: "CUSTOMS_CLEARED",
  },
  ROAD_TRANSIT: {
    fromStatuses: ["CUSTOMS_CLEARED"],
    toStatus: "LOADED_ROAD_TRANSIT",
  },
  FINAL_CLEARANCE: {
    fromStatuses: ["LOADED_ROAD_TRANSIT", "ARRIVED_DESTINATION"],
    toStatus: "OFFLOADED",
  },
}

/**
 * Call after a document is verified. If that document's stage is now fully
 * verified and the shipment is still sitting in the expected "just before"
 * status for that stage, advances status one step and returns the new
 * status. Returns null (no-op) otherwise -- nothing to verify, stage isn't
 * complete yet, or the shipment's status doesn't match what this stage
 * expects.
 */
export async function maybeAutoAdvanceStatus({
  shipmentId,
  stage,
  userId,
}: {
  shipmentId: string
  stage: DocumentStage
  userId: string
}): Promise<ShipmentStatus | null> {
  const rule = STAGE_STATUS_AUTO_MAP[stage]

  const [shipment, docs] = await Promise.all([
    prisma.shipment.findUnique({
      where: { id: shipmentId },
      select: { status: true },
    }),
    prisma.document.findMany({
      where: { shipmentId, stage },
      select: { type: true, isVerified: true },
    }),
  ])
  if (!shipment) return null
  if (!rule.fromStatuses.includes(shipment.status)) return null

  const structuredDocs = docs.filter(
    (d): d is { type: NonNullable<typeof d.type>; isVerified: boolean } =>
      d.type !== null
  )
  if (!isStageComplete(stage, structuredDocs.map((d) => ({ stage, ...d })))) {
    return null
  }

  const extra: { transitStartedAt?: Date; isLoadedOnTruck?: boolean } = {}
  if (rule.toStatus === "LOADED_ROAD_TRANSIT") {
    const transitDetails = await prisma.roadTransitDetails.findUnique({
      where: { shipmentId },
      select: { journeyStartDate: true },
    })
    extra.transitStartedAt = transitDetails?.journeyStartDate ?? new Date()
    extra.isLoadedOnTruck = true
  }

  await prisma.shipment.update({
    where: { id: shipmentId },
    data: { status: rule.toStatus, ...extra },
  })

  await logShipmentAudit({
    shipmentId,
    userId,
    action: "STATUS_AUTO_UPDATED",
    oldValue: { status: SHIPMENT_STATUS_LABELS[shipment.status] },
    newValue: {
      status: SHIPMENT_STATUS_LABELS[rule.toStatus],
      stageLabel: DOCUMENT_STAGE_LABELS[stage],
    },
  })

  if (ARRIVED_OR_LATER_STATUSES.includes(rule.toStatus)) {
    await ensureDetentionTrackers(shipmentId)
  }

  return rule.toStatus
}
