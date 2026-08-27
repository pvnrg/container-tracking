import Link from "next/link"

import { auth } from "@/auth"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
  SHIPMENT_STATUS_LABELS,
} from "@/lib/shipment-labels"

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
            render={<Link href="/shipments/new">New Shipment</Link>}
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
            </TableRow>
          </TableHeader>
          <TableBody>
            {shipments.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-center text-muted-foreground"
                >
                  No shipments yet.
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
                  <Badge variant="secondary">
                    {SHIPMENT_STATUS_LABELS[s.status]}
                  </Badge>
                </TableCell>
                <TableCell>{s.currentEta.toLocaleDateString()}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
