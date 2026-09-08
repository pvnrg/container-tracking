import { UserRole } from "@prisma/client"

const authMock = jest.fn()
jest.mock("@/auth", () => ({ auth: (...args: unknown[]) => authMock(...args) }))

import { requireRole, ROLE_BADGE_CLASSES, ROLE_LABELS } from "./auth-utils"

beforeEach(() => {
  authMock.mockReset()
})

function sessionFor(role: UserRole) {
  return { user: { id: "u1", role } }
}

describe("requireRole", () => {
  it("returns the session when the user's role is in the allowed list", async () => {
    authMock.mockResolvedValue(sessionFor("ADMIN"))
    await expect(requireRole(["ADMIN", "LOGISTICS_OPERATOR"])).resolves.toEqual(
      sessionFor("ADMIN")
    )
  })

  it("throws Forbidden when the user's role is not in the allowed list", async () => {
    authMock.mockResolvedValue(sessionFor("TRANSPORTER"))
    await expect(requireRole(["ADMIN", "LOGISTICS_OPERATOR"])).rejects.toThrow("Forbidden")
  })

  it("throws Forbidden when there is no session at all", async () => {
    authMock.mockResolvedValue(null)
    await expect(requireRole(["ADMIN"])).rejects.toThrow("Forbidden")
  })

  it("throws Forbidden when the session has no user", async () => {
    authMock.mockResolvedValue({})
    await expect(requireRole(["ADMIN"])).rejects.toThrow("Forbidden")
  })
})

describe("ROLE_LABELS / ROLE_BADGE_CLASSES", () => {
  it("has a label and a badge class for every UserRole", () => {
    for (const role of Object.values(UserRole)) {
      expect(typeof ROLE_LABELS[role]).toBe("string")
      expect(ROLE_LABELS[role].length).toBeGreaterThan(0)
      expect(typeof ROLE_BADGE_CLASSES[role]).toBe("string")
      expect(ROLE_BADGE_CLASSES[role].length).toBeGreaterThan(0)
    }
  })
})
