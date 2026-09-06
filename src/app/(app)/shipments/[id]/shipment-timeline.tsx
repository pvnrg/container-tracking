import { ShipmentStatus } from "@prisma/client"
import { CheckCircle2 } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { formatDateTime } from "@/lib/format"
import { SHIPMENT_STATUS_LABELS } from "@/lib/shipment-labels"
import {
  formatDuration,
  phaseBreakdown,
  STATUS_PHASE,
  type ShipmentPhase,
  type TimelineSegment,
} from "@/lib/shipment-timeline"
import { cn } from "@/lib/utils"

// Same 4-phase sky/violet/amber/teal palette as the Documents section's
// stage cards (documents-panel.tsx's STAGE_THEME) -- the two areas track
// the same underlying journey, so they're deliberately color-matched.
const PHASE_DOT_CLASSES: Record<ShipmentPhase, string> = {
  sea: "bg-sky-500",
  port: "bg-violet-500",
  road: "bg-amber-500",
  destination: "bg-teal-500",
}

const PHASE_TEXT_CLASSES: Record<ShipmentPhase, string> = {
  sea: "text-sky-700 dark:text-sky-400",
  port: "text-violet-700 dark:text-violet-400",
  road: "text-amber-700 dark:text-amber-400",
  destination: "text-teal-700 dark:text-teal-400",
}

const PHASE_BG_CLASSES: Record<ShipmentPhase, string> = {
  sea: "bg-sky-500/10",
  port: "bg-violet-500/10",
  road: "bg-amber-500/10",
  destination: "bg-teal-500/10",
}

const ENTERED_VIA_LABEL: Record<TimelineSegment["enteredVia"], string> = {
  created: "Shipment created",
  manual: "Updated manually",
  auto: "Advanced automatically",
}

export function ShipmentTimelineCard({
  segments,
  currentStatus,
}: {
  segments: TimelineSegment[]
  currentStatus: ShipmentStatus
}) {
  const isCompleted = currentStatus === "COMPLETED"
  const firstSegment = segments[0]
  const lastSegment = segments[segments.length - 1]
  const totalMs =
    (lastSegment.exitedAt ?? new Date()).getTime() - firstSegment.enteredAt.getTime()

  return (
    <Card>
      <CardHeader>
        <CardTitle>Shipment Timeline</CardTitle>
        <CardDescription>
          {isCompleted
            ? `Full journey, start to finish — ${formatDuration(totalMs)} total`
            : "How this shipment has moved through each status so far"}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {isCompleted && (
          <div className="flex items-center gap-3 rounded-lg border border-emerald-600/30 bg-emerald-500/10 px-3 py-2.5 text-sm">
            <CheckCircle2 className="size-5 shrink-0 text-emerald-700 dark:text-emerald-400" />
            <div>
              <p className="font-medium text-emerald-700 dark:text-emerald-400">
                Shipment completed
              </p>
              <p className="text-emerald-700/80 dark:text-emerald-400/80">
                Total transit time: {formatDuration(totalMs)}
              </p>
            </div>
          </div>
        )}

        {isCompleted && (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {phaseBreakdown(segments).map(({ phase, label, ms }) => (
              <div
                key={phase}
                className={cn(
                  "flex flex-col gap-0.5 rounded-lg px-3 py-2",
                  PHASE_BG_CLASSES[phase]
                )}
              >
                <span className={cn("text-xs font-medium", PHASE_TEXT_CLASSES[phase])}>
                  {label}
                </span>
                <span className="text-sm font-semibold tabular-nums">
                  {ms > 0 ? formatDuration(ms) : "—"}
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-col">
          {segments.map((segment, index) => {
            const phase = STATUS_PHASE[segment.status]
            const isLast = index === segments.length - 1
            const isOngoing = segment.exitedAt === null
            const duration = formatDuration(
              (segment.exitedAt ?? new Date()).getTime() - segment.enteredAt.getTime()
            )

            return (
              <div key={`${segment.status}-${segment.enteredAt.getTime()}`} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <span
                    className={cn(
                      "mt-1 size-3 shrink-0 rounded-full ring-4 ring-background",
                      PHASE_DOT_CLASSES[phase]
                    )}
                  />
                  {!isLast && <span className="w-px flex-1 bg-border" />}
                </div>
                <div className={cn("flex min-w-0 flex-col gap-0.5", !isLast && "pb-5")}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">
                      {SHIPMENT_STATUS_LABELS[segment.status]}
                    </span>
                    {isOngoing && (
                      <Badge variant="outline" className={PHASE_TEXT_CLASSES[phase]}>
                        Current
                      </Badge>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {formatDateTime(segment.enteredAt)} ·{" "}
                    {ENTERED_VIA_LABEL[segment.enteredVia]} ·{" "}
                    {isOngoing ? `${duration} so far` : `spent ${duration}`}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
