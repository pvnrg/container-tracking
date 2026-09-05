import Link from "next/link"
import { notFound } from "next/navigation"
import type { DocumentStage, DocumentType } from "@prisma/client"
import { ArrowLeft, CalendarClock, Container, MapPinned, Users } from "lucide-react"

import { auth } from "@/auth"
import { AUDIT_ACTION_LABELS, describeAuditEntry } from "@/lib/audit"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { EmptyState } from "@/components/empty-state"
import { Separator } from "@/components/ui/separator"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatDateTime } from "@/lib/format"
import { prisma } from "@/lib/prisma"
import {
  BL_TYPE_LABELS,
  CONTAINER_STATUS_BADGE_CLASSES,
  CONTAINER_STATUS_LABELS,
  DESTINATION_WAREHOUSE_LABELS,
  DISCHARGE_PORT_LABELS,
  SHIPMENT_STATUS_BADGE_CLASSES,
  SHIPMENT_STATUS_LABELS,
} from "@/lib/shipment-labels"

import { DocumentsPanel } from "./documents-panel"
import { GeneralDocumentsPanel } from "./general-documents-panel"
import { TaxPaymentCard } from "./tax-payment-card"
import { ShipmentDeleteButton } from "../shipment-delete-button"
import { ShipmentEditDialog } from "../shipment-edit-dialog"

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
      containers: {
        orderBy: { containerNumber: "asc" },
        include: {
          transitDetails: {
            include: { drivers: { orderBy: { createdAt: "asc" } } },
          },
          truckStatusUpdates: {
            include: { createdBy: { select: { name: true } } },
            orderBy: { timestamp: "desc" },
          },
        },
      },
      createdBy: { select: { name: true } },
      documents: {
        include: { uploadedBy: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
      },
      stageAgents: true,
      auditLogs: {
        include: { user: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
  })

  if (!shipment) {
    notFound()
  }

  const stageAgents = Object.fromEntries(
    shipment.stageAgents.map((a) => [
      a.stage,
      { name: a.name, contact: a.contact, position: a.position },
    ])
  ) as Partial<Record<DocumentStage, { name: string; contact: string; position: string | null }>>

  const transitDetailsByContainerId = Object.fromEntries(
    shipment.containers
      .filter((c) => c.transitDetails !== null)
      .map((c) => [c.id, c.transitDetails!])
  )

  const truckStatusUpdatesByContainerId = Object.fromEntries(
    shipment.containers.map((c) => [c.id, c.truckStatusUpdates])
  )

  const transportCompanies = canManageDocuments
    ? await prisma.transportCompany.findMany({
        select: { name: true },
        orderBy: { name: "asc" },
      })
    : []

  const structuredDocuments = shipment.documents.filter(
    (d): d is typeof d & { stage: DocumentStage; type: DocumentType } =>
      d.stage !== null && d.type !== null
  )
  const generalDocuments = shipment.documents.filter((d) => d.stage === null)

  const detailGroups: {
    heading: string
    icon: typeof MapPinned
    fields: [string, React.ReactNode][]
  }[] = [
    {
      heading: "Route & Cargo",
      icon: MapPinned,
      fields: [
        ["BL Type", BL_TYPE_LABELS[shipment.blType]],
        ["Shipping Line", shipment.shippingLine],
        [
          "Origin",
          [shipment.originPort, shipment.originCountry].filter(Boolean).join(", "),
        ],
        ["Discharge Port", DISCHARGE_PORT_LABELS[shipment.dischargePort]],
        [
          "Destination Warehouse",
          shipment.destinationWarehouse
            ? DESTINATION_WAREHOUSE_LABELS[shipment.destinationWarehouse]
            : "Not yet allocated",
        ],
      ],
    },
    {
      heading: "Parties",
      icon: Users,
      fields: [
        ["Shipper", shipment.shipperName ?? "—"],
        ["Consignee", shipment.consigneeName ?? "—"],
        ["Notify Party", shipment.notifyParty ?? "—"],
        ["Created By", shipment.createdBy.name],
        // Transporter assignment is hidden for now (unused) -- it still
        // drives the "Ready to Load" and detention-reminder notifications
        // via Shipment.transporterId, so TransporterAssign, assignTransporter,
        // and that notification logic are untouched. Re-add a field here
        // (see TransporterAssign in transporter-assign.tsx) to bring it back.
      ],
    },
    {
      heading: "Timeline",
      icon: CalendarClock,
      fields: [
        ["Current ETA", shipment.currentEta.toLocaleDateString()],
        [
          "Arrived at Port",
          shipment.actualDischargeDate
            ? formatDateTime(shipment.actualDischargeDate)
            : "—",
        ],
        [
          "Transit Started",
          shipment.transitStartedAt ? formatDateTime(shipment.transitStartedAt) : "—",
        ],
        [
          "Transit Expected Arrival",
          shipment.transitArrivalEta
            ? formatDateTime(shipment.transitArrivalEta)
            : "—",
        ],
      ],
    },
  ]

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/shipments"
        className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" />
        Back to Shipments
      </Link>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{shipment.blNumber}</h1>
          <p className="text-sm text-muted-foreground">
            {shipment.containers.length} container
            {shipment.containers.length === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className={SHIPMENT_STATUS_BADGE_CLASSES[shipment.status]}
          >
            {SHIPMENT_STATUS_LABELS[shipment.status]}
          </Badge>
          {canManageDocuments && (
            <>
              <ShipmentEditDialog
                shipment={{
                  id: shipment.id,
                  blNumber: shipment.blNumber,
                  status: shipment.status,
                  currentEta: shipment.currentEta,
                  actualDischargeDate: shipment.actualDischargeDate,
                  transitStartedAt: shipment.transitStartedAt,
                  transitArrivalEta: shipment.transitArrivalEta,
                  destinationWarehouse: shipment.destinationWarehouse,
                }}
              />
              <ShipmentDeleteButton
                shipmentId={shipment.id}
                blNumber={shipment.blNumber}
                redirectTo="/shipments"
              />
            </>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Shipment Details</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          {detailGroups.map((group, i) => (
            <div key={group.heading}>
              {i > 0 && <Separator className="mb-5" />}
              <h3 className="mb-2.5 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                <group.icon className="size-3.5" />
                {group.heading}
              </h3>
              <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
                {group.fields.map(([label, value]) => (
                  <div key={label} className="flex flex-col gap-0.5">
                    <span className="text-xs text-muted-foreground">{label}</span>
                    <span className="text-sm">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Container className="size-4.5 text-muted-foreground" />
            Containers ({shipment.containers.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Container Number</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Seal Number</TableHead>
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
                  <TableCell>{c.grossWeightKg?.toString() ?? "—"}</TableCell>
                  <TableCell>{c.inventoryReference}</TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={CONTAINER_STATUS_BADGE_CLASSES[c.status]}
                    >
                      {CONTAINER_STATUS_LABELS[c.status]}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <TaxPaymentCard
        shipmentId={shipment.id}
        info={{
          isTaxPaid: shipment.isTaxPaid,
          taxLocation: shipment.taxLocation,
          taxReceivedBy: shipment.taxReceivedBy,
          taxAmount: shipment.taxAmount?.toString() ?? null,
          taxCurrency: shipment.taxCurrency,
          taxPaidAt: shipment.taxPaidAt,
        }}
        canManage={canManageDocuments}
      />

      <DocumentsPanel
        shipmentId={shipment.id}
        documents={structuredDocuments}
        stageAgents={stageAgents}
        containers={shipment.containers}
        transitDetailsByContainerId={transitDetailsByContainerId}
        transportCompanyNames={transportCompanies.map((t) => t.name)}
        truckStatusUpdatesByContainerId={truckStatusUpdatesByContainerId}
        canManage={canManageDocuments}
      />

      <GeneralDocumentsPanel
        shipmentId={shipment.id}
        documents={generalDocuments}
        canManage={canManageDocuments}
      />

      <Card>
        <CardHeader>
          <CardTitle>Activity Log</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {shipment.auditLogs.length === 0 && (
            <EmptyState
              icon={CalendarClock}
              title="No activity recorded yet"
              description="Status changes, uploads, and other updates will show up here."
            />
          )}
          {shipment.auditLogs.map((entry) => (
            <div
              key={entry.id}
              className="flex flex-col gap-0.5 border-b pb-3 text-sm last:border-b-0 last:pb-0"
            >
              <div className="flex items-center justify-between">
                <span className="font-medium">
                  {AUDIT_ACTION_LABELS[entry.action as keyof typeof AUDIT_ACTION_LABELS] ??
                    entry.action}
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatDateTime(entry.createdAt)}
                </span>
              </div>
              <p className="text-muted-foreground">
                {describeAuditEntry(entry)}
                {entry.user && ` — ${entry.user.name}`}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
