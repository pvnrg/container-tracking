"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { DocumentStage, DocumentType } from "@prisma/client"

import { logShipmentAudit } from "@/lib/audit"
import { requireRole } from "@/lib/auth-utils"
import {
  ALLOWED_DOCUMENT_MIME_TYPES,
  DOCUMENT_TYPE_LABELS,
  getVisibleDocumentTypes,
  MAX_DOCUMENT_SIZE_BYTES,
  STAGE_DOCUMENT_TYPES,
} from "@/lib/document-labels"
import { createNotification } from "@/lib/notifications"
import { prisma } from "@/lib/prisma"
import { SHIPMENT_STATUS_LABELS } from "@/lib/shipment-labels"
import { maybeAutoAdvanceStatus } from "@/lib/shipment-status-auto"
import { deleteFile, saveFile } from "@/lib/storage"

const uploadSchema = z
  .object({
    shipmentId: z.string().min(1),
    stage: z.nativeEnum(DocumentStage),
    type: z.nativeEnum(DocumentType),
    comment: z.string().optional(),
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
    comment: formData.get("comment") ?? undefined,
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

  const shipmentDocs = await prisma.document.findMany({
    where: { shipmentId: parsed.shipmentId, stage: { not: null } },
    select: { stage: true, type: true },
  })
  const visibleTypes = getVisibleDocumentTypes(parsed.stage, shipmentDocs)
  if (!visibleTypes.includes(parsed.type)) {
    throw new Error(
      `${DOCUMENT_TYPE_LABELS[parsed.type]} doesn't apply to this shipment based on its other documents.`
    )
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const { key } = await saveFile({
    shipmentId: parsed.shipmentId,
    originalName: file.name,
    buffer,
  })

  const comment = parsed.comment?.trim() || null

  await prisma.document.create({
    data: {
      shipmentId: parsed.shipmentId,
      stage: parsed.stage,
      type: parsed.type,
      comment,
      fileUrl: key,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
      uploadedById: session.user.id,
    },
  })

  await logShipmentAudit({
    shipmentId: parsed.shipmentId,
    userId: session.user.id,
    action: "DOCUMENT_UPLOADED",
    newValue: {
      fileName: file.name,
      type: DOCUMENT_TYPE_LABELS[parsed.type],
      comment: comment ?? undefined,
    },
  })

  revalidatePath(`/shipments/${parsed.shipmentId}`)
}

export async function verifyDocument(documentId: string) {
  const session = await requireRole(["ADMIN", "LOGISTICS_OPERATOR"])

  const doc = await prisma.document.update({
    where: { id: documentId },
    data: { isVerified: true, verifiedAt: new Date() },
    select: {
      shipmentId: true,
      stage: true,
      type: true,
      fileName: true,
      shipment: {
        select: { blNumber: true, transporterId: true },
      },
    },
  })

  await logShipmentAudit({
    shipmentId: doc.shipmentId,
    userId: session.user.id,
    action: "DOCUMENT_VERIFIED",
    newValue: {
      fileName: doc.fileName,
      type: doc.type ? DOCUMENT_TYPE_LABELS[doc.type] : undefined,
    },
  })

  if (doc.stage === "PORT_CLEARANCE" && doc.shipment.transporterId) {
    await createNotification({
      userId: doc.shipment.transporterId,
      shipmentId: doc.shipmentId,
      title: "Ready to Load",
      message: `Shipment ${doc.shipment.blNumber} has cleared customs and is ready for loading/pickup.`,
    })
  }

  let autoAdvancedTo: string | null = null
  if (doc.stage) {
    const newStatus = await maybeAutoAdvanceStatus({
      shipmentId: doc.shipmentId,
      userId: session.user.id,
    })
    if (newStatus) {
      autoAdvancedTo = SHIPMENT_STATUS_LABELS[newStatus]
      revalidatePath("/shipments")
      revalidatePath("/shipments/tracking")
      revalidatePath("/shipments/detention")
      revalidatePath("/dashboard")
    }
  }

  revalidatePath(`/shipments/${doc.shipmentId}`)
  return { autoAdvancedTo }
}

export async function deleteDocument(documentId: string) {
  const session = await requireRole(["ADMIN", "LOGISTICS_OPERATOR"])

  const doc = await prisma.document.findUnique({ where: { id: documentId } })
  if (!doc) {
    throw new Error("Document not found")
  }

  await deleteFile(doc.fileUrl)
  await prisma.document.delete({ where: { id: documentId } })

  await logShipmentAudit({
    shipmentId: doc.shipmentId,
    userId: session.user.id,
    action: "DOCUMENT_DELETED",
    oldValue: {
      fileName: doc.fileName,
      type: doc.type ? DOCUMENT_TYPE_LABELS[doc.type] : (doc.title ?? undefined),
    },
  })

  revalidatePath(`/shipments/${doc.shipmentId}`)
}

export async function uploadGeneralDocuments(formData: FormData) {
  const session = await requireRole(["ADMIN", "LOGISTICS_OPERATOR"])

  const shipmentId = formData.get("shipmentId")
  if (typeof shipmentId !== "string" || !shipmentId) {
    throw new Error("Missing shipment")
  }

  const shipment = await prisma.shipment.findUnique({
    where: { id: shipmentId },
    select: { id: true },
  })
  if (!shipment) {
    throw new Error("Shipment not found")
  }

  const files = formData.getAll("files").filter((f): f is File => f instanceof File)
  const titles = formData.getAll("titles").map((t) => String(t))

  if (files.length === 0) {
    throw new Error("Select at least one file to upload")
  }

  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    if (file.size === 0) continue

    if (!ALLOWED_DOCUMENT_MIME_TYPES.includes(file.type)) {
      throw new Error(
        `"${file.name}" is an unsupported file type. Allowed: PDF, JPEG, PNG, WEBP, Word, Excel.`
      )
    }
    if (file.size > MAX_DOCUMENT_SIZE_BYTES) {
      throw new Error(`"${file.name}" is too large. Maximum size is 15MB.`)
    }

    const title = titles[i]?.trim() || file.name
    const buffer = Buffer.from(await file.arrayBuffer())
    const { key } = await saveFile({
      shipmentId,
      originalName: file.name,
      buffer,
    })

    await prisma.document.create({
      data: {
        shipmentId,
        title,
        fileUrl: key,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
        uploadedById: session.user.id,
      },
    })

    await logShipmentAudit({
      shipmentId,
      userId: session.user.id,
      action: "DOCUMENT_UPLOADED",
      newValue: { fileName: file.name, title },
    })
  }

  revalidatePath(`/shipments/${shipmentId}`)
}
