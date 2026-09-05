import { Prisma } from "@prisma/client"

import { prisma } from "@/lib/prisma"

export type AuditAction =
  | "SHIPMENT_CREATED"
  | "TRANSPORTER_ASSIGNED"
  | "STATUS_UPDATED"
  | "OFFLOAD_SCHEDULED"
  | "CONTAINER_OFFLOAD_CONFIRMED"
  | "DETENTION_CLOCK_STARTED"
  | "CONTAINER_RETURNED_TO_DEPOT"
  | "DOCUMENT_UPLOADED"
  | "DOCUMENT_VERIFIED"
  | "DOCUMENT_DELETED"
  | "TAX_PAYMENT_RECORDED"
  | "STAGE_AGENT_SET"
  | "ROAD_TRANSIT_DETAILS_SET"
  | "STATUS_AUTO_UPDATED"

export const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
  SHIPMENT_CREATED: "Shipment Created",
  TRANSPORTER_ASSIGNED: "Transporter Assigned",
  STATUS_UPDATED: "Status Updated",
  OFFLOAD_SCHEDULED: "Offload Scheduled",
  CONTAINER_OFFLOAD_CONFIRMED: "Container Offloaded",
  DETENTION_CLOCK_STARTED: "Detention Clock Started",
  CONTAINER_RETURNED_TO_DEPOT: "Container Returned to Depot",
  DOCUMENT_UPLOADED: "Document Uploaded",
  DOCUMENT_VERIFIED: "Document Verified",
  DOCUMENT_DELETED: "Document Deleted",
  TAX_PAYMENT_RECORDED: "Tax Payment Recorded",
  STAGE_AGENT_SET: "Stage Agent Set",
  ROAD_TRANSIT_DETAILS_SET: "Road Transit Details Set",
  STATUS_AUTO_UPDATED: "Status Auto-Updated",
}

/**
 * Writes one ShipmentAudit row. oldValue/newValue should be small,
 * already human-readable snapshots (labels, formatted dates, names) --
 * not raw ids -- so the activity log can render them directly without
 * re-joining to data that may have since changed or been deleted.
 */
export async function logShipmentAudit({
  shipmentId,
  userId,
  action,
  oldValue,
  newValue,
}: {
  shipmentId: string
  userId?: string | null
  action: AuditAction
  oldValue?: Prisma.InputJsonValue
  newValue?: Prisma.InputJsonValue
}) {
  await prisma.shipmentAudit.create({
    data: {
      shipmentId,
      userId: userId ?? null,
      action,
      oldValue,
      newValue,
    },
  })
}

type JsonRecord = Record<string, unknown>

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" ? (value as JsonRecord) : {}
}

export function describeAuditEntry(entry: {
  action: string
  oldValue: unknown
  newValue: unknown
}): string {
  const oldV = asRecord(entry.oldValue)
  const newV = asRecord(entry.newValue)

  switch (entry.action) {
    case "SHIPMENT_CREATED":
      return `Shipment created with ${newV.containerCount ?? 0} container(s).`
    case "TRANSPORTER_ASSIGNED":
      return `Transporter changed from ${oldV.transporterName ?? "unassigned"} to ${newV.transporterName ?? "unassigned"}.`
    case "STATUS_UPDATED":
      return `Status changed from "${oldV.status ?? "—"}" to "${newV.status ?? "—"}", ETA ${newV.currentEta ?? "—"}.`
    case "OFFLOAD_SCHEDULED":
      return `Offload scheduled for container ${newV.containerNumber ?? ""} on ${newV.offloadScheduledAt ?? ""}.`
    case "CONTAINER_OFFLOAD_CONFIRMED":
      return `Container ${newV.containerNumber ?? ""} confirmed offloaded on ${newV.actualOffloadedAt ?? ""}.`
    case "DETENTION_CLOCK_STARTED":
      return `Detention clock started for container ${newV.containerNumber ?? ""}, due back by ${newV.deadlineDate ?? ""}.`
    case "CONTAINER_RETURNED_TO_DEPOT":
      return `Container ${newV.containerNumber ?? ""} returned to depot on ${newV.returnedToDepotDate ?? ""}.`
    case "DOCUMENT_UPLOADED":
      return `Uploaded "${newV.fileName ?? ""}" (${newV.type ?? newV.title ?? "General"}).${newV.referenceNumber ? ` No. ${newV.referenceNumber}.` : ""}${newV.comment ? ` Comment: "${newV.comment}"` : ""}`
    case "DOCUMENT_VERIFIED":
      return `Verified "${newV.fileName ?? ""}".`
    case "DOCUMENT_DELETED":
      return `Deleted "${oldV.fileName ?? ""}".`
    case "TAX_PAYMENT_RECORDED":
      return `Tax of ${newV.currency ?? ""} ${newV.amount ?? ""} recorded as paid to ${newV.receivedBy ?? "—"} at ${newV.location ?? "—"} on ${newV.paidAt ?? "—"}.`
    case "STAGE_AGENT_SET":
      return `Agent for ${newV.stageLabel ?? ""} set to ${newV.name ?? ""}${newV.position ? ` (${newV.position})` : ""}, contact ${newV.contact ?? "—"}.`
    case "ROAD_TRANSIT_DETAILS_SET":
      return `Transit details set for container ${newV.containerNumber ?? "—"}: transporter ${newV.transporterName ?? "—"}, truck ${newV.truckDetails ?? "—"}, driver ${newV.driverDetails ?? "—"}, journey start ${newV.journeyStartDate ?? "—"}.`
    case "STATUS_AUTO_UPDATED": {
      const trigger = newV.stageLabel
        ? `after ${newV.stageLabel}'s documents were verified`
        : (newV.reason as string | undefined) ?? "automatically"
      return `Status auto-updated from "${oldV.status ?? "—"}" to "${newV.status ?? "—"}" ${trigger}.`
    }
    default:
      return entry.action
  }
}
