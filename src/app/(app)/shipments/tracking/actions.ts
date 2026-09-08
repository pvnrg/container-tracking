"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { DocumentStage, RwandanDestination, ShipmentStatus } from "@prisma/client"

import { logShipmentAudit } from "@/lib/audit"
import { requireRole } from "@/lib/auth-utils"
import { syncContainerStatusToShipment } from "@/lib/container-status-sync"
import { requireShipmentAccess } from "@/lib/data-scope"
import { ensureDetentionTrackers } from "@/lib/detention-trackers"
import { isStageComplete } from "@/lib/document-stage-alerts"
import { formatDate } from "@/lib/format"
import { prisma } from "@/lib/prisma"
import {
  ARRIVED_OR_LATER_STATUSES,
  SHIPMENT_STATUS_LABELS,
  SHIPMENT_STATUS_ORDER,
} from "@/lib/shipment-labels"

// Manually promoting a shipment into one of these statuses requires the
// PRECEDING document stage to already be verified -- e.g. you physically
// can't load cargo onto a truck (LOADED_ROAD_TRANSIT) before customs has
// released it (PORT_CLEARANCE), regardless of what the status dropdown
// lets you pick. This is the same "out of order" rule findStageSkipAlert
// flags on the dashboard, enforced here as a hard block instead of just a
// warning, since these three are the paperwork-gated milestones (not
// purely physical events like arrival, which the ETA/road-transit
// auto-advance cron jobs already set without any document check).
const MANUAL_STATUS_DOCUMENT_GATE: Partial<
  Record<ShipmentStatus, { requiredStage: DocumentStage; message: string }>
> = {
  CUSTOMS_CLEARED: {
    requiredStage: "ENTRY_LEVEL",
    message:
      "Upload and verify the Stage 1 entry documents (Commercial Invoice, Packing List, BL, COA) before marking as Customs Cleared.",
  },
  LOADED_ROAD_TRANSIT: {
    requiredStage: "PORT_CLEARANCE",
    message:
      "Upload and verify a Stage 2 customs declaration (WH7/T1/IM4) before marking as Loaded on Truck.",
  },
  OFFLOADED: {
    requiredStage: "ROAD_TRANSIT",
    message:
      "Record Stage 3 road transit details, or finalize the transit rate sheet, before marking as Offloaded.",
  },
}

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
  await requireShipmentAccess(session, parsed.shipmentId)

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

  if (SHIPMENT_STATUS_ORDER.indexOf(parsed.status) < SHIPMENT_STATUS_ORDER.indexOf(shipment.status)) {
    throw new Error(
      `Status can't move backward from "${SHIPMENT_STATUS_LABELS[shipment.status]}" to "${SHIPMENT_STATUS_LABELS[parsed.status]}" -- its containers may have already advanced past that point.`
    )
  }

  const gate = MANUAL_STATUS_DOCUMENT_GATE[parsed.status]
  if (gate) {
    const [docs, rateSheet] = await Promise.all([
      prisma.document.findMany({
        where: { shipmentId: parsed.shipmentId, stage: { not: null }, type: { not: null } },
        select: { stage: true, type: true, isVerified: true },
      }),
      prisma.transitRateSheet.findUnique({
        where: { shipmentId: parsed.shipmentId },
        select: { finalizedAt: true },
      }),
    ])
    const structuredDocs = docs.filter(
      (d): d is { stage: DocumentStage; type: NonNullable<typeof d.type>; isVerified: boolean } =>
        d.stage !== null && d.type !== null
    )
    const complete = isStageComplete(gate.requiredStage, structuredDocs, {
      rateSheetFinalized: rateSheet?.finalizedAt != null,
    })
    if (!complete) {
      throw new Error(gate.message)
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
