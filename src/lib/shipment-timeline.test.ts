import { ShipmentStatus } from "@prisma/client"

import { SHIPMENT_STATUS_LABELS } from "./shipment-labels"
import {
  buildShipmentTimeline,
  formatDuration,
  phaseBreakdown,
  type StatusChangeEvent,
} from "./shipment-timeline"

const label = (status: ShipmentStatus) => SHIPMENT_STATUS_LABELS[status]

function statusEvent(
  overrides: Partial<StatusChangeEvent> & {
    createdAt: Date
    from: ShipmentStatus
    to: ShipmentStatus
  }
): StatusChangeEvent {
  return {
    createdAt: overrides.createdAt,
    action: overrides.action ?? "STATUS_UPDATED",
    oldValue: { status: label(overrides.from) },
    newValue: { status: label(overrides.to) },
  }
}

describe("buildShipmentTimeline", () => {
  it("returns a single open segment when the status has never changed", () => {
    const createdAt = new Date("2026-01-01T00:00:00Z")
    const segments = buildShipmentTimeline({
      createdAt,
      currentStatus: "SHIPPED_ON_BOARD",
      statusEvents: [],
    })

    expect(segments).toEqual([
      {
        status: "SHIPPED_ON_BOARD",
        enteredAt: createdAt,
        exitedAt: null,
        enteredVia: "created",
      },
    ])
  })

  it("builds one segment per real status change, in order", () => {
    const createdAt = new Date("2026-01-01T00:00:00Z")
    const t1 = new Date("2026-01-03T00:00:00Z")
    const t2 = new Date("2026-01-10T00:00:00Z")

    const segments = buildShipmentTimeline({
      createdAt,
      currentStatus: "ARRIVED_PORT_OF_DISCHARGE",
      statusEvents: [
        statusEvent({
          createdAt: t1,
          from: "SHIPPED_ON_BOARD",
          to: "IN_TRANSIT_SEA",
        }),
        statusEvent({
          createdAt: t2,
          from: "IN_TRANSIT_SEA",
          to: "ARRIVED_PORT_OF_DISCHARGE",
          action: "STATUS_AUTO_UPDATED",
        }),
      ],
    })

    expect(segments).toEqual([
      { status: "SHIPPED_ON_BOARD", enteredAt: createdAt, exitedAt: t1, enteredVia: "created" },
      { status: "IN_TRANSIT_SEA", enteredAt: t1, exitedAt: t2, enteredVia: "manual" },
      { status: "ARRIVED_PORT_OF_DISCHARGE", enteredAt: t2, exitedAt: null, enteredVia: "auto" },
    ])
  })

  it("skips events that didn't actually change status (e.g. an ETA-only edit)", () => {
    const createdAt = new Date("2026-01-01T00:00:00Z")
    const etaEditAt = new Date("2026-01-02T00:00:00Z")
    const realChangeAt = new Date("2026-01-05T00:00:00Z")

    const segments = buildShipmentTimeline({
      createdAt,
      currentStatus: "IN_TRANSIT_SEA",
      statusEvents: [
        statusEvent({
          createdAt: etaEditAt,
          from: "SHIPPED_ON_BOARD",
          to: "SHIPPED_ON_BOARD",
        }),
        statusEvent({
          createdAt: realChangeAt,
          from: "SHIPPED_ON_BOARD",
          to: "IN_TRANSIT_SEA",
        }),
      ],
    })

    expect(segments).toEqual([
      {
        status: "SHIPPED_ON_BOARD",
        enteredAt: createdAt,
        exitedAt: realChangeAt,
        enteredVia: "created",
      },
      {
        status: "IN_TRANSIT_SEA",
        enteredAt: realChangeAt,
        exitedAt: null,
        enteredVia: "manual",
      },
    ])
  })

  it("replays a manual backward correction rather than assuming forward-only order", () => {
    const createdAt = new Date("2026-01-01T00:00:00Z")
    const forwardAt = new Date("2026-01-05T00:00:00Z")
    const correctionAt = new Date("2026-01-06T00:00:00Z")

    const segments = buildShipmentTimeline({
      createdAt,
      currentStatus: "IN_TRANSIT_SEA",
      statusEvents: [
        statusEvent({
          createdAt: forwardAt,
          from: "SHIPPED_ON_BOARD",
          to: "ARRIVED_PORT_OF_DISCHARGE",
        }),
        statusEvent({
          createdAt: correctionAt,
          from: "ARRIVED_PORT_OF_DISCHARGE",
          to: "IN_TRANSIT_SEA",
        }),
      ],
    })

    expect(segments.map((s) => s.status)).toEqual([
      "SHIPPED_ON_BOARD",
      "ARRIVED_PORT_OF_DISCHARGE",
      "IN_TRANSIT_SEA",
    ])
  })
})

describe("phaseBreakdown", () => {
  it("groups segment durations into the 4 journey phases and covers total elapsed time", () => {
    const createdAt = new Date("2026-01-01T00:00:00Z")
    const arrivedAt = new Date("2026-01-04T00:00:00Z") // 3 days at sea
    const now = new Date("2026-01-06T00:00:00Z") // 2 days at port so far

    const segments = buildShipmentTimeline({
      createdAt,
      currentStatus: "ARRIVED_PORT_OF_DISCHARGE",
      statusEvents: [
        statusEvent({
          createdAt: arrivedAt,
          from: "SHIPPED_ON_BOARD",
          to: "ARRIVED_PORT_OF_DISCHARGE",
        }),
      ],
    })

    const breakdown = phaseBreakdown(segments, now)
    const byPhase = Object.fromEntries(breakdown.map((b) => [b.phase, b.ms]))

    expect(byPhase.sea).toBe(3 * 24 * 60 * 60 * 1000)
    expect(byPhase.port).toBe(2 * 24 * 60 * 60 * 1000)
    expect(byPhase.road).toBe(0)
    expect(byPhase.destination).toBe(0)
  })
})

describe("formatDuration", () => {
  it("formats days, hours, and minutes at decreasing granularity", () => {
    expect(formatDuration(3 * 24 * 60 * 60 * 1000 + 4 * 60 * 60 * 1000)).toBe("3d 4h")
    expect(formatDuration(3 * 24 * 60 * 60 * 1000)).toBe("3d")
    expect(formatDuration(5 * 60 * 60 * 1000 + 12 * 60 * 1000)).toBe("5h 12m")
    expect(formatDuration(10 * 1000)).toBe("< 1m")
  })
})
