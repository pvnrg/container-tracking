"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { logShipmentAudit } from "@/lib/audit"
import { requireRole } from "@/lib/auth-utils"
import { formatDate } from "@/lib/format"
import { prisma } from "@/lib/prisma"

const upsertContainerTransitDetailsSchema = z.object({
  containerId: z.string().min(1),
  transporterName: z.string().trim().min(1, "Transporter name is required"),
  assignmentDate: z.string().optional(),
  loadingDate: z.string().optional(),
  truckDetails: z.string().trim().optional(),
  driverDetails: z.string().trim().optional(),
  journeyStartDate: z.string().optional(),
})

function toDateOrNull(value: string | undefined) {
  return value ? new Date(value) : null
}

export async function upsertContainerTransitDetails(input: {
  containerId: string
  transporterName: string
  assignmentDate?: string
  loadingDate?: string
  truckDetails?: string
  driverDetails?: string
  journeyStartDate?: string
}) {
  const session = await requireRole(["ADMIN", "LOGISTICS_OPERATOR"])
  const parsed = upsertContainerTransitDetailsSchema.parse(input)

  const container = await prisma.container.findUnique({
    where: { id: parsed.containerId },
    select: { id: true, shipmentId: true, containerNumber: true },
  })
  if (!container) {
    throw new Error("Container not found")
  }

  const data = {
    transporterName: parsed.transporterName,
    assignmentDate: toDateOrNull(parsed.assignmentDate),
    loadingDate: toDateOrNull(parsed.loadingDate),
    truckDetails: parsed.truckDetails?.trim() || null,
    driverDetails: parsed.driverDetails?.trim() || null,
    journeyStartDate: toDateOrNull(parsed.journeyStartDate),
  }

  await prisma.containerTransitDetails.upsert({
    where: { containerId: parsed.containerId },
    create: { containerId: parsed.containerId, ...data },
    update: data,
  })

  await logShipmentAudit({
    shipmentId: container.shipmentId,
    userId: session.user.id,
    action: "ROAD_TRANSIT_DETAILS_SET",
    newValue: {
      containerNumber: container.containerNumber,
      transporterName: data.transporterName,
      assignmentDate: data.assignmentDate ? formatDate(data.assignmentDate) : undefined,
      loadingDate: data.loadingDate ? formatDate(data.loadingDate) : undefined,
      truckDetails: data.truckDetails ?? undefined,
      driverDetails: data.driverDetails ?? undefined,
      journeyStartDate: data.journeyStartDate
        ? formatDate(data.journeyStartDate)
        : undefined,
    },
  })

  revalidatePath(`/shipments/${container.shipmentId}`)
}
