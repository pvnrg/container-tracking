import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

import { TrackingTable } from "./tracking-table"

export default async function TrackingPage() {
  const session = await auth()
  const canAccess =
    session?.user.role === "ADMIN" || session?.user.role === "LOGISTICS_OPERATOR"

  if (!canAccess) {
    redirect("/shipments")
  }

  const shipments = await prisma.shipment.findMany({
    orderBy: { currentEta: "asc" },
    select: {
      id: true,
      blNumber: true,
      shippingLine: true,
      vesselName: true,
      dischargePort: true,
      status: true,
      currentEta: true,
    },
  })

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
