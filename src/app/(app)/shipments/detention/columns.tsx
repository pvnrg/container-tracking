"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import type { ColumnDef } from "@tanstack/react-table"
import { PackageCheck, Timer } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header"
import {
  DETENTION_RISK_CLASSES,
  DETENTION_RISK_LABELS,
  getDetentionRisk,
  type DetentionRiskLevel,
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

export type DetentionStatus = "not-started" | "returned" | DetentionRiskLevel

export const DETENTION_STATUS_LABELS: Record<DetentionStatus, string> = {
  "not-started": "Not started",
  returned: "Returned",
  ...DETENTION_RISK_LABELS,
}

export function getDetentionStatus(container: DetentionContainer): DetentionStatus {
  const tracker = container.detentionTracker
  if (!tracker) return "not-started"
  if (tracker.returnedToDepotDate) return "returned"
  return getDetentionRisk(tracker.deadlineDate!).level
}

export const detentionColumns: ColumnDef<DetentionContainer>[] = [
  {
    id: "blNumber",
    accessorFn: (row) => row.shipment.blNumber,
    meta: { label: "BL Number" },
    header: ({ column }) => <DataTableColumnHeader column={column} title="BL Number" />,
    cell: ({ row }) => (
      <Link
        href={`/shipments/${row.original.shipment.id}`}
        className="font-medium hover:underline"
      >
        {row.original.shipment.blNumber}
      </Link>
    ),
  },
  {
    accessorKey: "containerNumber",
    meta: { label: "Container Number" },
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Container Number" />
    ),
  },
  {
    id: "clockStartDate",
    accessorFn: (row) => row.detentionTracker?.clockStartDate ?? null,
    meta: { label: "Clock Started" },
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Clock Started" />
    ),
    cell: ({ row }) => {
      const date = row.original.detentionTracker?.clockStartDate
      return date ? formatDate(date) : "—"
    },
  },
  {
    id: "deadlineDate",
    accessorFn: (row) => row.detentionTracker?.deadlineDate ?? null,
    meta: { label: "Deadline" },
    header: ({ column }) => <DataTableColumnHeader column={column} title="Deadline" />,
    cell: ({ row }) => {
      const date = row.original.detentionTracker?.deadlineDate
      return date ? formatDate(date) : "—"
    },
  },
  {
    id: "risk",
    accessorFn: (row) => getDetentionStatus(row),
    meta: { label: "Risk" },
    header: "Risk",
    filterFn: "equalsString",
    enableSorting: false,
    cell: ({ row }) => {
      const tracker = row.original.detentionTracker
      const status = getDetentionStatus(row.original)
      if (status === "not-started") return <Badge variant="outline">Not started</Badge>
      if (status === "returned")
        return (
          <Badge variant="secondary">
            Returned {formatDate(tracker!.returnedToDepotDate!)}
          </Badge>
        )
      const risk = getDetentionRisk(tracker!.deadlineDate!)
      return (
        <Badge variant="outline" className={DETENTION_RISK_CLASSES[risk.level]}>
          {DETENTION_RISK_LABELS[risk.level]} ·{" "}
          {risk.daysRemaining < 0
            ? `${Math.abs(risk.daysRemaining)}d overdue`
            : `${risk.daysRemaining}d left`}
        </Badge>
      )
    },
  },
  {
    id: "actions",
    header: () => <div className="text-right">Action</div>,
    enableHiding: false,
    enableSorting: false,
    cell: ({ row }) => <DetentionRowActions container={row.original} />,
  },
]

function DetentionRowActions({ container }: { container: DetentionContainer }) {
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
    <div className="flex justify-end">
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
    </div>
  )
}
