"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { logShipmentAudit } from "@/lib/audit"
import { requireRole } from "@/lib/auth-utils"
import { formatDate } from "@/lib/format"
import { prisma } from "@/lib/prisma"

const driverSchema = z.object({
  name: z.string().trim().min(1, "Driver name is required"),
  phone: z.string().trim().optional(),
})

const upsertContainerTransitDetailsSchema = z.object({
  containerId: z.string().min(1),
  transporterName: z.string().trim().min(1, "Transporter name is required"),
  assignmentDate: z.string().optional(),
  loadingDate: z.string().optional(),
  truckDetails: z.string().trim().optional(),
  journeyStartDate: z.string().optional(),
  drivers: z.array(driverSchema).default([]),
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
  journeyStartDate?: string
  drivers?: { name: string; phone?: string }[]
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
    journeyStartDate: toDateOrNull(parsed.journeyStartDate),
  }

  const details = await prisma.containerTransitDetails.upsert({
    where: { containerId: parsed.containerId },
    create: { containerId: parsed.containerId, ...data },
    update: data,
  })

  // The dialog submits the whole driver list at once, so the simplest
  // correct way to apply add/edit/remove in one save is to replace the
  // set entirely rather than diffing against what's already there.
  await prisma.transitDriver.deleteMany({
    where: { containerTransitDetailsId: details.id },
  })
  if (parsed.drivers.length > 0) {
    await prisma.transitDriver.createMany({
      data: parsed.drivers.map((driver) => ({
        containerTransitDetailsId: details.id,
        name: driver.name,
        phone: driver.phone?.trim() || null,
      })),
    })
  }

  // Remember this transporter name so it shows up as a suggestion next
  // time, instead of being retyped -- a no-op if it's already known.
  await prisma.transportCompany.upsert({
    where: { name: data.transporterName },
    create: { name: data.transporterName },
    update: {},
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
      drivers:
        parsed.drivers.length > 0
          ? parsed.drivers
              .map((d) => (d.phone ? `${d.name} (${d.phone})` : d.name))
              .join(", ")
          : undefined,
      journeyStartDate: data.journeyStartDate
        ? formatDate(data.journeyStartDate)
        : undefined,
    },
  })

  revalidatePath(`/shipments/${container.shipmentId}`)
}
