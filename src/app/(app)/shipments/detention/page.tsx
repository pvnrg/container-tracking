import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { ARRIVED_OR_LATER_STATUSES } from "@/lib/shipment-labels"

import { DetentionTable } from "./detention-table"

export default async function DetentionPage() {
  const session = await auth()
  const canAccess =
    session?.user.role === "ADMIN" || session?.user.role === "LOGISTICS_OPERATOR"

  if (!canAccess) {
    redirect("/shipments")
  }

  const containers = await prisma.container.findMany({
    where: {
      shipment: { status: { in: ARRIVED_OR_LATER_STATUSES } },
    },
    include: {
      shipment: { select: { id: true, blNumber: true } },
      detentionTracker: true,
    },
  })

  const sorted = [...containers].sort((a, b) => {
    const aReturned = !!a.detentionTracker?.returnedToDepotDate
    const bReturned = !!b.detentionTracker?.returnedToDepotDate
    if (aReturned !== bReturned) return aReturned ? 1 : -1

    if (!a.detentionTracker && !b.detentionTracker) return 0
    if (!a.detentionTracker) return -1
    if (!b.detentionTracker) return 1

    return (
      a.detentionTracker.deadlineDate!.getTime() -
      b.detentionTracker.deadlineDate!.getTime()
    )
  })

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Detention Tracking</h1>
        <p className="text-sm text-muted-foreground">
          30-day free-time clock from seaport discharge to empty container
          return.
        </p>
      </div>
      <DetentionTable containers={sorted} />
    </div>
  )
}
