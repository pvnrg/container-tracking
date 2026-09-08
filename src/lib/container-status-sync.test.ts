const updateManyMock = jest.fn()
jest.mock("./prisma", () => ({
  prisma: { container: { updateMany: (...args: unknown[]) => updateManyMock(...args) } },
}))

import { syncContainerStatusToShipment } from "./container-status-sync"

beforeEach(() => {
  updateManyMock.mockReset()
})

describe("syncContainerStatusToShipment", () => {
  it("does nothing for a shipment status with no container-sync target (e.g. still at sea)", async () => {
    await syncContainerStatusToShipment("ship-1", "IN_TRANSIT_SEA")
    expect(updateManyMock).not.toHaveBeenCalled()
  })

  it("does nothing for ARRIVED_PORT_OF_DISCHARGE (discharge is a separate, deliberate detention-clock action)", async () => {
    await syncContainerStatusToShipment("ship-1", "ARRIVED_PORT_OF_DISCHARGE")
    expect(updateManyMock).not.toHaveBeenCalled()
  })

  it("advances any container behind IN_TRANSIT_TRUCK when the shipment reaches LOADED_ROAD_TRANSIT", async () => {
    await syncContainerStatusToShipment("ship-1", "LOADED_ROAD_TRANSIT")
    expect(updateManyMock).toHaveBeenCalledWith({
      where: { shipmentId: "ship-1", status: { in: ["ON_VESSEL", "DISCHARGED_AT_PORT"] } },
      data: { status: "IN_TRANSIT_TRUCK" },
    })
  })

  it("advances any container behind DELIVERED_WAREHOUSE when the shipment reaches ARRIVED_DESTINATION", async () => {
    await syncContainerStatusToShipment("ship-1", "ARRIVED_DESTINATION")
    expect(updateManyMock).toHaveBeenCalledWith({
      where: {
        shipmentId: "ship-1",
        status: { in: ["ON_VESSEL", "DISCHARGED_AT_PORT", "IN_TRANSIT_TRUCK"] },
      },
      data: { status: "DELIVERED_WAREHOUSE" },
    })
  })

  // Regression: OFFLOADED and COMPLETED were missing from the sync map
  // before -- a container still showing "In-Transit (Road)" after its
  // shipment was marked Completed is exactly the dashboard Shipment vs.
  // Container Pipeline mismatch this file exists to prevent.
  it("advances any container behind OFFLOADED when the shipment reaches OFFLOADED", async () => {
    await syncContainerStatusToShipment("ship-1", "OFFLOADED")
    expect(updateManyMock).toHaveBeenCalledWith({
      where: {
        shipmentId: "ship-1",
        status: { in: ["ON_VESSEL", "DISCHARGED_AT_PORT", "IN_TRANSIT_TRUCK", "DELIVERED_WAREHOUSE"] },
      },
      data: { status: "OFFLOADED" },
    })
  })

  it("advances any container behind EMPTY_RETURNED_TO_DEPOT when the shipment reaches COMPLETED", async () => {
    await syncContainerStatusToShipment("ship-1", "COMPLETED")
    expect(updateManyMock).toHaveBeenCalledWith({
      where: {
        shipmentId: "ship-1",
        status: {
          in: [
            "ON_VESSEL",
            "DISCHARGED_AT_PORT",
            "IN_TRANSIT_TRUCK",
            "DELIVERED_WAREHOUSE",
            "OFFLOADED",
          ],
        },
      },
      data: { status: "EMPTY_RETURNED_TO_DEPOT" },
    })
  })
})
