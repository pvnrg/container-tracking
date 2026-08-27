"use server"

import { z } from "zod"
import { revalidatePath } from "next/cache"
import { DischargePort, Prisma, RwandanDestination } from "@prisma/client"

import { prisma } from "@/lib/prisma"
import { requireRole } from "@/lib/auth-utils"

const containerSchema = z.object({
  containerNumber: z.string().min(1, "Container number is required"),
  containerType: z.string().min(1, "Container type is required"),
  sealNumber: z.string().optional(),
  tareWeightKg: z.number().optional(),
  grossWeightKg: z.number().optional(),
  inventoryReference: z.string().min(1, "Inventory reference is required"),
  itemQuantity: z.number().int().optional(),
})

const shipmentSchema = z.object({
  blNumber: z.string().min(1, "BL number is required"),
  shippingLine: z.string().min(1, "Shipping line is required"),
  vesselName: z.string().optional(),
  voyageNumber: z.string().optional(),
  bookingRef: z.string().optional(),
  originCountry: z.string().min(1, "Origin country is required"),
  originPort: z.string().optional(),
  dischargePort: z.nativeEnum(DischargePort),
  destinationWarehouse: z.nativeEnum(RwandanDestination).optional(),
  shipperName: z.string().optional(),
  consigneeName: z.string().optional(),
  notifyParty: z.string().optional(),
  currentEta: z.string().min(1, "Current ETA is required"),
  containers: z
    .array(containerSchema)
    .min(1, "Add at least one container"),
})

export type ShipmentFormValues = z.infer<typeof shipmentSchema>

export async function createShipment(values: ShipmentFormValues) {
  const session = await requireRole(["ADMIN", "LOGISTICS_OPERATOR"])
  const parsed = shipmentSchema.parse(values)

  try {
    const shipment = await prisma.shipment.create({
      data: {
        blNumber: parsed.blNumber,
        shippingLine: parsed.shippingLine,
        vesselName: parsed.vesselName || null,
        voyageNumber: parsed.voyageNumber || null,
        bookingRef: parsed.bookingRef || null,
        originCountry: parsed.originCountry,
        originPort: parsed.originPort || null,
        dischargePort: parsed.dischargePort,
        destinationWarehouse: parsed.destinationWarehouse || null,
        shipperName: parsed.shipperName || null,
        consigneeName: parsed.consigneeName || null,
        notifyParty: parsed.notifyParty || null,
        currentEta: new Date(parsed.currentEta),
        createdById: session.user.id,
        containers: {
          create: parsed.containers.map((c) => ({
            containerNumber: c.containerNumber,
            containerType: c.containerType,
            sealNumber: c.sealNumber || null,
            tareWeightKg: c.tareWeightKg ?? null,
            grossWeightKg: c.grossWeightKg ?? null,
            inventoryReference: c.inventoryReference,
            itemQuantity: c.itemQuantity ?? null,
          })),
        },
      },
    })

    revalidatePath("/shipments")
    return { id: shipment.id }
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      throw new Error("A shipment with this BL number already exists.")
    }
    throw err
  }
}
