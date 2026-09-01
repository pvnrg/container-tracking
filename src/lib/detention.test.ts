import { getDetentionRisk } from "./detention"

function daysFromNow(days: number) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000)
}

describe("getDetentionRisk", () => {
  it("is normal with more than 15 days remaining", () => {
    expect(getDetentionRisk(daysFromNow(20)).level).toBe("normal")
  })

  it("is warning at exactly 15 days remaining", () => {
    expect(getDetentionRisk(daysFromNow(15)).level).toBe("warning")
  })

  it("is warning at exactly 7 days remaining", () => {
    expect(getDetentionRisk(daysFromNow(7)).level).toBe("warning")
  })

  it("is critical with fewer than 7 days remaining", () => {
    expect(getDetentionRisk(daysFromNow(1)).level).toBe("critical")
  })

  it("is overdue once the deadline has passed", () => {
    const result = getDetentionRisk(daysFromNow(-1))
    expect(result.level).toBe("overdue")
    expect(result.daysRemaining).toBeLessThan(0)
  })

  it("reports the days remaining alongside the level", () => {
    const result = getDetentionRisk(daysFromNow(20))
    expect(result.daysRemaining).toBeGreaterThanOrEqual(19)
    expect(result.daysRemaining).toBeLessThanOrEqual(20)
  })
})
