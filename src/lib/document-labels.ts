import { DocumentStage, DocumentType } from "@prisma/client"

export const DOCUMENT_STAGE_LABELS: Record<DocumentStage, string> = {
  ENTRY_LEVEL: "Stage 1: Entry / Pre-Shipment",
  PORT_CLEARANCE: "Stage 2: Discharge Port Customs",
  ROAD_TRANSIT: "Stage 3: Road Transit Dispatch",
  FINAL_CLEARANCE: "Stage 4: Final Rwandan Clearance",
}

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  COMMERCIAL_INVOICE: "Commercial Invoice",
  PACKING_LIST: "Packing List",
  BILL_OF_LADING: "Bill of Lading (BL)",
  CERTIFICATE_OF_ANALYSIS: "Certificate of Analysis (COA)",
  CUSTOMS_WH7: "Customs Declaration (WH7)",
  CUSTOMS_T1: "Customs Declaration (T1)",
  CUSTOMS_IM4: "Customs Declaration (IM4)",
  TRANSPORTER_RATE_AGREEMENT: "Transporter Rate Agreement",
  DESTINATION_CLEARANCE: "Destination Clearance Document",
  DELIVERY_NOTE: "Warehouse Offload Delivery Note",
}

export const STAGE_DOCUMENT_TYPES: Record<DocumentStage, DocumentType[]> = {
  ENTRY_LEVEL: [
    "COMMERCIAL_INVOICE",
    "PACKING_LIST",
    "BILL_OF_LADING",
    "CERTIFICATE_OF_ANALYSIS",
  ],
  PORT_CLEARANCE: ["CUSTOMS_WH7", "CUSTOMS_T1", "CUSTOMS_IM4"],
  ROAD_TRANSIT: ["TRANSPORTER_RATE_AGREEMENT"],
  FINAL_CLEARANCE: ["DESTINATION_CLEARANCE", "DELIVERY_NOTE"],
}

export const DOCUMENT_STAGE_NOTES: Partial<Record<DocumentStage, string>> = {
  PORT_CLEARANCE:
    "Only one customs declaration type applies per shipment, based on cargo classification.",
}

// Some stages present mutually-exclusive document type groups: only one
// group applies to a given shipment (see DOCUMENT_STAGE_NOTES). Once a
// document exists for a type in one group, the other groups should be
// hidden for that shipment's stage -- both for the status badges and for
// what's offered in the upload dialog.
export const STAGE_TYPE_GROUPS: Partial<Record<DocumentStage, DocumentType[][]>> = {
  PORT_CLEARANCE: [["CUSTOMS_IM4"], ["CUSTOMS_WH7", "CUSTOMS_T1"]],
}

type LooseDoc = { stage: DocumentStage | null; type: DocumentType | null }

// Stage 4's document requirement isn't fixed -- it depends on which
// customs declaration group was chosen back in Stage 2 (an IM4-cleared
// shipment only ever needs a Warehouse Offload Delivery Note; a
// WH7/T1-cleared one only needs a Destination Clearance Document). Until
// Stage 2 has decided, both remain visible/required, matching the prior
// (pre-dependency) behavior.
export type PortClearanceChoice = "IM4" | "WH7_T1" | null

export function getPortClearanceChoice(documents: LooseDoc[]): PortClearanceChoice {
  const types = documents
    .filter((d) => d.stage === "PORT_CLEARANCE")
    .map((d) => d.type)
  if (types.includes("CUSTOMS_IM4")) return "IM4"
  if (types.some((t) => t === "CUSTOMS_WH7" || t === "CUSTOMS_T1")) return "WH7_T1"
  return null
}

function getFinalClearanceTypes(choice: PortClearanceChoice): DocumentType[] {
  if (choice === "IM4") return ["DELIVERY_NOTE"]
  if (choice === "WH7_T1") return ["DESTINATION_CLEARANCE"]
  return STAGE_DOCUMENT_TYPES.FINAL_CLEARANCE
}

/**
 * The document types currently relevant for a stage, given the shipment's
 * documents across ALL stages (not just this one -- FINAL_CLEARANCE needs
 * to see PORT_CLEARANCE's documents to resolve its own requirement). Used
 * both for what's shown/offered in the UI and for what counts toward
 * completion.
 */
export function getVisibleDocumentTypes(
  stage: DocumentStage,
  documents: LooseDoc[]
): DocumentType[] {
  if (stage === "FINAL_CLEARANCE") {
    return getFinalClearanceTypes(getPortClearanceChoice(documents))
  }

  const groups = STAGE_TYPE_GROUPS[stage]
  if (!groups) return STAGE_DOCUMENT_TYPES[stage]

  const existingTypes = documents
    .filter((d) => d.stage === stage)
    .map((d) => d.type)
  const chosenGroup = groups.find((group) =>
    group.some((t) => existingTypes.includes(t))
  )
  return chosenGroup ?? STAGE_DOCUMENT_TYPES[stage]
}

export const ALLOWED_DOCUMENT_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]

export const MAX_DOCUMENT_SIZE_BYTES = 15 * 1024 * 1024

export const DOCUMENT_STATUS_BADGE_CLASSES = {
  missing: "border-border text-muted-foreground",
  uploaded: "border-amber-600/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  verified:
    "border-emerald-600/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
} as const
