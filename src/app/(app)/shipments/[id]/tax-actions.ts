"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { logShipmentAudit } from "@/lib/audit"
import { requireRole } from "@/lib/auth-utils"
import { prisma } from "@/lib/prisma"

const recordTaxPaymentSchema = z.object({
  shipmentId: z.string().min(1),
  location: z.string().trim().min(1, "Location is required"),
  receivedBy: z.string().trim().min(1, "Receiver is required"),
  amount: z.number().positive("Amount must be greater than 0"),
  currency: z.string().trim().min(1, "Currency is required"),
  paidAt: z.string().min(1, "Paid at is required"),
})

export async function recordTaxPayment(input: {
  shipmentId: string
  location: string
  receivedBy: string
  amount: number
  currency: string
  paidAt: string
}) {
  const session = await requireRole(["ADMIN", "LOGISTICS_OPERATOR"])
  const parsed = recordTaxPaymentSchema.parse(input)

  const shipment = await prisma.shipment.findUnique({
    where: { id: parsed.shipmentId },
    select: { id: true },
  })
  if (!shipment) {
    throw new Error("Shipment not found")
  }

  await prisma.shipment.update({
    where: { id: parsed.shipmentId },
    data: {
      isTaxPaid: true,
      taxLocation: parsed.location,
      taxReceivedBy: parsed.receivedBy,
      taxAmount: parsed.amount,
      taxCurrency: parsed.currency,
      taxPaidAt: new Date(parsed.paidAt),
    },
  })

  await logShipmentAudit({
    shipmentId: parsed.shipmentId,
    userId: session.user.id,
    action: "TAX_PAYMENT_RECORDED",
    newValue: {
      location: parsed.location,
      receivedBy: parsed.receivedBy,
      amount: parsed.amount,
      currency: parsed.currency,
      paidAt: parsed.paidAt,
    },
  })

  revalidatePath(`/shipments/${parsed.shipmentId}`)
}
