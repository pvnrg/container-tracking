import { findStageSkipAlert, isStageComplete } from "./document-stage-alerts"

describe("findStageSkipAlert", () => {
  it("flags a later stage that has an uploaded document while an earlier stage is incomplete", () => {
    const alert = findStageSkipAlert([
      { stage: "ROAD_TRANSIT", type: "TRANSPORTER_RATE_AGREEMENT", isVerified: true },
    ])
    expect(alert).not.toBeNull()
    expect(alert?.incompleteStage).toBe("ENTRY_LEVEL")
    expect(alert?.aheadStages).toContain("ROAD_TRANSIT")
  })

  // Regression: ROAD_TRANSIT can be completed with zero documents uploaded,
  // via a finalized rate sheet alone (see isStageComplete) -- the alert
  // must still fire even though there's no document row for it to see.
  it("flags Stage 3 as ahead when it was completed via a finalized rate sheet, with no documents at all", () => {
    const alert = findStageSkipAlert([], { rateSheetFinalized: true })
    expect(alert).not.toBeNull()
    expect(alert?.incompleteStage).toBe("ENTRY_LEVEL")
    expect(alert?.aheadStages).toEqual(["ROAD_TRANSIT"])
  })

  it("does not flag anything when nothing is ahead of the incomplete stage", () => {
    expect(findStageSkipAlert([])).toBeNull()
  })

  it("does not flag anything when nothing is uploaded and the rate sheet isn't finalized", () => {
    expect(findStageSkipAlert([], { rateSheetFinalized: false })).toBeNull()
  })
})

describe("isStageComplete", () => {
  it("treats ROAD_TRANSIT as complete once the rate sheet is finalized, regardless of documents", () => {
    expect(isStageComplete("ROAD_TRANSIT", [], { rateSheetFinalized: true })).toBe(true)
  })

  it("treats ROAD_TRANSIT as incomplete without a finalized rate sheet or verified document", () => {
    expect(isStageComplete("ROAD_TRANSIT", [], { rateSheetFinalized: false })).toBe(false)
  })
})
