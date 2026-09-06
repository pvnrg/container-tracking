"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { logShipmentAudit } from "@/lib/audit"
import { requireRole } from "@/lib/auth-utils"
import { prisma } from "@/lib/prisma"
import { SHIPMENT_STATUS_LABELS } from "@/lib/shipment-labels"
import { maybeAutoAdvanceStatus } from "@/lib/shipment-status-auto"

const lineItemSchema = z.object({
  description: z.string().trim().min(1, "Description is required"),
  amount: z.coerce.number().finite().nonnegative("Amount must be zero or more"),
})

const saveRateSheetSchema = z.object({
  shipmentId: z.string().min(1),
  currency: z.string().trim().min(1),
  lineItems: z.array(lineItemSchema).min(1, "Add at least one rate line item"),
  finalize: z.boolean(),
})

export async function saveRateSheet(input: {
  shipmentId: string
  currency: string
  lineItems: { description: string; amount: number }[]
  finalize: boolean
}) {
  const session = await requireRole(["ADMIN", "LOGISTICS_OPERATOR"])
  const parsed = saveRateSheetSchema.parse(input)

  const shipment = await prisma.shipment.findUnique({
    where: { id: parsed.shipmentId },
    select: { id: true, blNumber: true },
  })
  if (!shipment) {
    throw new Error("Shipment not found")
  }

  const existing = await prisma.transitRateSheet.findUnique({
    where: { shipmentId: parsed.shipmentId },
    select: { id: true, finalizedAt: true, invoiceNumber: true },
  })
  if (existing?.finalizedAt) {
    throw new Error("This rate sheet is finalized. Reopen it before making changes.")
  }

  const invoiceNumber = existing?.invoiceNumber ?? `PI-${shipment.blNumber}`
  const finalizedAt = parsed.finalize ? new Date() : null

  const rateSheet = await prisma.$transaction(async (tx) => {
    const sheet = await tx.transitRateSheet.upsert({
      where: { shipmentId: parsed.shipmentId },
      create: {
        shipmentId: parsed.shipmentId,
        invoiceNumber,
        currency: parsed.currency,
        finalizedAt,
      },
      update: {
        currency: parsed.currency,
        finalizedAt,
      },
    })

    // Replace-all is simplest and safe here -- line items have no identity
    // worth preserving across edits (no comments/attachments hang off them).
    await tx.rateLineItem.deleteMany({ where: { rateSheetId: sheet.id } })
    await tx.rateLineItem.createMany({
      data: parsed.lineItems.map((item, index) => ({
        rateSheetId: sheet.id,
        description: item.description,
        amount: item.amount,
        sortOrder: index,
      })),
    })

    return sheet
  })

  let autoAdvancedTo: string | null = null
  if (parsed.finalize) {
    const total = parsed.lineItems.reduce((sum, item) => sum + item.amount, 0)
    await logShipmentAudit({
      shipmentId: parsed.shipmentId,
      userId: session.user.id,
      action: "RATE_SHEET_FINALIZED",
      newValue: {
        currency: parsed.currency,
        total: total.toFixed(2),
        itemCount: parsed.lineItems.length,
        invoiceNumber: rateSheet.invoiceNumber,
      },
    })

    const newStatus = await maybeAutoAdvanceStatus({
      shipmentId: parsed.shipmentId,
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

  revalidatePath(`/shipments/${parsed.shipmentId}`)
  return { autoAdvancedTo, invoiceNumber: rateSheet.invoiceNumber }
}

// Reopening doesn't roll back the shipment status if it already
// auto-advanced past ROAD_TRANSIT -- matches the forward-only status
// philosophy documented on maybeAutoAdvanceStatus (deleting/unverifying a
// document doesn't regress status either).
export async function reopenRateSheet(shipmentId: string) {
  const session = await requireRole(["ADMIN", "LOGISTICS_OPERATOR"])

  const sheet = await prisma.transitRateSheet.findUnique({
    where: { shipmentId },
    select: { finalizedAt: true },
  })
  if (!sheet?.finalizedAt) {
    throw new Error("Rate sheet is not finalized")
  }

  await prisma.transitRateSheet.update({
    where: { shipmentId },
    data: { finalizedAt: null },
  })

  await logShipmentAudit({
    shipmentId,
    userId: session.user.id,
    action: "RATE_SHEET_REOPENED",
  })

  revalidatePath(`/shipments/${shipmentId}`)
}
