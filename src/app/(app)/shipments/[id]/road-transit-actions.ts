"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { logShipmentAudit } from "@/lib/audit"
import { requireRole } from "@/lib/auth-utils"
import { formatDate } from "@/lib/format"
import { prisma } from "@/lib/prisma"

const upsertRoadTransitDetailsSchema = z.object({
  shipmentId: z.string().min(1),
  transporterName: z.string().trim().min(1, "Transporter name is required"),
  assignmentDate: z.string().optional(),
  loadingDate: z.string().optional(),
  truckDetails: z.string().trim().optional(),
  journeyStartDate: z.string().optional(),
})

function toDateOrNull(value: string | undefined) {
  return value ? new Date(value) : null
}

export async function upsertRoadTransitDetails(input: {
  shipmentId: string
  transporterName: string
  assignmentDate?: string
  loadingDate?: string
  truckDetails?: string
  journeyStartDate?: string
}) {
  const session = await requireRole(["ADMIN", "LOGISTICS_OPERATOR"])
  const parsed = upsertRoadTransitDetailsSchema.parse(input)

  const shipment = await prisma.shipment.findUnique({
    where: { id: parsed.shipmentId },
    select: { id: true },
  })
  if (!shipment) {
    throw new Error("Shipment not found")
  }

  const data = {
    transporterName: parsed.transporterName,
    assignmentDate: toDateOrNull(parsed.assignmentDate),
    loadingDate: toDateOrNull(parsed.loadingDate),
    truckDetails: parsed.truckDetails?.trim() || null,
    journeyStartDate: toDateOrNull(parsed.journeyStartDate),
  }

  await prisma.roadTransitDetails.upsert({
    where: { shipmentId: parsed.shipmentId },
    create: { shipmentId: parsed.shipmentId, ...data },
    update: data,
  })

  await logShipmentAudit({
    shipmentId: parsed.shipmentId,
    userId: session.user.id,
    action: "ROAD_TRANSIT_DETAILS_SET",
    newValue: {
      transporterName: data.transporterName,
      assignmentDate: data.assignmentDate ? formatDate(data.assignmentDate) : undefined,
      loadingDate: data.loadingDate ? formatDate(data.loadingDate) : undefined,
      truckDetails: data.truckDetails ?? undefined,
      journeyStartDate: data.journeyStartDate
        ? formatDate(data.journeyStartDate)
        : undefined,
    },
  })

  revalidatePath(`/shipments/${parsed.shipmentId}`)
}
