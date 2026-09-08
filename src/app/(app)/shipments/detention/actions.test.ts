jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }))

const requireRoleMock = jest.fn()
jest.mock("@/lib/auth-utils", () => ({ requireRole: (...args: unknown[]) => requireRoleMock(...args) }))

const requireContainerAccessMock = jest.fn()
jest.mock("@/lib/data-scope", () => ({
  requireContainerAccess: (...args: unknown[]) => requireContainerAccessMock(...args),
}))

const findUniqueContainerMock = jest.fn()
const findManyContainerMock = jest.fn()
const detentionTrackerCreateMock = jest.fn()
const detentionTrackerUpdateMock = jest.fn()
const containerUpdateMock = jest.fn()
const shipmentAuditCreateMock = jest.fn()
const findUniqueShipmentMock = jest.fn()
const updateShipmentMock = jest.fn()
const transactionMock = jest.fn((ops: unknown[]) => Promise.all(ops))
jest.mock("@/lib/prisma", () => ({
  prisma: {
    container: {
      findUnique: (...args: unknown[]) => findUniqueContainerMock(...args),
      findMany: (...args: unknown[]) => findManyContainerMock(...args),
      update: (...args: unknown[]) => containerUpdateMock(...args),
    },
    detentionTracker: {
      create: (...args: unknown[]) => detentionTrackerCreateMock(...args),
      update: (...args: unknown[]) => detentionTrackerUpdateMock(...args),
    },
    shipment: {
      findUnique: (...args: unknown[]) => findUniqueShipmentMock(...args),
      update: (...args: unknown[]) => updateShipmentMock(...args),
    },
    shipmentAudit: { create: (...args: unknown[]) => shipmentAuditCreateMock(...args) },
    $transaction: (...args: [unknown[]]) => transactionMock(...args),
  },
}))

import { markContainerReturned, startDetentionClock } from "./actions"

const SESSION = { user: { id: "u1", restrictToOwnData: false } }

beforeEach(() => {
  jest.clearAllMocks()
  requireRoleMock.mockResolvedValue(SESSION)
  requireContainerAccessMock.mockResolvedValue(undefined)
  containerUpdateMock.mockResolvedValue({})
  detentionTrackerCreateMock.mockResolvedValue({})
  detentionTrackerUpdateMock.mockResolvedValue({})
  shipmentAuditCreateMock.mockResolvedValue({})
})

describe("startDetentionClock", () => {
  it("checks access before reading the container", async () => {
    requireContainerAccessMock.mockRejectedValue(new Error("Forbidden"))
    await expect(startDetentionClock("c1")).rejects.toThrow("Forbidden")
    expect(findUniqueContainerMock).not.toHaveBeenCalled()
  })

  it("throws when a detention clock is already running", async () => {
    findUniqueContainerMock.mockResolvedValue({
      id: "c1",
      shipmentId: "s1",
      status: "DISCHARGED_AT_PORT",
      detentionTracker: { id: "t1" },
    })
    await expect(startDetentionClock("c1")).rejects.toThrow("already been started")
  })

  it("advances a container still On Vessel to Discharged at Port", async () => {
    findUniqueContainerMock.mockResolvedValue({
      id: "c1",
      shipmentId: "s1",
      containerNumber: "MSCU1111111",
      status: "ON_VESSEL",
      detentionTracker: null,
    })

    await startDetentionClock("c1")

    expect(containerUpdateMock).toHaveBeenCalledWith({
      where: { id: "c1" },
      data: { status: "DISCHARGED_AT_PORT" },
    })
  })
})

describe("markContainerReturned", () => {
  it("checks access before reading the container", async () => {
    requireContainerAccessMock.mockRejectedValue(new Error("Forbidden"))
    await expect(markContainerReturned("c1")).rejects.toThrow("Forbidden")
    expect(findUniqueContainerMock).not.toHaveBeenCalled()
  })

  it("throws when no detention clock was ever started", async () => {
    findUniqueContainerMock.mockResolvedValue({
      id: "c1",
      shipmentId: "s1",
      detentionTracker: null,
    })
    await expect(markContainerReturned("c1")).rejects.toThrow("has not been started")
  })

  it("marks the container returned without touching the shipment when siblings remain outstanding", async () => {
    findUniqueContainerMock.mockResolvedValue({
      id: "c1",
      shipmentId: "s1",
      containerNumber: "MSCU1111111",
      detentionTracker: { id: "t1" },
    })
    findManyContainerMock.mockResolvedValue([
      { status: "EMPTY_RETURNED_TO_DEPOT" },
      { status: "DISCHARGED_AT_PORT" },
    ])

    await markContainerReturned("c1")

    expect(containerUpdateMock).toHaveBeenCalledWith({
      where: { id: "c1" },
      data: { status: "EMPTY_RETURNED_TO_DEPOT" },
    })
    expect(updateShipmentMock).not.toHaveBeenCalled()
  })

  // Regression: this is the exact gap that was found and fixed this
  // session -- a shipment whose containers are all back at the depot must
  // reach COMPLETED, mirroring confirmContainerOffload's OFFLOADED check.
  it("advances the shipment to COMPLETED once every container is returned to depot", async () => {
    findUniqueContainerMock.mockResolvedValue({
      id: "c1",
      shipmentId: "s1",
      containerNumber: "MSCU1111111",
      detentionTracker: { id: "t1" },
    })
    findManyContainerMock.mockResolvedValue([{ status: "EMPTY_RETURNED_TO_DEPOT" }])
    findUniqueShipmentMock.mockResolvedValue({ status: "OFFLOADED" })

    await markContainerReturned("c1")

    expect(updateShipmentMock).toHaveBeenCalledWith({
      where: { id: "s1" },
      data: { status: "COMPLETED" },
    })
  })

  it("does not regress or re-set the shipment status if it's already COMPLETED", async () => {
    findUniqueContainerMock.mockResolvedValue({
      id: "c1",
      shipmentId: "s1",
      containerNumber: "MSCU1111111",
      detentionTracker: { id: "t1" },
    })
    findManyContainerMock.mockResolvedValue([{ status: "EMPTY_RETURNED_TO_DEPOT" }])
    findUniqueShipmentMock.mockResolvedValue({ status: "COMPLETED" })

    await markContainerReturned("c1")

    expect(updateShipmentMock).not.toHaveBeenCalled()
  })
})
