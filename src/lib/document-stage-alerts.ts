import { DocumentStage, DocumentType } from "@prisma/client"

import { STAGE_DOCUMENT_TYPES, getVisibleDocumentTypes } from "./document-labels"

// Chronological order documents should land in as a shipment progresses.
const STAGE_ORDER: DocumentStage[] = [
  "ENTRY_LEVEL",
  "PORT_CLEARANCE",
  "ROAD_TRANSIT",
  "FINAL_CLEARANCE",
]

// Short form for dashboard chips/one-liners; DOCUMENT_STAGE_LABELS' full
// "Stage N: ..." text is meant for the shipment page's stage-by-stage view.
export const STAGE_SHORT_LABELS: Record<DocumentStage, string> = {
  ENTRY_LEVEL: "Stage 1",
  PORT_CLEARANCE: "Stage 2",
  ROAD_TRANSIT: "Stage 3",
  FINAL_CLEARANCE: "Stage 4",
}

// Stages where the listed document types are alternatives (only one needs
// to be verified) rather than all being required -- mirrors the note shown
// in the documents panel for PORT_CLEARANCE.
const STAGE_REQUIRES_ANY: Partial<Record<DocumentStage, boolean>> = {
  PORT_CLEARANCE: true,
}

export type StageDoc = { stage: DocumentStage; type: DocumentType; isVerified: boolean }

export type StageCompletionOptions = {
  // Finalizing the Stage 3 Transit Rate Sheet (see rate-sheet-actions.ts) is
  // an alternate way of completing ROAD_TRANSIT, equivalent to verifying a
  // TRANSPORTER_RATE_AGREEMENT document.
  rateSheetFinalized?: boolean
}

/**
 * Whether a stage is fully verified. `documents` should include ALL of the
 * shipment's structured documents (every stage), not just this stage's --
 * FINAL_CLEARANCE's requirement depends on what PORT_CLEARANCE resolved to
 * (see getVisibleDocumentTypes), so it needs visibility into that stage too.
 */
export function isStageComplete(
  stage: DocumentStage,
  documents: StageDoc[],
  options?: StageCompletionOptions
) {
  if (stage === "ROAD_TRANSIT" && options?.rateSheetFinalized) return true

  const verifiedTypes = new Set(
    documents.filter((d) => d.isVerified).map((d) => d.type)
  )

  if (stage === "FINAL_CLEARANCE") {
    const requiredTypes = getVisibleDocumentTypes(stage, documents)
    return requiredTypes.every((t) => verifiedTypes.has(t))
  }

  const types = STAGE_DOCUMENT_TYPES[stage]
  return STAGE_REQUIRES_ANY[stage]
    ? types.some((t) => verifiedTypes.has(t))
    : types.every((t) => verifiedTypes.has(t))
}

export type StageSkipAlert = {
  incompleteStage: DocumentStage
  missingTypes: DocumentType[]
  aheadStages: DocumentStage[]
}

/**
 * Flags shipments where a later document stage already has an upload while
 * an earlier stage still isn't fully verified -- i.e. paperwork jumped
 * ahead of where the shipment's process actually is.
 */
export function findStageSkipAlert(
  documents: { stage: DocumentStage | null; type: DocumentType | null; isVerified: boolean }[],
  options?: StageCompletionOptions
): StageSkipAlert | null {
  const structured = documents.filter(
    (d): d is StageDoc => d.stage !== null && d.type !== null
  )

  const incompleteIndex = STAGE_ORDER.findIndex(
    (stage) =>
      !isStageComplete(stage, structured, stage === "ROAD_TRANSIT" ? options : undefined)
  )
  if (incompleteIndex === -1) return null

  const incompleteStage = STAGE_ORDER[incompleteIndex]
  const aheadStages = STAGE_ORDER.slice(incompleteIndex + 1).filter((stage) =>
    structured.some((d) => d.stage === stage)
  )
  if (aheadStages.length === 0) return null

  const verifiedTypes = new Set(
    structured
      .filter((d) => d.stage === incompleteStage && d.isVerified)
      .map((d) => d.type)
  )
  const missingTypes = STAGE_DOCUMENT_TYPES[incompleteStage].filter(
    (t) => !verifiedTypes.has(t)
  )

  return { incompleteStage, missingTypes, aheadStages }
}

// Short "N ahead" chip text, e.g. "Stage 2 ahead" or "Stage 2 & 3 ahead".
export function stageSkipBadgeLabel(alert: StageSkipAlert): string {
  const labels = alert.aheadStages.map((s) => STAGE_SHORT_LABELS[s])
  return `${labels.join(" & ")} ahead`
}

// One scannable line for the dashboard list; full document-by-document
// detail lives on the shipment page a click away.
export function describeStageSkipAlert(alert: StageSkipAlert): string {
  const from = STAGE_SHORT_LABELS[alert.incompleteStage]
  const to = alert.aheadStages.map((s) => STAGE_SHORT_LABELS[s]).join(" & ")

  const progress = STAGE_REQUIRES_ANY[alert.incompleteStage]
    ? "no declaration verified yet"
    : `${STAGE_DOCUMENT_TYPES[alert.incompleteStage].length - alert.missingTypes.length}/${STAGE_DOCUMENT_TYPES[alert.incompleteStage].length} verified`

  return `${from} incomplete (${progress}) — ${to} already has uploads`
}
