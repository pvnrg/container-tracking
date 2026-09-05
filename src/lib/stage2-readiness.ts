export type Stage2Gap = "agent" | "customsDocument" | "transitDetails"

export const STAGE2_GAP_LABELS: Record<Stage2Gap, string> = {
  agent: "Clearing Agent",
  customsDocument: "Customs Declaration",
  transitDetails: "Transit Details",
}

/**
 * What's still missing for Stage 2 (Discharge Port Customs) on a shipment
 * that has already arrived. Used both for the dashboard alert card and,
 * potentially, future badges elsewhere -- kept as a pure function so it's
 * easy to test independently of the Prisma queries that feed it.
 */
export function getStage2Gaps(input: {
  hasAgent: boolean
  hasCustomsDocument: boolean
  allContainersHaveTransitDetails: boolean
}): Stage2Gap[] {
  const gaps: Stage2Gap[] = []
  if (!input.hasAgent) gaps.push("agent")
  if (!input.hasCustomsDocument) gaps.push("customsDocument")
  if (!input.allContainersHaveTransitDetails) gaps.push("transitDetails")
  return gaps
}
