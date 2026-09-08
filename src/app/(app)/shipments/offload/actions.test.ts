jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }))

const requireRoleMock = jest.fn()
jest.mock("@/lib/auth-utils", () => ({ requireRole: (...args: unknown[]) => requireRoleMock(...args) }))

const requireContainerAccessMock = jest.fn()
jest.mock("@/lib/data-scope", () => ({
  requireContainerAccess: (...args: unknown[]) => requireContainerAccessMock(...args),
}))

const logShipmentAuditMock = jest.fn()
jest.mock("@/lib/audit", () => ({ logShipmentAudit: (...args: unknown[]) => logShipmentAuditMock(...args) }))

const findUniqueContainerMock = jest.fn()
const findManyContainerMock = jest.fn()
const updateContainerMock = jest.fn()
const findUniqueShipmentMock = jest.fn()
const updateShipmentMock = jest.fn()
const shipmentAuditCreateMock = jest.fn()
const transactionMock = jest.fn((ops: unknown[]) => Promise.all(ops))
jest.mock("@/lib/prisma", () => ({
  prisma: {
    container: {
      findUnique: (...args: unknown[]) => findUniqueContainerMock(...args),
      findMany: (...args: unknown[]) => findManyContainerMock(...args),
      update: (...args: unknown[]) => updateContainerMock(...args),
    },
    shipment: {
      findUnique: (...args: unknown[]) => findUniqueShipmentMock(...args),
      update: (...args: unknown[]) => updateShipmentMock(...args),
    },
    shipmentAudit: { create: (...args: unknown[]) => shipmentAuditCreateMock(...args) },
    $transaction: (...args: [unknown[]]) => transactionMock(...args),
  },
}))

import { confirmContainerOffload } from "./actions"

const SESSION = { user: { id: "u1", restrictToOwnData: false } }

beforeEach(() => {
  jest.clearAllMocks()
  requireRoleMock.mockResolvedValue(SESSION)
  requireContainerAccessMock.mockResolvedValue(undefined)
  findManyContainerMock.mockResolvedValue([]) // "in progress" lookup, empty by default
  updateContainerMock.mockResolvedValue({})
  shipmentAuditCreateMock.mockResolvedValue({})
})

describe("confirmContainerOffload", () => {
  it("checks access before reading any of the container's state", async () => {
    requireContainerAccessMock.mockRejectedValue(new Error("Forbidden"))

    await expect(confirmContainerOffload("c1")).rejects.toThrow("Forbidden")

    expect(findUniqueContainerMock).not.toHaveBeenCalled()
  })

  it("throws when the container doesn't exist", async () => {
    findUniqueContainerMock.mockResolvedValue(null)

    await expect(confirmContainerOffload("missing")).rejects.toThrow("Container not found")
  })

  it("throws when the container is already offloaded", async () => {
    findUniqueContainerMock.mockResolvedValue({
      id: "c1",
      shipmentId: "s1",
      containerNumber: "MSCU1234567",
      actualOffloadedAt: new Date("2026-01-01"),
      offloadScheduledAt: null,
    })

    await expect(confirmContainerOffload("c1")).rejects.toThrow("already offloaded")
  })

  it("blocks confirming out of turn when another container is already in progress", async () => {
    findUniqueContainerMock.mockResolvedValue({
      id: "c2",
      shipmentId: "s1",
      containerNumber: "TCLU2222222",
      actualOffloadedAt: null,
      offloadScheduledAt: null,
    })
    findManyContainerMock.mockResolvedValue([
      { id: "c1", containerNumber: "MSCU1111111" },
    ])

    await expect(confirmContainerOffload("c2")).rejects.toThrow(/Confirm MSCU1111111 first/)
    expect(updateContainerMock).not.toHaveBeenCalled()
  })

  it("confirms the container and does not advance the shipment when siblings remain", async () => {
    findUniqueContainerMock.mockResolvedValue({
      id: "c1",
      shipmentId: "s1",
      containerNumber: "MSCU1111111",
      actualOffloadedAt: null,
      offloadScheduledAt: null,
    })
    // After confirming, one sibling is still short of OFFLOADED.
    findManyContainerMock
      .mockResolvedValueOnce([]) // in-progress lookup
      .mockResolvedValueOnce([{ status: "OFFLOADED" }, { status: "IN_TRANSIT_TRUCK" }])

    await confirmContainerOffload("c1")

    expect(updateContainerMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "c1" },
        data: expect.objectContaining({ status: "OFFLOADED" }),
      })
    )
    expect(updateShipmentMock).not.toHaveBeenCalled()
  })

  // Regression: this is the exact gap markContainerReturned had for
  // COMPLETED before it was fixed to mirror this same pattern.
  it("advances the shipment to OFFLOADED once every container is offloaded", async () => {
    findUniqueContainerMock.mockResolvedValue({
      id: "c1",
      shipmentId: "s1",
      containerNumber: "MSCU1111111",
      actualOffloadedAt: null,
      offloadScheduledAt: null,
    })
    findManyContainerMock
      .mockResolvedValueOnce([]) // in-progress lookup
      .mockResolvedValueOnce([{ status: "OFFLOADED" }, { status: "EMPTY_RETURNED_TO_DEPOT" }])
    findUniqueShipmentMock.mockResolvedValue({ status: "LOADED_ROAD_TRANSIT" })

    await confirmContainerOffload("c1")

    expect(updateShipmentMock).toHaveBeenCalledWith({
      where: { id: "s1" },
      data: { status: "OFFLOADED" },
    })
  })

  it("does not regress the shipment status if it's already past OFFLOADED", async () => {
    findUniqueContainerMock.mockResolvedValue({
      id: "c1",
      shipmentId: "s1",
      containerNumber: "MSCU1111111",
      actualOffloadedAt: null,
      offloadScheduledAt: null,
    })
    findManyContainerMock
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ status: "OFFLOADED" }])
    findUniqueShipmentMock.mockResolvedValue({ status: "COMPLETED" })

    await confirmContainerOffload("c1")

    expect(updateShipmentMock).not.toHaveBeenCalled()
  })
})
