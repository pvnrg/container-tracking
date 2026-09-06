import Link from "next/link"
import { Plus, X } from "lucide-react"
import { Prisma, ShipmentStatus } from "@prisma/client"

import { auth } from "@/auth"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { prisma } from "@/lib/prisma"
import {
  ARRIVED_OR_LATER_STATUSES,
  AT_PORT_STATUSES,
  INLAND_TRANSIT_STATUSES,
  SHIPMENT_STATUS_LABELS,
} from "@/lib/shipment-labels"

import { ShipmentsTable } from "./shipments-table"

const FILTER_LABELS: Record<string, string> = {
  active: "Active",
  overdue: "Overdue ETAs",
  "docs-pending": "Pending Doc. Verifications",
  "at-port": "At Port of Discharge",
  "inland-transit": "Inland Transit",
  ...SHIPMENT_STATUS_LABELS,
}

function buildWhere(status: string | undefined): Prisma.ShipmentWhereInput {
  switch (status) {
    case "active":
      return { status: { not: "COMPLETED" } }
    case "overdue":
      return {
        currentEta: { lt: new Date() },
        status: { notIn: ARRIVED_OR_LATER_STATUSES },
      }
    case "docs-pending":
      return { documents: { some: { isVerified: false } } }
    case "at-port":
      return { status: { in: AT_PORT_STATUSES } }
    case "inland-transit":
      return { status: { in: INLAND_TRANSIT_STATUSES } }
    case undefined:
      return {}
    default:
      return { status: status as ShipmentStatus }
  }
}

export default async function ShipmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const { status } = await searchParams
  const session = await auth()
  const canCreate =
    session?.user.role === "ADMIN" || session?.user.role === "LOGISTICS_OPERATOR"

  const shipments = await prisma.shipment.findMany({
    where: buildWhere(status),
    orderBy: { currentEta: "asc" },
    include: { _count: { select: { containers: true } } },
  })

  const filterLabel = status ? FILTER_LABELS[status] : undefined

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Shipments</h1>
        {canCreate && (
          <Button
            nativeButton={false}
            render={
              <Link href="/shipments/new">
                <Plus data-icon="inline-start" />
                New Shipment
              </Link>
            }
          />
        )}
      </div>

      {filterLabel && (
        <div>
          <Link href="/shipments">
            <Badge
              variant="outline"
              className="cursor-pointer gap-1 hover:bg-muted/50"
            >
              Filtered by: {filterLabel}
              <X className="size-3" />
            </Badge>
          </Link>
        </div>
      )}

      <ShipmentsTable
        shipments={shipments.map((s) => ({
          id: s.id,
          blNumber: s.blNumber,
          shippingLine: s.shippingLine,
          dischargePort: s.dischargePort,
          containerCount: s._count.containers,
          status: s.status,
          currentEta: s.currentEta,
          actualDischargeDate: s.actualDischargeDate,
          transitStartedAt: s.transitStartedAt,
          transitArrivalEta: s.transitArrivalEta,
          destinationWarehouse: s.destinationWarehouse,
        }))}
        canManage={canCreate}
        presetFilterLabel={filterLabel}
      />
    </div>
  )
}
