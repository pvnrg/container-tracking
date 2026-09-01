import { ShipmentStatus } from "@prisma/client"

import {
  ARRIVED_OR_LATER_STATUSES,
  SHIPMENT_STATUS_LABELS,
  SHIPMENT_STATUS_ORDER,
} from "./shipment-labels"

describe("SHIPMENT_STATUS_ORDER", () => {
  it("contains every ShipmentStatus exactly once", () => {
    const allStatuses = Object.values(ShipmentStatus)
    expect(SHIPMENT_STATUS_ORDER.length).toBe(allStatuses.length)
    expect(new Set(SHIPMENT_STATUS_ORDER)).toEqual(new Set(allStatuses))
  })
})

describe("ARRIVED_OR_LATER_STATUSES", () => {
  it("is a non-empty, order-preserving subset of SHIPMENT_STATUS_ORDER", () => {
    expect(ARRIVED_OR_LATER_STATUSES.length).toBeGreaterThan(0)
    const indices = ARRIVED_OR_LATER_STATUSES.map((s) =>
      SHIPMENT_STATUS_ORDER.indexOf(s)
    )
    expect(indices.every((i) => i >= 0)).toBe(true)
    expect(indices).toEqual([...indices].sort((a, b) => a - b))
  })

  it("starts at ARRIVED_PORT_OF_DISCHARGE, the seaport-discharge milestone", () => {
    expect(ARRIVED_OR_LATER_STATUSES[0]).toBe("ARRIVED_PORT_OF_DISCHARGE")
  })
})

describe("SHIPMENT_STATUS_LABELS", () => {
  it("has a non-empty label for every status", () => {
    for (const status of Object.values(ShipmentStatus)) {
      expect(typeof SHIPMENT_STATUS_LABELS[status]).toBe("string")
      expect(SHIPMENT_STATUS_LABELS[status].length).toBeGreaterThan(0)
    }
  })
})
