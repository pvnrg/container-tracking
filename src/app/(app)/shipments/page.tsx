import Link from "next/link"
import { Plus } from "lucide-react"

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
  DISCHARGE_PORT_LABELS,
  SHIPMENT_STATUS_BADGE_CLASSES,
  SHIPMENT_STATUS_LABELS,
} from "@/lib/shipment-labels"

import { ShipmentEditDialog } from "./shipment-edit-dialog"

export default async function ShipmentsPage() {
  const session = await auth()
  const canCreate =
    session?.user.role === "ADMIN" || session?.user.role === "LOGISTICS_OPERATOR"

  const shipments = await prisma.shipment.findMany({
    orderBy: { currentEta: "asc" },
    include: { _count: { select: { containers: true } } },
  })

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
                    title="No shipments yet"
                    description={
                      canCreate
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
