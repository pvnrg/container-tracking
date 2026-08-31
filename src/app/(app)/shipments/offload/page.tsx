import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

import { OffloadTable } from "./offload-table"

export default async function OffloadPage() {
  const session = await auth()
  const canAccess =
    session?.user.role === "ADMIN" || session?.user.role === "LOGISTICS_OPERATOR"

  if (!canAccess) {
    redirect("/shipments")
  }

  const containers = await prisma.container.findMany({
    where: {
      shipment: {
        status: {
          in: ["LOADED_ROAD_TRANSIT", "ARRIVED_DESTINATION", "OFFLOADED", "COMPLETED"],
        },
      },
    },
    include: {
      shipment: {
        select: { id: true, blNumber: true, destinationWarehouse: true },
      },
    },
    orderBy: [{ offloadScheduledAt: "asc" }, { containerNumber: "asc" }],
  })

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Offload Scheduling</h1>
        <p className="text-sm text-muted-foreground">
          Schedule and confirm container offload at the destination warehouse.
        </p>
      </div>
      <OffloadTable containers={containers} />
    </div>
  )
}
