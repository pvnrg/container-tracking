"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { PackageCheck, Timer } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/empty-state"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DETENTION_RISK_CLASSES,
  DETENTION_RISK_LABELS,
  getDetentionRisk,
} from "@/lib/detention"
import { formatDate } from "@/lib/format"

import { markContainerReturned, startDetentionClock } from "./actions"

export type DetentionContainer = {
  id: string
  containerNumber: string
  shipment: { id: string; blNumber: string }
  detentionTracker: {
    clockStartDate: Date | null
    deadlineDate: Date | null
    returnedToDepotDate: Date | null
  } | null
}

export function DetentionTable({
  containers,
}: {
  containers: DetentionContainer[]
}) {
  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>BL Number</TableHead>
            <TableHead>Container Number</TableHead>
            <TableHead>Clock Started</TableHead>
            <TableHead>Deadline</TableHead>
            <TableHead>Risk</TableHead>
            <TableHead className="text-right">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {containers.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="p-0">
                <EmptyState
                  icon={Timer}
                  title="No containers to show"
                  description="Containers appear here once their shipment has arrived at the discharge port."
                />
              </TableCell>
            </TableRow>
          )}
          {containers.map((container) => (
            <DetentionRow key={container.id} container={container} />
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function DetentionRow({ container }: { container: DetentionContainer }) {
  const router = useRouter()
  const [isBusy, setIsBusy] = useState(false)
  const tracker = container.detentionTracker

  const handleStart = async () => {
    setIsBusy(true)
    try {
      await startDetentionClock(container.id)
      toast.success(`Detention clock started for ${container.containerNumber}`)
      router.refresh()
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to start detention clock"
      )
    } finally {
      setIsBusy(false)
    }
  }

  const handleReturn = async () => {
    setIsBusy(true)
    try {
      await markContainerReturned(container.id)
      toast.success(`${container.containerNumber} marked returned to depot`)
      router.refresh()
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to mark container returned"
      )
    } finally {
      setIsBusy(false)
    }
  }

  return (
    <TableRow>
      <TableCell>
        <Link
          href={`/shipments/${container.shipment.id}`}
          className="font-medium hover:underline"
        >
          {container.shipment.blNumber}
        </Link>
      </TableCell>
      <TableCell>{container.containerNumber}</TableCell>
      <TableCell>
        {tracker?.clockStartDate ? formatDate(tracker.clockStartDate) : "—"}
      </TableCell>
      <TableCell>
        {tracker?.deadlineDate ? formatDate(tracker.deadlineDate) : "—"}
      </TableCell>
      <TableCell>
        {!tracker ? (
          <Badge variant="outline">Not started</Badge>
        ) : tracker.returnedToDepotDate ? (
          <Badge variant="secondary">
            Returned {formatDate(tracker.returnedToDepotDate)}
          </Badge>
        ) : (
          (() => {
            const risk = getDetentionRisk(tracker.deadlineDate!)
            return (
              <Badge
                variant="outline"
                className={DETENTION_RISK_CLASSES[risk.level]}
              >
                {DETENTION_RISK_LABELS[risk.level]} ·{" "}
                {risk.daysRemaining < 0
                  ? `${Math.abs(risk.daysRemaining)}d overdue`
                  : `${risk.daysRemaining}d left`}
              </Badge>
            )
          })()
        )}
      </TableCell>
      <TableCell className="text-right">
        {!tracker && (
          <Button type="button" size="sm" disabled={isBusy} onClick={handleStart}>
            <Timer data-icon="inline-start" />
            {isBusy ? "Starting..." : "Start Detention Clock"}
          </Button>
        )}
        {tracker && !tracker.returnedToDepotDate && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={isBusy}
            onClick={handleReturn}
          >
            <PackageCheck data-icon="inline-start" />
            {isBusy ? "Saving..." : "Mark Returned to Depot"}
          </Button>
        )}
      </TableCell>
    </TableRow>
  )
}
