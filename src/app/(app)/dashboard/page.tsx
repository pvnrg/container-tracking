import Link from "next/link"
import {
  Activity,
  AlertTriangle,
  Anchor,
  CalendarClock,
  CheckCircle2,
  CircleCheck,
  ClipboardList,
  Container,
  FileWarning,
  Flame,
  OctagonAlert,
  Package,
  Ship,
  Timer,
  Truck,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { EmptyState } from "@/components/empty-state"
import { HorizontalBarChart } from "@/components/horizontal-bar-chart"
import {
  DETENTION_RISK_CLASSES,
  DETENTION_RISK_LABELS,
  DetentionRiskLevel,
  getDetentionRisk,
} from "@/lib/detention"
import {
  describeStageSkipAlert,
  findStageSkipAlert,
  stageSkipBadgeLabel,
} from "@/lib/document-stage-alerts"
import { formatDate } from "@/lib/format"
import { prisma } from "@/lib/prisma"
import {
  ARRIVED_OR_LATER_STATUSES,
  AT_PORT_STATUSES,
  DISCHARGE_PORT_LABELS,
  INLAND_TRANSIT_STATUSES,
} from "@/lib/shipment-labels"
import { getStage2Gaps, STAGE2_GAP_LABELS } from "@/lib/stage2-readiness"
import { cn } from "@/lib/utils"

function daysUntil(date: Date) {
  return Math.round((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
}

export default async function DashboardPage() {
  const [
    total,
    inTransit,
    completed,
    active,
    overdueEtas,
    pendingDocVerifications,
  ] = await Promise.all([
    prisma.shipment.count(),
    prisma.shipment.count({ where: { status: "IN_TRANSIT_SEA" } }),
    prisma.shipment.count({ where: { status: "COMPLETED" } }),
    prisma.shipment.count({ where: { status: { not: "COMPLETED" } } }),
    prisma.shipment.count({
      where: {
        currentEta: { lt: new Date() },
        status: { notIn: ARRIVED_OR_LATER_STATUSES },
      },
    }),
    prisma.document.count({ where: { isVerified: false } }),
  ])

  // findMany (not count) for these -- the pipeline charts let you expand a
  // bucket to see exactly which shipments/containers are in it.
  const shipmentSelect = { id: true, blNumber: true } as const
  const [shipmentsAtSea, shipmentsAtPort, shipmentsInland, shipmentsCompleted] =
    await Promise.all([
      prisma.shipment.findMany({
        where: { status: { in: ["SHIPPED_ON_BOARD", "IN_TRANSIT_SEA"] } },
        select: shipmentSelect,
        orderBy: { blNumber: "asc" },
      }),
      prisma.shipment.findMany({
        // CUSTOMS_CLEARED sits here, not in "inland" -- cleared just means
        // ready to load, the cargo is still physically at the port until
        // it's actually LOADED_ROAD_TRANSIT, matching where its containers
        // sit in the Container Pipeline (still DISCHARGED_AT_PORT).
        where: { status: { in: AT_PORT_STATUSES } },
        select: shipmentSelect,
        orderBy: { blNumber: "asc" },
      }),
      prisma.shipment.findMany({
        where: { status: { in: INLAND_TRANSIT_STATUSES } },
        select: shipmentSelect,
        orderBy: { blNumber: "asc" },
      }),
      prisma.shipment.findMany({
        where: { status: { in: ["OFFLOADED", "COMPLETED"] } },
        select: shipmentSelect,
        orderBy: { blNumber: "asc" },
      }),
    ])

  const toShipmentDetails = (shipments: { id: string; blNumber: string }[]) =>
    shipments.map((s) => ({
      id: s.id,
      label: s.blNumber,
      href: `/shipments/${s.id}`,
    }))

  const pipelineItems = [
    { key: "at-sea", label: "At Sea", value: shipmentsAtSea.length, colorClass: "bg-chart-1", icon: <Ship className="size-3.5 shrink-0" />, details: toShipmentDetails(shipmentsAtSea) },
    { key: "at-port", label: "At Port / Customs", value: shipmentsAtPort.length, colorClass: "bg-chart-3", icon: <Anchor className="size-3.5 shrink-0" />, details: toShipmentDetails(shipmentsAtPort) },
    { key: "inland", label: "Inland Transit", value: shipmentsInland.length, colorClass: "bg-chart-4", icon: <Truck className="size-3.5 shrink-0" />, details: toShipmentDetails(shipmentsInland) },
    { key: "completed", label: "Completed", value: shipmentsCompleted.length, colorClass: "bg-chart-5", icon: <CheckCircle2 className="size-3.5 shrink-0" />, details: toShipmentDetails(shipmentsCompleted) },
  ]

  const containerSelect = {
    id: true,
    containerNumber: true,
    shipmentId: true,
    shipment: { select: { blNumber: true } },
  } as const
  const [
    containersOnVessel,
    containersAtPort,
    containersInland,
    containersCompleted,
  ] = await Promise.all([
    prisma.container.findMany({
      where: { status: "ON_VESSEL" },
      select: containerSelect,
      orderBy: { containerNumber: "asc" },
    }),
    prisma.container.findMany({
      where: { status: "DISCHARGED_AT_PORT" },
      select: containerSelect,
      orderBy: { containerNumber: "asc" },
    }),
    prisma.container.findMany({
      where: { status: { in: ["IN_TRANSIT_TRUCK", "DELIVERED_WAREHOUSE"] } },
      select: containerSelect,
      orderBy: { containerNumber: "asc" },
    }),
    prisma.container.findMany({
      where: { status: { in: ["OFFLOADED", "EMPTY_RETURNED_TO_DEPOT"] } },
      select: containerSelect,
      orderBy: { containerNumber: "asc" },
    }),
  ])

  const toContainerDetails = (
    containers: {
      id: string
      containerNumber: string
      shipmentId: string
      shipment: { blNumber: string }
    }[]
  ) =>
    containers.map((c) => ({
      id: c.id,
      label: `${c.containerNumber} · ${c.shipment.blNumber}`,
      href: `/shipments/${c.shipmentId}`,
    }))

  // Same journey-phase grouping and colors as pipelineItems above, so the
  // two charts read as directly comparable shipment-level vs.
  // container-level views of the same pipeline.
  const containerPipelineItems = [
    { key: "on-vessel", label: "On Vessel", value: containersOnVessel.length, colorClass: "bg-chart-1", icon: <Ship className="size-3.5 shrink-0" />, details: toContainerDetails(containersOnVessel) },
    { key: "at-port", label: "At Port", value: containersAtPort.length, colorClass: "bg-chart-3", icon: <Anchor className="size-3.5 shrink-0" />, details: toContainerDetails(containersAtPort) },
    { key: "inland", label: "Inland Transit", value: containersInland.length, colorClass: "bg-chart-4", icon: <Truck className="size-3.5 shrink-0" />, details: toContainerDetails(containersInland) },
    { key: "completed", label: "Completed", value: containersCompleted.length, colorClass: "bg-chart-5", icon: <CheckCircle2 className="size-3.5 shrink-0" />, details: toContainerDetails(containersCompleted) },
  ]

  // Neutral, always-relevant counts -- the day-to-day "where do things
  // stand" view. Actionable counts (overdue, unverified, gaps) live in the
  // attention strip below instead, so they aren't lost among steady-state
  // numbers.
  const stats = [
    {
      label: "Total Shipments",
      value: total,
      icon: Package,
      iconClass: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
      href: "/shipments",
    },
    {
      label: "Active",
      value: active,
      icon: Activity,
      iconClass: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
      href: "/shipments?status=active",
    },
    {
      label: "In-Transit (Ocean)",
      value: inTransit,
      icon: Ship,
      iconClass: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
      href: "/shipments?status=IN_TRANSIT_SEA",
    },
    {
      // Same shipmentsAtPort query that feeds the Shipment Pipeline chart's
      // "At Port / Customs" bucket below, so this tile can never drift out
      // of sync with it.
      label: "At Port of Discharge",
      value: shipmentsAtPort.length,
      icon: Anchor,
      iconClass: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
      href: "/shipments?status=at-port",
    },
    {
      // Same shipmentsInland query that feeds the Shipment Pipeline chart's
      // "Inland Transit" bucket below, so this tile can never drift out of
      // sync with it.
      label: "Inland Transit",
      value: shipmentsInland.length,
      icon: Truck,
      iconClass: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
      href: "/shipments?status=inland-transit",
    },
    {
      label: "Completed",
      value: completed,
      icon: CheckCircle2,
      iconClass: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
      href: "/shipments?status=COMPLETED",
    },
  ]

  const detentionRiskIcons: Record<DetentionRiskLevel, typeof CircleCheck> = {
    normal: CircleCheck,
    warning: AlertTriangle,
    critical: OctagonAlert,
    overdue: Flame,
  }

  const activeTrackers = await prisma.detentionTracker.findMany({
    where: { returnedToDepotDate: null, clockStartDate: { not: null } },
    select: {
      deadlineDate: true,
      container: {
        select: {
          containerNumber: true,
          shipment: { select: { id: true, blNumber: true } },
        },
      },
    },
  })

  const riskCounts: Record<DetentionRiskLevel, number> = {
    normal: 0,
    warning: 0,
    critical: 0,
    overdue: 0,
  }

  const riskItems = activeTrackers.map((tracker) => {
    const risk = getDetentionRisk(tracker.deadlineDate!)
    riskCounts[risk.level]++
    return {
      shipmentId: tracker.container.shipment.id,
      blNumber: tracker.container.shipment.blNumber,
      containerNumber: tracker.container.containerNumber,
      ...risk,
    }
  })

  const topAtRisk = [...riskItems]
    .sort((a, b) => a.daysRemaining - b.daysRemaining)
    .slice(0, 5)

  const detentionRiskBarColors: Record<DetentionRiskLevel, string> = {
    normal: "bg-emerald-500",
    warning: "bg-amber-500",
    critical: "bg-orange-500",
    overdue: "bg-red-500",
  }

  const detentionRiskItems = (Object.keys(riskCounts) as DetentionRiskLevel[]).map(
    (level) => {
      const RiskIcon = detentionRiskIcons[level]
      return {
        key: level,
        label: DETENTION_RISK_LABELS[level],
        value: riskCounts[level],
        colorClass: detentionRiskBarColors[level],
        icon: <RiskIcon className="size-3.5 shrink-0" />,
      }
    }
  )

  const upcomingShipments = await prisma.shipment.findMany({
    where: { status: { notIn: ARRIVED_OR_LATER_STATUSES } },
    select: { id: true, blNumber: true, dischargePort: true, currentEta: true },
    orderBy: { currentEta: "asc" },
    take: 5,
  })

  const shipmentsForDocCheck = await prisma.shipment.findMany({
    where: { status: { not: "COMPLETED" } },
    select: {
      id: true,
      blNumber: true,
      documents: { select: { stage: true, type: true, isVerified: true } },
      transitRateSheet: { select: { finalizedAt: true } },
    },
  })

  const stageSkipAlerts = shipmentsForDocCheck
    .map((s) => {
      const alert = findStageSkipAlert(s.documents, {
        rateSheetFinalized: s.transitRateSheet?.finalizedAt != null,
      })
      return alert ? { id: s.id, blNumber: s.blNumber, alert } : null
    })
    .filter((a): a is { id: string; blNumber: string; alert: NonNullable<ReturnType<typeof findStageSkipAlert>> } => a !== null)

  const arrivedShipments = await prisma.shipment.findMany({
    where: { status: "ARRIVED_PORT_OF_DISCHARGE" },
    select: {
      id: true,
      blNumber: true,
      stageAgents: { where: { stage: "PORT_CLEARANCE" }, select: { id: true } },
      documents: {
        where: { stage: "PORT_CLEARANCE" },
        select: { id: true },
      },
      containers: {
        select: { transitDetails: { select: { id: true } } },
      },
    },
  })

  const stage2Alerts = arrivedShipments
    .map((s) => ({
      id: s.id,
      blNumber: s.blNumber,
      gaps: getStage2Gaps({
        hasAgent: s.stageAgents.length > 0,
        hasCustomsDocument: s.documents.length > 0,
        allContainersHaveTransitDetails: s.containers.every(
          (c) => c.transitDetails !== null
        ),
      }),
    }))
    .filter((s) => s.gaps.length > 0)

  const attentionItems = [
    {
      key: "overdue",
      label: "Overdue ETAs",
      value: overdueEtas,
      href: "/shipments?status=overdue",
      classes: "border-red-600/30 bg-red-500/10 text-red-700 dark:text-red-400",
    },
    {
      key: "pending-docs",
      label: "Pending Verifications",
      value: pendingDocVerifications,
      href: "/shipments?status=docs-pending",
      classes:
        "border-amber-600/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
    },
    {
      key: "stage-skip",
      label: "Out-of-Order Paperwork",
      value: stageSkipAlerts.length,
      href: "#document-stage-alerts",
      classes:
        "border-orange-600/30 bg-orange-500/10 text-orange-700 dark:text-orange-400",
    },
    {
      key: "stage2",
      label: "Stage 2 Details Needed",
      value: stage2Alerts.length,
      href: "#stage2-alerts",
      classes: "border-sky-600/30 bg-sky-500/10 text-sky-700 dark:text-sky-400",
    },
  ].filter((item) => item.value > 0)

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Dashboard</h1>

      {attentionItems.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed p-3">
          <span className="mr-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Needs attention
          </span>
          {attentionItems.map((item) => (
            <a
              key={item.key}
              href={item.href}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium transition-opacity hover:opacity-80",
                item.classes
              )}
            >
              {item.label}
              <span className="font-bold tabular-nums">{item.value}</span>
            </a>
          ))}
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-xl border border-dashed border-emerald-600/30 bg-emerald-500/5 p-3 text-sm text-emerald-700 dark:text-emerald-400">
          <CircleCheck className="size-4 shrink-0" />
          All caught up — no overdue ETAs, unverified documents, or paperwork
          gaps right now.
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {stats.map((s) => (
          <Link
            key={s.label}
            href={s.href}
            className="flex flex-col gap-3 rounded-xl border bg-card p-4 transition-colors hover:bg-muted/40"
          >
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-full",
                  s.iconClass
                )}
              >
                <s.icon className="size-4" />
              </div>
              <span className="truncate text-xs font-medium text-muted-foreground">
                {s.label}
              </span>
            </div>
            <span className="text-3xl font-bold tabular-nums">{s.value}</span>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-full bg-indigo-500/10 text-indigo-700 dark:text-indigo-400">
                <Ship className="size-4.5" />
              </div>
              <div>
                <CardTitle>Shipment Pipeline</CardTitle>
                <CardDescription>
                  {total} shipment{total === 1 ? "" : "s"} total
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <HorizontalBarChart items={pipelineItems} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-full bg-violet-500/10 text-violet-700 dark:text-violet-400">
                <Container className="size-4.5" />
              </div>
              <div>
                <CardTitle>Container Pipeline</CardTitle>
                <CardDescription>
                  {containersOnVessel.length +
                    containersAtPort.length +
                    containersInland.length +
                    containersCompleted.length}{" "}
                  container
                  {containersOnVessel.length +
                    containersAtPort.length +
                    containersInland.length +
                    containersCompleted.length ===
                  1
                    ? ""
                    : "s"}{" "}
                  total
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <HorizontalBarChart items={containerPipelineItems} />
          </CardContent>
        </Card>
      </div>

      <Card
        id="document-stage-alerts"
        className="border-red-600/50 dark:border-red-500/50"
      >
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-full bg-red-600 text-white shadow-sm shadow-red-600/30">
              <FileWarning className="size-4.5" />
            </div>
            <div>
              <CardTitle>Document Stage Alerts</CardTitle>
              <CardDescription>
                Shipments with later-stage paperwork uploaded ahead of an
                earlier, incomplete stage
              </CardDescription>
            </div>
          </div>
          {stageSkipAlerts.length > 0 && (
            <CardAction>
              <Badge className="bg-red-700 text-white dark:bg-red-600">
                {stageSkipAlerts.length}
              </Badge>
            </CardAction>
          )}
        </CardHeader>
        <CardContent>
          {stageSkipAlerts.length === 0 ? (
            <EmptyState
              icon={CheckCircle2}
              title="No out-of-order paperwork"
              description="Shipments with later-stage documents uploaded before an earlier stage is complete will show up here."
            />
          ) : (
            <div className="flex flex-col gap-2">
              {stageSkipAlerts.map(({ id, blNumber, alert }) => (
                <Link
                  key={id}
                  href={`/shipments/${id}#stage-${alert.incompleteStage}`}
                  className="flex items-center justify-between gap-3 rounded-lg border border-red-600/40 bg-red-50 px-3 py-2 text-sm hover:bg-red-100 dark:border-red-500/40 dark:bg-red-950/40 dark:hover:bg-red-950/60"
                >
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="font-medium">{blNumber}</span>
                    <span className="truncate text-muted-foreground">
                      {describeStageSkipAlert(alert)}
                    </span>
                  </div>
                  <Badge className="shrink-0 bg-red-600 text-white dark:bg-red-600">
                    {stageSkipBadgeLabel(alert)}
                  </Badge>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card id="stage2-alerts">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-full bg-sky-500/10 text-sky-700 dark:text-sky-400">
              <ClipboardList className="size-4.5" />
            </div>
            <div>
              <CardTitle>Arrived — Stage 2 Details Needed</CardTitle>
              <CardDescription>
                Shipments at the discharge port still missing a clearing
                agent, customs declaration, or container transit details
              </CardDescription>
            </div>
          </div>
          {stage2Alerts.length > 0 && (
            <CardAction>
              <Badge className="bg-sky-600 text-white dark:bg-sky-500">
                {stage2Alerts.length}
              </Badge>
            </CardAction>
          )}
        </CardHeader>
        <CardContent>
          {stage2Alerts.length === 0 ? (
            <EmptyState
              icon={CheckCircle2}
              title="Nothing outstanding"
              description="Shipments that arrive without Stage 2 details recorded yet will show up here."
            />
          ) : (
            <div className="flex flex-col gap-2">
              {stage2Alerts.map(({ id, blNumber, gaps }) => (
                <Link
                  key={id}
                  href={`/shipments/${id}`}
                  className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm hover:bg-muted/50"
                >
                  <span className="font-medium">{blNumber}</span>
                  <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
                    {gaps.map((gap) => (
                      <Badge
                        key={gap}
                        variant="outline"
                        className="border-sky-600/30 bg-sky-500/10 text-sky-700 dark:text-sky-400"
                      >
                        {STAGE2_GAP_LABELS[gap]}
                      </Badge>
                    ))}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-full bg-orange-500/10 text-orange-700 dark:text-orange-400">
                <Timer className="size-4.5" />
              </div>
              <CardTitle>Demurrage Risk Monitor</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <HorizontalBarChart items={detentionRiskItems} />

            <div className="flex flex-wrap gap-2">
              {(Object.keys(riskCounts) as DetentionRiskLevel[]).map((level) => (
                <Badge
                  key={level}
                  variant="outline"
                  className={DETENTION_RISK_CLASSES[level]}
                >
                  {DETENTION_RISK_LABELS[level]}: {riskCounts[level]}
                </Badge>
              ))}
            </div>

            {topAtRisk.length === 0 ? (
              <EmptyState
                icon={Timer}
                title="No active detention clocks"
                description="Containers show up here once discharged at the seaport."
              />
            ) : (
              <div className="flex flex-col gap-2">
                {topAtRisk.map((item) => (
                  <Link
                    key={item.containerNumber}
                    href={`/shipments/${item.shipmentId}`}
                    className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm hover:bg-muted/50"
                  >
                    <span>
                      {item.blNumber} · {item.containerNumber}
                    </span>
                    <Badge
                      variant="outline"
                      className={DETENTION_RISK_CLASSES[item.level]}
                    >
                      {item.daysRemaining < 0
                        ? `${Math.abs(item.daysRemaining)}d overdue`
                        : `${item.daysRemaining}d left`}
                    </Badge>
                  </Link>
                ))}
              </div>
            )}

            <Link
              href="/shipments/detention"
              className="self-start text-sm text-primary hover:underline"
            >
              View all →
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-full bg-sky-500/10 text-sky-700 dark:text-sky-400">
                <CalendarClock className="size-4.5" />
              </div>
              <CardTitle>Upcoming Arrivals</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {upcomingShipments.length === 0 ? (
              <EmptyState
                icon={Ship}
                title="Nothing in transit"
                description="Shipments still at sea or awaiting discharge appear here."
              />
            ) : (
              upcomingShipments.map((s) => {
                const days = daysUntil(s.currentEta)
                return (
                  <Link
                    key={s.id}
                    href={`/shipments/${s.id}`}
                    className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm hover:bg-muted/50"
                  >
                    <span>
                      {s.blNumber} · {DISCHARGE_PORT_LABELS[s.dischargePort]}
                    </span>
                    <span className="text-muted-foreground">
                      {formatDate(s.currentEta)} (
                      {days < 0 ? "overdue" : `${days}d`})
                    </span>
                  </Link>
                )
              })
            )}

            <Link
              href="/shipments/tracking"
              className="self-start text-sm text-primary hover:underline"
            >
              View all →
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
