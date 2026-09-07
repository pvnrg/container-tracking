import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { summarizeContainerProducts } from "@/lib/container-products"
import { prisma } from "@/lib/prisma"

import { TrackingTable } from "./tracking-table"

export default async function TrackingPage() {
  const session = await auth()
  const canAccess =
    session?.user.role === "ADMIN" || session?.user.role === "LOGISTICS_OPERATOR"

  if (!canAccess) {
    redirect("/shipments")
  }

  const rows = await prisma.shipment.findMany({
    orderBy: { currentEta: "asc" },
    select: {
      id: true,
      blNumber: true,
      shippingLine: true,
      vesselName: true,
      dischargePort: true,
      status: true,
      currentEta: true,
      shipperName: true,
      containers: { select: { inventoryReference: true } },
    },
  })

  const shipments = rows.map((s) => ({
    id: s.id,
    blNumber: s.blNumber,
    shippingLine: s.shippingLine,
    vesselName: s.vesselName,
    dischargePort: s.dischargePort,
    status: s.status,
    currentEta: s.currentEta,
    shipperName: s.shipperName,
    products: summarizeContainerProducts(s.containers) ?? null,
  }))

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">ETA & Status Tracking</h1>
        <p className="text-sm text-muted-foreground">
          Update ocean ETAs and shipment milestones. Changes save per row.
        </p>
      </div>
      <TrackingTable shipments={shipments} />
    </div>
  )
}
