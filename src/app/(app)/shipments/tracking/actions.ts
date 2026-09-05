"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { RwandanDestination, ShipmentStatus } from "@prisma/client"

import { logShipmentAudit } from "@/lib/audit"
import { requireRole } from "@/lib/auth-utils"
import { syncContainerStatusToShipment } from "@/lib/container-status-sync"
import { ensureDetentionTrackers } from "@/lib/detention-trackers"
import { STAGE_DOCUMENT_TYPES } from "@/lib/document-labels"
import { formatDate } from "@/lib/format"
import { prisma } from "@/lib/prisma"
import {
  ARRIVED_OR_LATER_STATUSES,
  SHIPMENT_STATUS_LABELS,
} from "@/lib/shipment-labels"

const updateSchema = z.object({
  shipmentId: z.string().min(1),
  status: z.nativeEnum(ShipmentStatus),
  currentEta: z.string().min(1, "Current ETA is required"),
  // Set when the admin confirms/adjusts the arrival datetime for
  // ARRIVED_PORT_OF_DISCHARGE, instead of always defaulting to "now".
  actualDischargeDate: z.string().optional(),
  // Set when the admin records road-transit details for LOADED_ROAD_TRANSIT.
  transitStartedAt: z.string().optional(),
  transitArrivalEta: z.string().optional(),
  destinationWarehouse: z.nativeEnum(RwandanDestination).optional(),
})

export async function updateShipmentTracking(input: {
  shipmentId: string
  status: ShipmentStatus
  currentEta: string
  actualDischargeDate?: string
  transitStartedAt?: string
  transitArrivalEta?: string
  destinationWarehouse?: RwandanDestination
}) {
  const session = await requireRole(["ADMIN", "LOGISTICS_OPERATOR"])
  const parsed = updateSchema.parse(input)

  const shipment = await prisma.shipment.findUnique({
    where: { id: parsed.shipmentId },
    select: {
      status: true,
      currentEta: true,
      shippedOnBoardDate: true,
      actualDischargeDate: true,
    },
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
      actualDischargeDate: parsed.actualDischargeDate
        ? new Date(parsed.actualDischargeDate)
        : ARRIVED_OR_LATER_STATUSES.includes(parsed.status) &&
            !shipment.actualDischargeDate
          ? new Date()
          : undefined,
      transitStartedAt: parsed.transitStartedAt
        ? new Date(parsed.transitStartedAt)
        : undefined,
      transitArrivalEta: parsed.transitArrivalEta
        ? new Date(parsed.transitArrivalEta)
        : undefined,
      destinationWarehouse: parsed.destinationWarehouse ?? undefined,
    },
  })

  await syncContainerStatusToShipment(parsed.shipmentId, parsed.status)

  if (
    shipment.status !== parsed.status ||
    shipment.currentEta.getTime() !== new Date(parsed.currentEta).getTime()
  ) {
    await logShipmentAudit({
      shipmentId: parsed.shipmentId,
      userId: session.user.id,
      action: "STATUS_UPDATED",
      oldValue: {
        status: SHIPMENT_STATUS_LABELS[shipment.status],
        currentEta: formatDate(shipment.currentEta),
      },
      newValue: {
        status: SHIPMENT_STATUS_LABELS[parsed.status],
        currentEta: formatDate(new Date(parsed.currentEta)),
      },
    })
  }

  if (ARRIVED_OR_LATER_STATUSES.includes(parsed.status)) {
    await ensureDetentionTrackers(parsed.shipmentId)
    revalidatePath("/shipments/detention")
  }

  revalidatePath("/shipments/tracking")
  revalidatePath("/shipments")
  revalidatePath(`/shipments/${parsed.shipmentId}`)
  revalidatePath("/dashboard")
}
