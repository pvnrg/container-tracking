import { getStage2Gaps } from "./stage2-readiness"

describe("getStage2Gaps", () => {
  it("reports no gaps when everything is in place", () => {
    expect(
      getStage2Gaps({
        hasAgent: true,
        hasCustomsDocument: true,
        allContainersHaveTransitDetails: true,
      })
    ).toEqual([])
  })

  it("reports every gap when nothing is in place", () => {
    expect(
      getStage2Gaps({
        hasAgent: false,
        hasCustomsDocument: false,
        allContainersHaveTransitDetails: false,
      })
    ).toEqual(["agent", "customsDocument", "transitDetails"])
  })

  it("reports only the missing pieces", () => {
    expect(
      getStage2Gaps({
        hasAgent: true,
        hasCustomsDocument: false,
        allContainersHaveTransitDetails: true,
      })
    ).toEqual(["customsDocument"])
  })
})
