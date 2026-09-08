jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }))

const requireRoleMock = jest.fn()
jest.mock("@/lib/auth-utils", () => ({ requireRole: (...args: unknown[]) => requireRoleMock(...args) }))

const requireShipmentAccessMock = jest.fn()
jest.mock("@/lib/data-scope", () => ({
  requireShipmentAccess: (...args: unknown[]) => requireShipmentAccessMock(...args),
}))

const findUniqueShipmentMock = jest.fn()
const updateShipmentMock = jest.fn()
const findManyDocumentMock = jest.fn()
const findUniqueRateSheetMock = jest.fn()
jest.mock("@/lib/prisma", () => ({
  prisma: {
    shipment: {
      findUnique: (...args: unknown[]) => findUniqueShipmentMock(...args),
      update: (...args: unknown[]) => updateShipmentMock(...args),
    },
    document: { findMany: (...args: unknown[]) => findManyDocumentMock(...args) },
    transitRateSheet: { findUnique: (...args: unknown[]) => findUniqueRateSheetMock(...args) },
  },
}))

const syncContainerStatusToShipmentMock = jest.fn()
jest.mock("@/lib/container-status-sync", () => ({
  syncContainerStatusToShipment: (...args: unknown[]) => syncContainerStatusToShipmentMock(...args),
}))

const logShipmentAuditMock = jest.fn()
jest.mock("@/lib/audit", () => ({ logShipmentAudit: (...args: unknown[]) => logShipmentAuditMock(...args) }))

const ensureDetentionTrackersMock = jest.fn()
jest.mock("@/lib/detention-trackers", () => ({
  ensureDetentionTrackers: (...args: unknown[]) => ensureDetentionTrackersMock(...args),
}))

import { updateShipmentTracking } from "./actions"

const SESSION = { user: { id: "u1", restrictToOwnData: false } }

function shipmentRow(status: string, overrides: Record<string, unknown> = {}) {
  return {
    status,
    currentEta: new Date("2026-01-01T00:00:00Z"),
    shippedOnBoardDate: null,
    actualDischargeDate: null,
    ...overrides,
  }
}

const baseInput = {
  shipmentId: "s1",
  currentEta: "2026-01-01",
}

beforeEach(() => {
  jest.clearAllMocks()
  requireRoleMock.mockResolvedValue(SESSION)
  findManyDocumentMock.mockResolvedValue([])
  findUniqueRateSheetMock.mockResolvedValue(null)
})

