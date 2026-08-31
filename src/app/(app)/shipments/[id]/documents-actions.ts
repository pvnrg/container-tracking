"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { DocumentStage, DocumentType } from "@prisma/client"

import { requireRole } from "@/lib/auth-utils"
import {
  ALLOWED_DOCUMENT_MIME_TYPES,
  MAX_DOCUMENT_SIZE_BYTES,
  STAGE_DOCUMENT_TYPES,
} from "@/lib/document-labels"
import { prisma } from "@/lib/prisma"
import { deleteFile, saveFile } from "@/lib/storage"

const uploadSchema = z
  .object({
    shipmentId: z.string().min(1),
    stage: z.nativeEnum(DocumentStage),
    type: z.nativeEnum(DocumentType),
  })
  .refine((v) => STAGE_DOCUMENT_TYPES[v.stage].includes(v.type), {
    message: "Selected document type does not belong to the selected stage",
    path: ["type"],
  })

export async function uploadDocument(formData: FormData) {
  const session = await requireRole(["ADMIN", "LOGISTICS_OPERATOR"])

  const parsed = uploadSchema.parse({
    shipmentId: formData.get("shipmentId"),
    stage: formData.get("stage"),
    type: formData.get("type"),
  })

  const file = formData.get("file")
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Select a file to upload")
  }
  if (!ALLOWED_DOCUMENT_MIME_TYPES.includes(file.type)) {
    throw new Error(
      "Unsupported file type. Allowed: PDF, JPEG, PNG, WEBP, Word, Excel."
    )
  }
  if (file.size > MAX_DOCUMENT_SIZE_BYTES) {
    throw new Error("File is too large. Maximum size is 15MB.")
  }

  const shipment = await prisma.shipment.findUnique({
    where: { id: parsed.shipmentId },
    select: { id: true },
  })
  if (!shipment) {
    throw new Error("Shipment not found")
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const { key } = await saveFile({
    shipmentId: parsed.shipmentId,
    originalName: file.name,
    buffer,
  })

  await prisma.document.create({
    data: {
      shipmentId: parsed.shipmentId,
      stage: parsed.stage,
      type: parsed.type,
      fileUrl: key,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
      uploadedById: session.user.id,
    },
  })

  revalidatePath(`/shipments/${parsed.shipmentId}`)
}

export async function verifyDocument(documentId: string) {
  await requireRole(["ADMIN", "LOGISTICS_OPERATOR"])

  const doc = await prisma.document.update({
    where: { id: documentId },
    data: { isVerified: true, verifiedAt: new Date() },
    select: { shipmentId: true },
  })

  revalidatePath(`/shipments/${doc.shipmentId}`)
}

export async function deleteDocument(documentId: string) {
  await requireRole(["ADMIN", "LOGISTICS_OPERATOR"])

  const doc = await prisma.document.findUnique({ where: { id: documentId } })
  if (!doc) {
    throw new Error("Document not found")
  }

  await deleteFile(doc.fileUrl)
  await prisma.document.delete({ where: { id: documentId } })

  revalidatePath(`/shipments/${doc.shipmentId}`)
}
