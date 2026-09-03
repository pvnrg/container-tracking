"use server"

import type { BlType, DischargePort } from "@prisma/client"

import { requireRole } from "@/lib/auth-utils"
import { parseShipmentDocument, type ParsedContainer } from "@/lib/bl-parser"
import { extractTextFromPdf, recognizeImageText } from "@/lib/ocr"

const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]
const MAX_SIZE_BYTES = 15 * 1024 * 1024

export type ExtractedContainer = ParsedContainer

export type ExtractedShipmentData = {
  blNumber?: string
  blType?: BlType
  shippingLine?: string
  vesselName?: string
  voyageNumber?: string
  bookingRef?: string
  originCountry?: string
  originPort?: string
  dischargePort?: DischargePort
  shipperName?: string
  consigneeName?: string
  notifyParty?: string
  containers: ExtractedContainer[]
  rawText: string
  filledFieldCount: number
}

export async function extractShipmentFromDocument(
  formData: FormData
): Promise<ExtractedShipmentData> {
  await requireRole(["ADMIN", "LOGISTICS_OPERATOR"])

  const file = formData.get("file")
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Select a file to upload")
  }
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    throw new Error(
      "Unsupported file type. Upload a JPEG, PNG, WEBP, or PDF of the OBL."
    )
  }
  if (file.size > MAX_SIZE_BYTES) {
    throw new Error("File is too large. Maximum size is 15MB.")
  }

  const buffer = Buffer.from(await file.arrayBuffer())

  const text =
    file.type === "application/pdf"
      ? await extractTextFromPdf(buffer)
      : await recognizeImageText(buffer)

  if (!text.trim()) {
    throw new Error(
      "Couldn't find any readable text in that document. Try a clearer photo or scan."
    )
  }

  const parsed = parseShipmentDocument(text)

  const filledFieldCount =
    [
      parsed.blNumber,
      parsed.blType,
      parsed.shippingLine,
      parsed.vesselName,
      parsed.voyageNumber,
      parsed.bookingRef,
      parsed.originCountry,
      parsed.originPort,
      parsed.dischargePort,
      parsed.shipperName,
      parsed.consigneeName,
      parsed.notifyParty,
    ].filter(Boolean).length + parsed.containers.length

  return {
    ...parsed,
    rawText: text,
    filledFieldCount,
  }
}
