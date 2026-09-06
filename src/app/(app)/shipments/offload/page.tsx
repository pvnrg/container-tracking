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
    select: {
      id: true,
      containerNumber: true,
      inventoryReference: true,
      status: true,
      offloadScheduledAt: true,
      actualOffloadedAt: true,
      createdAt: true,
      shipment: {
        select: { id: true, blNumber: true, destinationWarehouse: true },
      },
    },
    orderBy: [{ offloadScheduledAt: "asc" }, { containerNumber: "asc" }],
  })

  // Only one container per shipment may be offloaded at a time (see the
  // matching guard in confirmContainerOffload) -- compute which container,
  // if any, is currently blocking each row's Confirm action so the UI can
  // disable it up front instead of waiting on a rejected server call.
  const containersByShipment = new Map<string, typeof containers>()
  for (const c of containers) {
    const list = containersByShipment.get(c.shipment.id) ?? []
    list.push(c)
    containersByShipment.set(c.shipment.id, list)
  }

  const blockingContainerNumberById = new Map<string, string>()
  for (const list of containersByShipment.values()) {
    const inProgress = list
      .filter((c) => c.offloadScheduledAt && !c.actualOffloadedAt)
      .sort((a, b) => {
        const scheduleDiff =
          a.offloadScheduledAt!.getTime() - b.offloadScheduledAt!.getTime()
        return scheduleDiff !== 0 ? scheduleDiff : a.createdAt.getTime() - b.createdAt.getTime()
      })
    const current = inProgress[0]
    if (!current) continue
    for (const c of list) {
      if (c.id !== current.id && !c.actualOffloadedAt) {
        blockingContainerNumberById.set(c.id, current.containerNumber)
      }
    }
  }

  const containersWithBlockState = containers.map((c) => ({
    ...c,
    blockedByContainerNumber: blockingContainerNumberById.get(c.id) ?? null,
  }))

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Offload Scheduling</h1>
        <p className="text-sm text-muted-foreground">
          Schedule and confirm container offload at the destination warehouse.
          Only one container per shipment can be offloaded at a time.
        </p>
      </div>
      <OffloadTable containers={containersWithBlockState} />
    </div>
  )
}
