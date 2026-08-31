import { notFound } from "next/navigation"

import { auth } from "@/auth"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
  DESTINATION_WAREHOUSE_LABELS,
  DISCHARGE_PORT_LABELS,
  SHIPMENT_STATUS_LABELS,
} from "@/lib/shipment-labels"

import { DocumentsPanel } from "./documents-panel"
import { TransporterAssign } from "./transporter-assign"

export default async function ShipmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const session = await auth()
  const canManageDocuments =
    session?.user.role === "ADMIN" || session?.user.role === "LOGISTICS_OPERATOR"

  const shipment = await prisma.shipment.findUnique({
    where: { id },
    include: {
      containers: { orderBy: { containerNumber: "asc" } },
      createdBy: { select: { name: true } },
      transporter: { select: { name: true } },
      documents: {
        include: { uploadedBy: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
  })

  if (!shipment) {
    notFound()
  }

  const transporters = canManageDocuments
    ? await prisma.user.findMany({
        where: { role: "TRANSPORTER", isActive: true },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      })
    : []

  const details: [string, React.ReactNode][] = [
    ["Shipping Line", shipment.shippingLine],
    ["Vessel / Voyage", [shipment.vesselName, shipment.voyageNumber].filter(Boolean).join(" / ") || "—"],
    ["Booking Reference", shipment.bookingRef ?? "—"],
    ["Origin", [shipment.originPort, shipment.originCountry].filter(Boolean).join(", ")],
    ["Discharge Port", DISCHARGE_PORT_LABELS[shipment.dischargePort]],
    [
      "Destination Warehouse",
      shipment.destinationWarehouse
        ? DESTINATION_WAREHOUSE_LABELS[shipment.destinationWarehouse]
        : "Not yet allocated",
    ],
    ["Shipper", shipment.shipperName ?? "—"],
    ["Consignee", shipment.consigneeName ?? "—"],
    ["Notify Party", shipment.notifyParty ?? "—"],
    ["Current ETA", shipment.currentEta.toLocaleDateString()],
    ["Created By", shipment.createdBy.name],
    [
      "Transporter",
      canManageDocuments ? (
        <TransporterAssign
          shipmentId={shipment.id}
          currentTransporterId={shipment.transporterId}
          transporters={transporters}
        />
      ) : (
        (shipment.transporter?.name ?? "Not yet assigned")
      ),
    ],
  ]

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{shipment.blNumber}</h1>
          <p className="text-sm text-muted-foreground">
            {shipment.containers.length} container
            {shipment.containers.length === 1 ? "" : "s"}
          </p>
        </div>
        <Badge variant="secondary">
          {SHIPMENT_STATUS_LABELS[shipment.status]}
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Shipment Details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
          {details.map(([label, value]) => (
            <div key={label} className="flex flex-col gap-0.5">
              <span className="text-xs text-muted-foreground">{label}</span>
              <span className="text-sm">{value}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Containers</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Container Number</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Seal Number</TableHead>
                <TableHead>Tare (kg)</TableHead>
                <TableHead>Gross (kg)</TableHead>
                <TableHead>Inventory Reference</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shipment.containers.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">
                    {c.containerNumber}
                  </TableCell>
                  <TableCell>{c.containerType}</TableCell>
                  <TableCell>{c.sealNumber ?? "—"}</TableCell>
                  <TableCell>{c.tareWeightKg?.toString() ?? "—"}</TableCell>
                  <TableCell>{c.grossWeightKg?.toString() ?? "—"}</TableCell>
                  <TableCell>{c.inventoryReference}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{c.status}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <DocumentsPanel
        shipmentId={shipment.id}
        documents={shipment.documents}
        canManage={canManageDocuments}
      />
    </div>
  )
}
