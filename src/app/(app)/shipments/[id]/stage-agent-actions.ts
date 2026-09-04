"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { DocumentStage } from "@prisma/client"

import { logShipmentAudit } from "@/lib/audit"
import { requireRole } from "@/lib/auth-utils"
import { DOCUMENT_STAGE_LABELS } from "@/lib/document-labels"
import { prisma } from "@/lib/prisma"

const upsertStageAgentSchema = z.object({
  shipmentId: z.string().min(1),
  stage: z.nativeEnum(DocumentStage),
  name: z.string().trim().min(1, "Agent name is required"),
  contact: z.string().trim().min(1, "Contact is required"),
  position: z.string().trim().optional(),
})

export async function upsertStageAgent(input: {
  shipmentId: string
  stage: DocumentStage
  name: string
  contact: string
  position?: string
}) {
  const session = await requireRole(["ADMIN", "LOGISTICS_OPERATOR"])
  const parsed = upsertStageAgentSchema.parse(input)

  const shipment = await prisma.shipment.findUnique({
    where: { id: parsed.shipmentId },
    select: { id: true },
  })
  if (!shipment) {
    throw new Error("Shipment not found")
  }

  const position = parsed.position?.trim() || null

  await prisma.stageAgent.upsert({
    where: {
      shipmentId_stage: { shipmentId: parsed.shipmentId, stage: parsed.stage },
    },
    create: {
      shipmentId: parsed.shipmentId,
      stage: parsed.stage,
      name: parsed.name,
      contact: parsed.contact,
      position,
    },
    update: {
      name: parsed.name,
      contact: parsed.contact,
      position,
    },
  })

  await logShipmentAudit({
    shipmentId: parsed.shipmentId,
    userId: session.user.id,
    action: "STAGE_AGENT_SET",
    newValue: {
      stageLabel: DOCUMENT_STAGE_LABELS[parsed.stage],
      name: parsed.name,
      contact: parsed.contact,
      position: position ?? undefined,
    },
  })

  revalidatePath(`/shipments/${parsed.shipmentId}`)
}
