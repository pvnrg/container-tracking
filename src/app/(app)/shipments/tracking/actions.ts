"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { ShipmentStatus } from "@prisma/client"

import { requireRole } from "@/lib/auth-utils"
import { STAGE_DOCUMENT_TYPES } from "@/lib/document-labels"
import { prisma } from "@/lib/prisma"
import { ARRIVED_OR_LATER_STATUSES } from "@/lib/shipment-labels"

const updateSchema = z.object({
  shipmentId: z.string().min(1),
  status: z.nativeEnum(ShipmentStatus),
  currentEta: z.string().min(1, "Current ETA is required"),
})

export async function updateShipmentTracking(input: {
  shipmentId: string
  status: ShipmentStatus
  currentEta: string
}) {
  await requireRole(["ADMIN", "LOGISTICS_OPERATOR"])
  const parsed = updateSchema.parse(input)

  const shipment = await prisma.shipment.findUnique({
    where: { id: parsed.shipmentId },
    select: { shippedOnBoardDate: true, actualDischargeDate: true },
  })
  if (!shipment) {
    throw new Error("Shipment not found")
  }

  if (parsed.status === "LOADED_ROAD_TRANSIT") {
    const verifiedPortClearanceDoc = await prisma.document.findFirst({
      where: {
        shipmentId: parsed.shipmentId,
        stage: "PORT_CLEARANCE",
        type: { in: STAGE_DOCUMENT_TYPES.PORT_CLEARANCE },
        isVerified: true,
      },
      select: { id: true },
    })
    if (!verifiedPortClearanceDoc) {
      throw new Error(
        "Upload and verify a Stage 2 customs declaration (WH7/T1/IM4) before marking as Loaded on Truck."
      )
    }
  }

  await prisma.shipment.update({
    where: { id: parsed.shipmentId },
    data: {
      status: parsed.status,
      currentEta: new Date(parsed.currentEta),
      isLoadedOnTruck: parsed.status === "LOADED_ROAD_TRANSIT" ? true : undefined,
      shippedOnBoardDate:
        parsed.status === "SHIPPED_ON_BOARD" && !shipment.shippedOnBoardDate
          ? new Date()
          : undefined,
      actualDischargeDate:
        ARRIVED_OR_LATER_STATUSES.includes(parsed.status) &&
        !shipment.actualDischargeDate
          ? new Date()
          : undefined,
    },
  })

  revalidatePath("/shipments/tracking")
  revalidatePath("/shipments")
  revalidatePath(`/shipments/${parsed.shipmentId}`)
  revalidatePath("/dashboard")
}