describe("updateShipmentTracking", () => {
  it("rejects a status update that would move the shipment backward", async () => {
    findUniqueShipmentMock.mockResolvedValue(shipmentRow("CUSTOMS_CLEARED"))

    await expect(
      updateShipmentTracking({ ...baseInput, status: "IN_TRANSIT_SEA" })
    ).rejects.toThrow(/can't move backward/i)
    expect(updateShipmentMock).not.toHaveBeenCalled()
  })

  it("allows re-saving the same status (no-op for the backward guard)", async () => {
    findUniqueShipmentMock.mockResolvedValue(shipmentRow("IN_TRANSIT_SEA"))

    await updateShipmentTracking({ ...baseInput, status: "IN_TRANSIT_SEA" })

    expect(updateShipmentMock).toHaveBeenCalled()
  })

  // This is the exact live scenario found and fixed this session: a
  // shipment with zero documents must not be allowed to jump straight to a
  // paperwork-gated status.
  it("blocks jumping to Customs Cleared with no Stage 1 documents at all", async () => {
    findUniqueShipmentMock.mockResolvedValue(shipmentRow("IN_TRANSIT_SEA"))
    findManyDocumentMock.mockResolvedValue([])

    await expect(
      updateShipmentTracking({ ...baseInput, status: "CUSTOMS_CLEARED" })
    ).rejects.toThrow(/Stage 1 entry documents/i)
    expect(updateShipmentMock).not.toHaveBeenCalled()
  })

  it("allows Customs Cleared once all Stage 1 documents are verified", async () => {
    findUniqueShipmentMock.mockResolvedValue(shipmentRow("IN_TRANSIT_SEA"))
    findManyDocumentMock.mockResolvedValue([
      { stage: "ENTRY_LEVEL", type: "COMMERCIAL_INVOICE", isVerified: true },
      { stage: "ENTRY_LEVEL", type: "PACKING_LIST", isVerified: true },
      { stage: "ENTRY_LEVEL", type: "BILL_OF_LADING", isVerified: true },
      { stage: "ENTRY_LEVEL", type: "CERTIFICATE_OF_ANALYSIS", isVerified: true },
    ])

    await updateShipmentTracking({ ...baseInput, status: "CUSTOMS_CLEARED" })

    expect(updateShipmentMock).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "CUSTOMS_CLEARED" }) })
    )
  })

  it("blocks Loaded on Truck without a verified Stage 2 customs declaration (pre-existing rule, still enforced)", async () => {
    findUniqueShipmentMock.mockResolvedValue(shipmentRow("CUSTOMS_CLEARED"))
    findManyDocumentMock.mockResolvedValue([])

    await expect(
      updateShipmentTracking({ ...baseInput, status: "LOADED_ROAD_TRANSIT" })
    ).rejects.toThrow(/Stage 2 customs declaration/i)
    expect(updateShipmentMock).not.toHaveBeenCalled()
  })

  it("allows Offloaded once the transit rate sheet is finalized, even with no Stage 3 document", async () => {
    findUniqueShipmentMock.mockResolvedValue(shipmentRow("LOADED_ROAD_TRANSIT"))
    findManyDocumentMock.mockResolvedValue([])
    findUniqueRateSheetMock.mockResolvedValue({ finalizedAt: new Date("2026-01-01") })

    await updateShipmentTracking({ ...baseInput, status: "OFFLOADED" })

    expect(updateShipmentMock).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "OFFLOADED" }) })
    )
  })

  it("does not gate purely physical milestones on any document stage", async () => {
    // ARRIVED_PORT_OF_DISCHARGE has no entry in the gate map -- it's a
    // physical arrival fact, same as the ETA-based cron auto-advance.
    findUniqueShipmentMock.mockResolvedValue(shipmentRow("IN_TRANSIT_SEA"))
    findManyDocumentMock.mockResolvedValue([])

    await updateShipmentTracking({ ...baseInput, status: "ARRIVED_PORT_OF_DISCHARGE" })

    expect(updateShipmentMock).toHaveBeenCalled()
    expect(ensureDetentionTrackersMock).toHaveBeenCalledWith("s1")
  })

  it("syncs container status and logs an audit entry after a successful status change", async () => {
    findUniqueShipmentMock.mockResolvedValue(shipmentRow("SHIPPED_ON_BOARD"))

    await updateShipmentTracking({ ...baseInput, status: "IN_TRANSIT_SEA" })

    expect(syncContainerStatusToShipmentMock).toHaveBeenCalledWith("s1", "IN_TRANSIT_SEA")
    expect(logShipmentAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({ shipmentId: "s1", action: "STATUS_UPDATED" })
    )
  })

  it("does not log an audit entry when nothing actually changed", async () => {
    findUniqueShipmentMock.mockResolvedValue(
      shipmentRow("IN_TRANSIT_SEA", { currentEta: new Date("2026-01-01T00:00:00Z") })
    )

    await updateShipmentTracking({ ...baseInput, status: "IN_TRANSIT_SEA", currentEta: "2026-01-01" })

    expect(logShipmentAuditMock).not.toHaveBeenCalled()
  })

  it("enforces data-scope access before touching the shipment", async () => {
    findUniqueShipmentMock.mockResolvedValue(shipmentRow("IN_TRANSIT_SEA"))
    requireShipmentAccessMock.mockRejectedValue(new Error("Forbidden"))

    await expect(
      updateShipmentTracking({ ...baseInput, status: "IN_TRANSIT_SEA" })
    ).rejects.toThrow("Forbidden")
    expect(updateShipmentMock).not.toHaveBeenCalled()
  })
})
