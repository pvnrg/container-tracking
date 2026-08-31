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
