import { DocumentStage, DocumentType } from "@prisma/client"

import { DOCUMENT_STAGE_LABELS, DOCUMENT_TYPE_LABELS, STAGE_DOCUMENT_TYPES } from "./document-labels"

// Chronological order documents should land in as a shipment progresses.
const STAGE_ORDER: DocumentStage[] = [
  "ENTRY_LEVEL",
  "PORT_CLEARANCE",
  "ROAD_TRANSIT",
  "FINAL_CLEARANCE",
]

// Stages where the listed document types are alternatives (only one needs
// to be verified) rather than all being required -- mirrors the note shown
// in the documents panel for PORT_CLEARANCE.
const STAGE_REQUIRES_ANY: Partial<Record<DocumentStage, boolean>> = {
  PORT_CLEARANCE: true,
}

type StageDoc = { stage: DocumentStage; type: DocumentType; isVerified: boolean }

function isStageComplete(stage: DocumentStage, docs: StageDoc[]) {
  const types = STAGE_DOCUMENT_TYPES[stage]
  const verifiedTypes = new Set(docs.filter((d) => d.isVerified).map((d) => d.type))
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
  documents: { stage: DocumentStage | null; type: DocumentType | null; isVerified: boolean }[]
): StageSkipAlert | null {
  const structured = documents.filter(
    (d): d is StageDoc => d.stage !== null && d.type !== null
  )

  const incompleteIndex = STAGE_ORDER.findIndex(
    (stage) => !isStageComplete(stage, structured.filter((d) => d.stage === stage))
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

export function describeStageSkipAlert(alert: StageSkipAlert): string {
  const incompleteLabel = DOCUMENT_STAGE_LABELS[alert.incompleteStage]
  const aheadLabel = alert.aheadStages
    .map((s) => DOCUMENT_STAGE_LABELS[s])
    .join(", ")

  const missingText = STAGE_REQUIRES_ANY[alert.incompleteStage]
    ? `no ${alert.missingTypes.map((t) => DOCUMENT_TYPE_LABELS[t]).join(" / ")} verified yet`
    : `missing ${alert.missingTypes.map((t) => DOCUMENT_TYPE_LABELS[t]).join(", ")}`

  return `${aheadLabel} document(s) uploaded, but ${incompleteLabel} isn't complete (${missingText}).`
}
