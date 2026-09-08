import { DocumentType } from "@prisma/client"

const findUniqueShipmentMock = jest.fn()
const findManyDocumentMock = jest.fn()
const findUniqueRateSheetMock = jest.fn()
const findManyContainerMock = jest.fn()
const updateShipmentMock = jest.fn()
jest.mock("./prisma", () => ({
  prisma: {
    shipment: {
      findUnique: (...args: unknown[]) => findUniqueShipmentMock(...args),
      update: (...args: unknown[]) => updateShipmentMock(...args),
    },
    document: { findMany: (...args: unknown[]) => findManyDocumentMock(...args) },
    transitRateSheet: { findUnique: (...args: unknown[]) => findUniqueRateSheetMock(...args) },
    container: { findMany: (...args: unknown[]) => findManyContainerMock(...args) },
  },
}))

const logShipmentAuditMock = jest.fn()
jest.mock("./audit", () => ({ logShipmentAudit: (...args: unknown[]) => logShipmentAuditMock(...args) }))

const syncContainerStatusToShipmentMock = jest.fn()
jest.mock("./container-status-sync", () => ({
  syncContainerStatusToShipment: (...args: unknown[]) => syncContainerStatusToShipmentMock(...args),
}))

const ensureDetentionTrackersMock = jest.fn()
jest.mock("./detention-trackers", () => ({
  ensureDetentionTrackers: (...args: unknown[]) => ensureDetentionTrackersMock(...args),
}))

import { maybeAutoAdvanceStatus } from "./shipment-status-auto"

function verifiedDoc(type: DocumentType, stage: string) {
  return { stage, type, isVerified: true }
}

const ENTRY_LEVEL_DOCS = [
  verifiedDoc("COMMERCIAL_INVOICE", "ENTRY_LEVEL"),
  verifiedDoc("PACKING_LIST", "ENTRY_LEVEL"),
  verifiedDoc("BILL_OF_LADING", "ENTRY_LEVEL"),
  verifiedDoc("CERTIFICATE_OF_ANALYSIS", "ENTRY_LEVEL"),
]

beforeEach(() => {
  jest.clearAllMocks()
  findUniqueRateSheetMock.mockResolvedValue(null)
  findManyContainerMock.mockResolvedValue([])
})

describe("maybeAutoAdvanceStatus", () => {
  it("returns null and does nothing when the shipment doesn't exist", async () => {
    findUniqueShipmentMock.mockResolvedValue(null)
    findManyDocumentMock.mockResolvedValue([])

    const result = await maybeAutoAdvanceStatus({ shipmentId: "s1", userId: "u1" })

    expect(result).toBeNull()
    expect(updateShipmentMock).not.toHaveBeenCalled()
  })

  it("returns null when no stage is complete yet", async () => {
    findUniqueShipmentMock.mockResolvedValue({ status: "SHIPPED_ON_BOARD" })
    findManyDocumentMock.mockResolvedValue([])

    const result = await maybeAutoAdvanceStatus({ shipmentId: "s1", userId: "u1" })

    expect(result).toBeNull()
    expect(updateShipmentMock).not.toHaveBeenCalled()
  })

  it("advances to the status matching the completed stage", async () => {
    findUniqueShipmentMock.mockResolvedValue({ status: "SHIPPED_ON_BOARD" })
    findManyDocumentMock.mockResolvedValue(ENTRY_LEVEL_DOCS)

    const result = await maybeAutoAdvanceStatus({ shipmentId: "s1", userId: "u1" })

    expect(result).toBe("IN_TRANSIT_SEA")
    expect(updateShipmentMock).toHaveBeenCalledWith({
      where: { id: "s1" },
      data: { status: "IN_TRANSIT_SEA" },
    })
    expect(syncContainerStatusToShipmentMock).toHaveBeenCalledWith("s1", "IN_TRANSIT_SEA")
    expect(logShipmentAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({ shipmentId: "s1", action: "STATUS_AUTO_UPDATED" })
    )
    // IN_TRANSIT_SEA isn't an ARRIVED_OR_LATER status -- no detention clock yet.
    expect(ensureDetentionTrackersMock).not.toHaveBeenCalled()
  })

  it("jumps straight to the furthest-complete stage's status when paperwork lands out of order", async () => {
    // Only Stage 3 (Road Transit) is complete -- Stage 1/2 are untouched --
    // yet the shipment should still advance all the way to LOADED_ROAD_TRANSIT,
    // matching the "out of order paperwork" behavior this function documents.
    findUniqueShipmentMock.mockResolvedValue({ status: "IN_TRANSIT_SEA" })
    findManyDocumentMock.mockResolvedValue([
      verifiedDoc("TRANSPORTER_RATE_AGREEMENT", "ROAD_TRANSIT"),
    ])

    const result = await maybeAutoAdvanceStatus({ shipmentId: "s1", userId: "u1" })

    expect(result).toBe("LOADED_ROAD_TRANSIT")
    expect(updateShipmentMock).toHaveBeenCalledWith({
      where: { id: "s1" },
      data: expect.objectContaining({ status: "LOADED_ROAD_TRANSIT", isLoadedOnTruck: true }),
    })
    // LOADED_ROAD_TRANSIT is an ARRIVED_OR_LATER status -- detention clock starts.
    expect(ensureDetentionTrackersMock).toHaveBeenCalledWith("s1")
  })

  it("treats a finalized rate sheet as equivalent to a verified Road Transit document", async () => {
    findUniqueShipmentMock.mockResolvedValue({ status: "IN_TRANSIT_SEA" })
    findManyDocumentMock.mockResolvedValue([])
    findUniqueRateSheetMock.mockResolvedValue({ finalizedAt: new Date("2026-01-01") })

    const result = await maybeAutoAdvanceStatus({ shipmentId: "s1", userId: "u1" })

    expect(result).toBe("LOADED_ROAD_TRANSIT")
  })

  it("never regresses status, even if current status is already ahead of what the documents justify", async () => {
    // Only ENTRY_LEVEL is complete (-> IN_TRANSIT_SEA), but the shipment is
    // already at OFFLOADED -- e.g. a later document got deleted/unverified.
    findUniqueShipmentMock.mockResolvedValue({ status: "OFFLOADED" })
    findManyDocumentMock.mockResolvedValue(ENTRY_LEVEL_DOCS)

    const result = await maybeAutoAdvanceStatus({ shipmentId: "s1", userId: "u1" })

    expect(result).toBeNull()
    expect(updateShipmentMock).not.toHaveBeenCalled()
  })

  it("uses the earliest container journey-start date for transitStartedAt when advancing to LOADED_ROAD_TRANSIT", async () => {
    findUniqueShipmentMock.mockResolvedValue({ status: "IN_TRANSIT_SEA" })
    findManyDocumentMock.mockResolvedValue([
      verifiedDoc("TRANSPORTER_RATE_AGREEMENT", "ROAD_TRANSIT"),
    ])
    findManyContainerMock.mockResolvedValue([
      { transitDetails: { journeyStartDate: new Date("2026-03-05T00:00:00Z") } },
      { transitDetails: { journeyStartDate: new Date("2026-03-02T00:00:00Z") } },
      { transitDetails: null },
    ])

    await maybeAutoAdvanceStatus({ shipmentId: "s1", userId: "u1" })

    expect(updateShipmentMock).toHaveBeenCalledWith({
      where: { id: "s1" },
      data: expect.objectContaining({
        transitStartedAt: new Date("2026-03-02T00:00:00Z"),
      }),
    })
  })
})
