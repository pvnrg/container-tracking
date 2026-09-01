import { formatDate, formatDateTime } from "./format"

// Constructed from local-time components (not UTC) so the assertion holds
// regardless of the machine's timezone -- both construction and formatting
// happen in the same local context.

describe("formatDate", () => {
  it("formats a date as DD/MM/YYYY (en-GB) regardless of machine locale", () => {
    const date = new Date(2026, 8, 1) // 1 September 2026, local time
    expect(formatDate(date)).toBe("01/09/2026")
  })

  it("pads single-digit day and month", () => {
    const date = new Date(2026, 0, 5) // 5 January 2026
    expect(formatDate(date)).toBe("05/01/2026")
  })
})

describe("formatDateTime", () => {
  it("includes the en-GB date and 24-hour time", () => {
    const date = new Date(2026, 8, 1, 14, 30, 0)
    const result = formatDateTime(date)
    expect(result).toContain("01/09/2026")
    expect(result).toContain("14:30")
  })
})
