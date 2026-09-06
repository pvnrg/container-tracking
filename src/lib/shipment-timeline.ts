import { ShipmentStatus } from "@prisma/client"

import { SHIPMENT_STATUS_LABELS } from "./shipment-labels"

const LABEL_TO_STATUS: Record<string, ShipmentStatus> = Object.fromEntries(
  Object.entries(SHIPMENT_STATUS_LABELS).map(([status, label]) => [label, status])
) as Record<string, ShipmentStatus>

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {}
}

export type StatusChangeEvent = {
  createdAt: Date
  action: "STATUS_UPDATED" | "STATUS_AUTO_UPDATED"
  oldValue: unknown
  newValue: unknown
}

export type TimelineSegment = {
  status: ShipmentStatus
  enteredAt: Date
  // null means this is the current, still-open segment.
  exitedAt: Date | null
  enteredVia: "created" | "manual" | "auto"
}

/**
 * Reconstructs the shipment's status history as a sequence of segments (one
 * per status actually held, in the order it happened) from its audit trail.
 * `statusEvents` must be every STATUS_UPDATED/STATUS_AUTO_UPDATED entry for
 * the shipment, oldest first -- other audit actions don't touch status and
 * are irrelevant here. Doesn't assume forward-only progress (a manual
 * correction can move status backward), it just replays what happened.
 */
export function buildShipmentTimeline(input: {
  createdAt: Date
  currentStatus: ShipmentStatus
  statusEvents: StatusChangeEvent[]
}): TimelineSegment[] {
  const segments: TimelineSegment[] = []

  // Even an event that didn't itself change status (e.g. an ETA-only edit)
  // still records the true status at that moment in oldValue -- use the
  // very first event's oldValue as the most reliable source for what the
  // shipment's status was right after creation, before falling back to its
  // current status (covers the case where it's never had a status change).
  const initialLabel = input.statusEvents[0]
    ? (asRecord(input.statusEvents[0].oldValue).status as string | undefined)
    : undefined
  let status = (initialLabel && LABEL_TO_STATUS[initialLabel]) || input.currentStatus
  let enteredAt = input.createdAt
  let enteredVia: TimelineSegment["enteredVia"] = "created"

  for (const event of input.statusEvents) {
    const newLabel = asRecord(event.newValue).status as string | undefined
    const newStatus = newLabel ? LABEL_TO_STATUS[newLabel] : undefined
    if (!newStatus || newStatus === status) continue

    segments.push({ status, enteredAt, exitedAt: event.createdAt, enteredVia })
    status = newStatus
    enteredAt = event.createdAt
    enteredVia = event.action === "STATUS_AUTO_UPDATED" ? "auto" : "manual"
  }

  segments.push({ status, enteredAt, exitedAt: null, enteredVia })
  return segments
}

// Groups the 9 granular statuses into the same 4 journey phases (and the
// same sky/violet/amber/teal palette) used for the 4 document stages on the
// shipment detail page, so the two areas read as one consistent story of
// the shipment's progress.
export type ShipmentPhase = "sea" | "port" | "road" | "destination"

export const STATUS_PHASE: Record<ShipmentStatus, ShipmentPhase> = {
  SHIPPED_ON_BOARD: "sea",
  IN_TRANSIT_SEA: "sea",
  ARRIVED_PORT_OF_DISCHARGE: "port",
  CUSTOMS_PROCESSING: "port",
  CUSTOMS_CLEARED: "port",
  LOADED_ROAD_TRANSIT: "road",
  ARRIVED_DESTINATION: "road",
  OFFLOADED: "destination",
  COMPLETED: "destination",
}

export const PHASE_LABELS: Record<ShipmentPhase, string> = {
  sea: "At Sea",
  port: "Port Customs",
  road: "Road Transit",
  destination: "Destination",
}

const PHASE_ORDER: ShipmentPhase[] = ["sea", "port", "road", "destination"]

/** Total time spent in each of the 4 phases, in milliseconds. */
export function summarizePhaseDurations(
  segments: TimelineSegment[],
  now: Date = new Date()
): Record<ShipmentPhase, number> {
  const totals: Record<ShipmentPhase, number> = {
    sea: 0,
    port: 0,
    road: 0,
    destination: 0,
  }
  for (const segment of segments) {
    const end = segment.exitedAt ?? now
    const elapsed = Math.max(0, end.getTime() - segment.enteredAt.getTime())
    totals[STATUS_PHASE[segment.status]] += elapsed
  }
  return totals
}

export function phaseBreakdown(
  segments: TimelineSegment[],
  now: Date = new Date()
): { phase: ShipmentPhase; label: string; ms: number }[] {
  const totals = summarizePhaseDurations(segments, now)
  return PHASE_ORDER.map((phase) => ({
    phase,
    label: PHASE_LABELS[phase],
    ms: totals[phase],
  }))
}

/** Compact human-readable duration, e.g. "3d 4h", "5h 12m", "< 1m". */
export function formatDuration(ms: number): string {
  const totalMinutes = Math.round(Math.max(0, ms) / 60000)
  const days = Math.floor(totalMinutes / (60 * 24))
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60)
  const minutes = totalMinutes % 60

  if (days > 0) return hours > 0 ? `${days}d ${hours}h` : `${days}d`
  if (hours > 0) return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`
  return minutes > 0 ? `${minutes}m` : "< 1m"
}
