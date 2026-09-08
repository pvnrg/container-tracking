const findUniqueShipmentMock = jest.fn()
const findUniqueContainerMock = jest.fn()
jest.mock("./prisma", () => ({
  prisma: {
    shipment: { findUnique: (...args: unknown[]) => findUniqueShipmentMock(...args) },
    container: { findUnique: (...args: unknown[]) => findUniqueContainerMock(...args) },
  },
}))

import {
  requireContainerAccess,
  requireShipmentAccess,
  shipmentScopeWhere,
  shipmentViaContainerScopeWhere,
} from "./data-scope"

const OWNER_ID = "user-owner"
const OTHER_ID = "user-other"

beforeEach(() => {
  findUniqueShipmentMock.mockReset()
  findUniqueContainerMock.mockReset()
})

describe("shipmentScopeWhere", () => {
  it("returns an empty where clause for a null session", () => {
    expect(shipmentScopeWhere(null)).toEqual({})
  })

  it("returns an empty where clause for a full-access account", () => {
    expect(
      shipmentScopeWhere({ user: { id: OWNER_ID, restrictToOwnData: false } })
    ).toEqual({})
  })

  it("scopes to the account's own shipments when restrictToOwnData is set", () => {
    expect(
      shipmentScopeWhere({ user: { id: OWNER_ID, restrictToOwnData: true } })
    ).toEqual({ createdById: OWNER_ID })
  })
})

describe("shipmentViaContainerScopeWhere", () => {
  it("returns an empty where clause for a full-access account", () => {
    expect(
      shipmentViaContainerScopeWhere({ user: { id: OWNER_ID, restrictToOwnData: false } })
    ).toEqual({})
  })

  it("scopes to the account's own shipments when restrictToOwnData is set", () => {
    expect(
      shipmentViaContainerScopeWhere({ user: { id: OWNER_ID, restrictToOwnData: true } })
    ).toEqual({ createdById: OWNER_ID })
  })
})

describe("requireShipmentAccess", () => {
  it("never queries the database for a full-access account", async () => {
    await requireShipmentAccess({ user: { id: OWNER_ID, restrictToOwnData: false } }, "ship-1")
    expect(findUniqueShipmentMock).not.toHaveBeenCalled()
  })

  it("allows a restricted account through for a shipment it created", async () => {
    findUniqueShipmentMock.mockResolvedValue({ createdById: OWNER_ID })
    await expect(
      requireShipmentAccess({ user: { id: OWNER_ID, restrictToOwnData: true } }, "ship-1")
    ).resolves.toBeUndefined()
  })

  it("throws Forbidden for a restricted account on a shipment it doesn't own", async () => {
    findUniqueShipmentMock.mockResolvedValue({ createdById: OTHER_ID })
    await expect(
      requireShipmentAccess({ user: { id: OWNER_ID, restrictToOwnData: true } }, "ship-1")
    ).rejects.toThrow("Forbidden")
  })

  it("throws the same Forbidden (not a distinguishable error) for a shipment that doesn't exist", async () => {
    findUniqueShipmentMock.mockResolvedValue(null)
    await expect(
      requireShipmentAccess({ user: { id: OWNER_ID, restrictToOwnData: true } }, "missing")
    ).rejects.toThrow("Forbidden")
  })
})

describe("requireContainerAccess", () => {
  it("never queries the database for a full-access account", async () => {
    await requireContainerAccess({ user: { id: OWNER_ID, restrictToOwnData: false } }, "c-1")
    expect(findUniqueContainerMock).not.toHaveBeenCalled()
  })

  it("allows a restricted account through for a container on a shipment it created", async () => {
    findUniqueContainerMock.mockResolvedValue({ shipment: { createdById: OWNER_ID } })
    await expect(
      requireContainerAccess({ user: { id: OWNER_ID, restrictToOwnData: true } }, "c-1")
    ).resolves.toBeUndefined()
  })

  it("throws Forbidden for a restricted account on a container it doesn't own", async () => {
    findUniqueContainerMock.mockResolvedValue({ shipment: { createdById: OTHER_ID } })
    await expect(
      requireContainerAccess({ user: { id: OWNER_ID, restrictToOwnData: true } }, "c-1")
    ).rejects.toThrow("Forbidden")
  })

  it("throws Forbidden for a container that doesn't exist", async () => {
    findUniqueContainerMock.mockResolvedValue(null)
    await expect(
      requireContainerAccess({ user: { id: OWNER_ID, restrictToOwnData: true } }, "missing")
    ).rejects.toThrow("Forbidden")
  })
})
