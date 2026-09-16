import Link from "next/link"
import { notFound } from "next/navigation"
import type { DocumentStage, DocumentType } from "@prisma/client"
import {
  ArrowLeft,
  CalendarClock,
  Container,
  FileText,
  History,
  MapPinned,
  Users,
} from "lucide-react"

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
import { cn } from "@/lib/utils"
import {
  BL_TYPE_LABELS,
  CONTAINER_STATUS_BADGE_CLASSES,
  CONTAINER_STATUS_LABELS,
  DESTINATION_WAREHOUSE_LABELS,
  DISCHARGE_PORT_LABELS,
  SHIPMENT_STATUS_BADGE_CLASSES,
  SHIPMENT_STATUS_LABELS,
} from "@/lib/shipment-labels"
import { buildShipmentTimeline, type StatusChangeEvent } from "@/lib/shipment-timeline"

import { DocumentsPanel } from "./documents-panel"
import { GeneralDocumentsPanel } from "./general-documents-panel"
import { ShipmentTimelineCard } from "./shipment-timeline"
import { TaxPaymentCard } from "./tax-payment-card"
import { ShipmentDeleteButton } from "../shipment-delete-button"
import { ShipmentEditDialog } from "../shipment-edit-dialog"

// Placeholder text used throughout detailGroups below for a field with no
// value yet -- rendered softer than a real value so the two read as
// distinct at a glance instead of looking like equally-weighted data.
const EMPTY_FIELD_VALUES = new Set(["—", "Not yet allocated"])

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
      transitRateSheet: {
        include: { lineItems: { orderBy: { sortOrder: "asc" } } },
      },
      auditLogs: {
        include: { user: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
  })

  if (!shipment) {
    notFound()
  }
  // Same as a normal 404 -- doesn't reveal that a shipment with this id
  // exists to an account restricted to its own data but not the owner.
  if (session?.user.restrictToOwnData && shipment.createdById !== session.user.id) {
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

  const rateSheet = shipment.transitRateSheet
    ? {
        invoiceNumber: shipment.transitRateSheet.invoiceNumber,
        currency: shipment.transitRateSheet.currency,
        finalizedAt: shipment.transitRateSheet.finalizedAt,
        lineItems: shipment.transitRateSheet.lineItems.map((li) => ({
          description: li.description,
          amount: li.amount.toString(),
        })),
      }
    : null

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

  const statusEvents = shipment.auditLogs
    .filter(
      (e): e is typeof e & { action: "STATUS_UPDATED" | "STATUS_AUTO_UPDATED" } =>
        e.action === "STATUS_UPDATED" || e.action === "STATUS_AUTO_UPDATED"
    )
    .map(
      (e): StatusChangeEvent => ({
        createdAt: e.createdAt,
        action: e.action,
        oldValue: e.oldValue,
        newValue: e.newValue,
      })
    )
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())

  const timelineSegments = buildShipmentTimeline({
    createdAt: shipment.createdAt,
    currentStatus: shipment.status,
    statusEvents,
  })
  const generalDocuments = shipment.documents.filter((d) => d.stage === null)

  const detailGroups: {
    heading: string
    icon: typeof MapPinned
    iconClass: string
    fields: [string, React.ReactNode][]
  }[] = [
    {
      heading: "Route & Cargo",
      icon: MapPinned,
      iconClass: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
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
      iconClass: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
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
      iconClass: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
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

      <ShipmentTimelineCard segments={timelineSegments} currentStatus={shipment.status} />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              <FileText className="size-3.5" />
            </span>
            Shipment Details
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          {detailGroups.map((group, i) => (
            <div key={group.heading}>
              {i > 0 && <Separator className="mb-5" />}
              <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                <span
                  className={cn(
                    "flex size-5 items-center justify-center rounded-full",
                    group.iconClass
                  )}
                >
                  <group.icon className="size-3" />
                </span>
                {group.heading}
              </h3>
              <div className="grid grid-cols-1 gap-x-6 gap-y-3.5 sm:grid-cols-2 lg:grid-cols-3">
                {group.fields.map(([label, value]) => {
                  const isEmpty =
                    typeof value === "string" && EMPTY_FIELD_VALUES.has(value)
                  return (
                    <div key={label} className="flex flex-col gap-0.5">
                      <span className="text-xs text-muted-foreground">{label}</span>
                      <span
                        className={cn(
                          "text-sm",
                          isEmpty
                            ? "text-muted-foreground/70 italic"
                            : "font-medium text-foreground"
                        )}
                      >
                        {value}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-full bg-violet-500/10 text-violet-600 dark:text-violet-400">
              <Container className="size-3.5" />
            </span>
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
        blNumber={shipment.blNumber}
        shipperName={shipment.shipperName}
        consigneeName={shipment.consigneeName}
        documents={structuredDocuments}
        stageAgents={stageAgents}
        containers={shipment.containers}
        transitDetailsByContainerId={transitDetailsByContainerId}
        transportCompanyNames={transportCompanies.map((t) => t.name)}
        truckStatusUpdatesByContainerId={truckStatusUpdatesByContainerId}
        rateSheet={rateSheet}
        canManage={canManageDocuments}
      />

      <GeneralDocumentsPanel
        shipmentId={shipment.id}
        documents={generalDocuments}
        canManage={canManageDocuments}
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-full bg-slate-500/10 text-slate-600 dark:text-slate-400">
              <History className="size-3.5" />
            </span>
            Activity Log
          </CardTitle>
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
