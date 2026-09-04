"use server"

import { z } from "zod"
import { revalidatePath } from "next/cache"
import { BlType, DischargePort, Prisma, RwandanDestination } from "@prisma/client"

import { logShipmentAudit } from "@/lib/audit"
import { prisma } from "@/lib/prisma"
import { requireRole } from "@/lib/auth-utils"

const containerSchema = z.object({
  containerNumber: z.string().min(1, "Container number is required"),
  containerType: z.string().min(1, "Container type is required"),
  sealNumber: z.string().optional(),
  grossWeightKg: z.number({ message: "Gross weight is required" }),
  inventoryReference: z.string().min(1, "Inventory reference is required"),
  itemQuantity: z.number().int({ message: "Item quantity is required" }),
})

const shipmentSchema = z.object({
  blNumber: z.string().min(1, "BL number is required"),
  blType: z.nativeEnum(BlType),
  shippingLine: z.string().min(1, "Shipping line is required"),
  originCountry: z.string().min(1, "Origin country is required"),
  originPort: z.string().min(1, "Origin port is required"),
  dischargePort: z.nativeEnum(DischargePort),
  destinationWarehouse: z.nativeEnum(RwandanDestination),
  shipperName: z.string().min(1, "Shipper is required"),
  consigneeName: z.string().min(1, "Consignee is required"),
  notifyParty: z.string().min(1, "Notify party is required"),
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
        blType: parsed.blType,
        shippingLine: parsed.shippingLine,
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
            grossWeightKg: c.grossWeightKg ?? null,
            inventoryReference: c.inventoryReference,
            itemQuantity: c.itemQuantity ?? null,
          })),
        },
      },
    })

    await logShipmentAudit({
      shipmentId: shipment.id,
      userId: session.user.id,
      action: "SHIPMENT_CREATED",
      newValue: {
        blNumber: shipment.blNumber,
        containerCount: parsed.containers.length,
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

export async function assignTransporter(input: {
  shipmentId: string
  transporterId: string
}) {
  const session = await requireRole(["ADMIN", "LOGISTICS_OPERATOR"])
  const parsed = z
    .object({
      shipmentId: z.string().min(1),
      transporterId: z.string().min(1),
    })
    .parse(input)

  const transporter = await prisma.user.findUnique({
    where: { id: parsed.transporterId },
  })
  if (!transporter || transporter.role !== "TRANSPORTER") {
    throw new Error("Selected user is not a transporter")
  }

  const previous = await prisma.shipment.findUnique({
    where: { id: parsed.shipmentId },
    select: { transporter: { select: { name: true } } },
  })

  await prisma.shipment.update({
    where: { id: parsed.shipmentId },
    data: { transporterId: parsed.transporterId },
  })

  await logShipmentAudit({
    shipmentId: parsed.shipmentId,
    userId: session.user.id,
    action: "TRANSPORTER_ASSIGNED",
    oldValue: { transporterName: previous?.transporter?.name ?? null },
    newValue: { transporterName: transporter.name },
  })

  revalidatePath(`/shipments/${parsed.shipmentId}`)
}
