import Link from "next/link"
import {
  Activity,
  AlertTriangle,
  Anchor,
  CheckCircle2,
  CircleCheck,
  FileClock,
  FileWarning,
  Flame,
  OctagonAlert,
  Package,
  Ship,
  Timer,
  Truck,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { EmptyState } from "@/components/empty-state"
import { HorizontalBarChart } from "@/components/horizontal-bar-chart"
import {
  DETENTION_RISK_CLASSES,
  DETENTION_RISK_LABELS,
  DetentionRiskLevel,
  getDetentionRisk,
} from "@/lib/detention"
import { describeStageSkipAlert, findStageSkipAlert } from "@/lib/document-stage-alerts"
import { formatDate } from "@/lib/format"
import { prisma } from "@/lib/prisma"
import {
  ARRIVED_OR_LATER_STATUSES,
  DISCHARGE_PORT_LABELS,
} from "@/lib/shipment-labels"
import { cn } from "@/lib/utils"

function daysUntil(date: Date) {
  return Math.round((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
}

export default async function DashboardPage() {
  const [
    total,
    inTransit,
    atPort,
    completed,
    active,
    overdueEtas,
    pendingDocVerifications,
  ] = await Promise.all([
    prisma.shipment.count(),
    prisma.shipment.count({ where: { status: "IN_TRANSIT_SEA" } }),
    prisma.shipment.count({ where: { status: "ARRIVED_PORT_OF_DISCHARGE" } }),
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

  const [pipelineAtSea, pipelineAtPort, pipelineInland, pipelineCompleted] =
    await Promise.all([
      prisma.shipment.count({
        where: { status: { in: ["SHIPPED_ON_BOARD", "IN_TRANSIT_SEA"] } },
      }),
      prisma.shipment.count({
        where: {
          status: { in: ["ARRIVED_PORT_OF_DISCHARGE", "CUSTOMS_PROCESSING"] },
        },
      }),
      prisma.shipment.count({
        where: {
          status: {
            in: ["CUSTOMS_CLEARED", "LOADED_ROAD_TRANSIT", "ARRIVED_DESTINATION"],
          },
        },
      }),
      prisma.shipment.count({
        where: { status: { in: ["OFFLOADED", "COMPLETED"] } },
      }),
    ])

  const pipelineItems = [
    { key: "at-sea", label: "At Sea", value: pipelineAtSea, colorClass: "bg-chart-1", icon: Ship },
    { key: "at-port", label: "At Port / Customs", value: pipelineAtPort, colorClass: "bg-chart-3", icon: Anchor },
    { key: "inland", label: "Inland Transit", value: pipelineInland, colorClass: "bg-chart-4", icon: Truck },
    { key: "completed", label: "Completed", value: pipelineCompleted, colorClass: "bg-chart-5", icon: CheckCircle2 },
  ]

  const stats = [
    {
      label: "Total Shipments",
      value: total,
      icon: Package,
      classes: "bg-sky-500/10 text-sky-700 dark:text-sky-400",
      href: "/shipments",
    },
    {
      label: "Active Shipments",
      value: active,
      icon: Activity,
      classes: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-400",
      href: "/shipments?status=active",
    },
    {
      label: "In-Transit (Ocean)",
      value: inTransit,
      icon: Ship,
      classes: "bg-violet-500/10 text-violet-700 dark:text-violet-400",
      href: "/shipments?status=IN_TRANSIT_SEA",
    },
    {
      label: "At Port of Discharge",
      value: atPort,
      icon: Anchor,
      classes: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
      href: "/shipments?status=ARRIVED_PORT_OF_DISCHARGE",
    },
    {
      label: "Completed",
      value: completed,
      icon: CheckCircle2,
      classes: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
      href: "/shipments?status=COMPLETED",
    },
    {
      label: "Overdue ETAs",
      value: overdueEtas,
      icon: AlertTriangle,
      classes: "bg-red-500/10 text-red-700 dark:text-red-400",
      href: "/shipments?status=overdue",
    },
    {
      label: "Pending Doc. Verifications",
      value: pendingDocVerifications,
      icon: FileClock,
      classes: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
      href: "/shipments?status=docs-pending",
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
    (level) => ({
      key: level,
      label: DETENTION_RISK_LABELS[level],
      value: riskCounts[level],
      colorClass: detentionRiskBarColors[level],
      icon: detentionRiskIcons[level],
    })
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
    },
  })

  const stageSkipAlerts = shipmentsForDocCheck
    .map((s) => {
      const alert = findStageSkipAlert(s.documents)
      return alert ? { id: s.id, blNumber: s.blNumber, alert } : null
    })
    .filter((a): a is { id: string; blNumber: string; alert: NonNullable<ReturnType<typeof findStageSkipAlert>> } => a !== null)

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Link key={s.label} href={s.href}>
            <Card className="transition-colors hover:bg-muted/50">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {s.label}
                </CardTitle>
                <div
                  className={cn(
                    "flex size-9 items-center justify-center rounded-full",
                    s.classes
                  )}
                >
                  <s.icon className="size-4.5" />
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{s.value}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Shipment Pipeline</CardTitle>
        </CardHeader>
        <CardContent>
          <HorizontalBarChart items={pipelineItems} />
        </CardContent>
      </Card>

      <Card
        className={cn(
          stageSkipAlerts.length > 0 && "border-orange-600/30 bg-orange-500/5"
        )}
      >
        <CardHeader>
          <div className="flex items-center gap-2">
            <FileWarning className="size-4.5 text-orange-600 dark:text-orange-400" />
            <CardTitle>Document Stage Alerts</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {stageSkipAlerts.length === 0 ? (
            <EmptyState
              icon={FileWarning}
              title="No out-of-order paperwork"
              description="Shipments with later-stage documents uploaded before an earlier stage is complete will show up here."
            />
          ) : (
            <div className="flex flex-col gap-2">
              {stageSkipAlerts.map(({ id, blNumber, alert }) => (
                <Link
                  key={id}
                  href={`/shipments/${id}`}
                  className="flex flex-col gap-1 rounded-lg border border-orange-600/30 bg-orange-500/10 px-3 py-2 text-sm hover:bg-orange-500/20"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{blNumber}</span>
                    <Badge
                      variant="outline"
                      className="border-orange-600/30 bg-orange-500/10 text-orange-700 dark:text-orange-400"
                    >
                      Out of order
                    </Badge>
                  </div>
                  <span className="text-muted-foreground">
                    {describeStageSkipAlert(alert)}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Demurrage Risk Monitor</CardTitle>
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
            <CardTitle>Upcoming Arrivals</CardTitle>
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
