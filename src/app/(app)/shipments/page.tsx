import Link from "next/link"
import { Plus, X } from "lucide-react"
import { Prisma, ShipmentStatus } from "@prisma/client"

import { auth } from "@/auth"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/empty-state"
import { ContainerStackIllustration } from "@/components/illustrations/container-stack"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { prisma } from "@/lib/prisma"
import {
  ARRIVED_OR_LATER_STATUSES,
  DISCHARGE_PORT_LABELS,
  INLAND_TRANSIT_STATUSES,
  SHIPMENT_STATUS_BADGE_CLASSES,
  SHIPMENT_STATUS_LABELS,
} from "@/lib/shipment-labels"

import { ShipmentDeleteButton } from "./shipment-delete-button"
import { ShipmentEditDialog } from "./shipment-edit-dialog"

const FILTER_LABELS: Record<string, string> = {
  active: "Active",
  overdue: "Overdue ETAs",
  "docs-pending": "Pending Doc. Verifications",
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

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>BL Number</TableHead>
              <TableHead>Shipping Line</TableHead>
              <TableHead>Discharge Port</TableHead>
              <TableHead>Containers</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Current ETA</TableHead>
              {canCreate && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {shipments.length === 0 && (
              <TableRow>
                <TableCell colSpan={canCreate ? 7 : 6} className="p-0">
                  <EmptyState
                    illustration={
                      <ContainerStackIllustration className="w-40 opacity-80" />
                    }
                    title={filterLabel ? "No matching shipments" : "No shipments yet"}
                    description={
                      filterLabel
                        ? `No shipments match "${filterLabel}".`
                        : canCreate
                          ? "Create your first shipment to start tracking it."
                          : "Shipments will appear here once one is created."
                    }
                  />
                </TableCell>
              </TableRow>
            )}
            {shipments.map((s) => (
              <TableRow key={s.id}>
                <TableCell>
                  <Link
                    href={`/shipments/${s.id}`}
                    className="font-medium hover:underline"
                  >
                    {s.blNumber}
                  </Link>
                </TableCell>
                <TableCell>{s.shippingLine}</TableCell>
                <TableCell>{DISCHARGE_PORT_LABELS[s.dischargePort]}</TableCell>
                <TableCell>{s._count.containers}</TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={SHIPMENT_STATUS_BADGE_CLASSES[s.status]}
                  >
                    {SHIPMENT_STATUS_LABELS[s.status]}
                  </Badge>
                </TableCell>
                <TableCell>{s.currentEta.toLocaleDateString()}</TableCell>
                {canCreate && (
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <ShipmentEditDialog
                        shipment={{
                          id: s.id,
                          blNumber: s.blNumber,
                          status: s.status,
                          currentEta: s.currentEta,
                          actualDischargeDate: s.actualDischargeDate,
                          transitStartedAt: s.transitStartedAt,
                          transitArrivalEta: s.transitArrivalEta,
                          destinationWarehouse: s.destinationWarehouse,
                        }}
                      />
                      <ShipmentDeleteButton shipmentId={s.id} blNumber={s.blNumber} />
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
