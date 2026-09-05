"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import type { ColumnDef } from "@tanstack/react-table"
import { DischargePort, ShipmentStatus } from "@prisma/client"
import { Save } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  ARRIVED_OR_LATER_STATUSES,
  DISCHARGE_PORT_LABELS,
  SHIPMENT_STATUS_LABELS,
} from "@/lib/shipment-labels"

import { updateShipmentTracking } from "./actions"

export type TrackingShipment = {
  id: string
  blNumber: string
  shippingLine: string
  vesselName: string | null
  dischargePort: DischargePort
  status: ShipmentStatus
  currentEta: Date
}

export type TrackingDraft = { status: ShipmentStatus; currentEta: string }

export function toDateInputValue(date: Date) {
  return date.toISOString().slice(0, 10)
}

function formatCountdown(currentEta: Date, status: ShipmentStatus) {
  if (ARRIVED_OR_LATER_STATUSES.includes(status)) {
    return { text: "Arrived", className: "text-muted-foreground" }
  }
  const diffDays = Math.round(
    (currentEta.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  )
  if (diffDays < 0) {
    return {
      text: `${Math.abs(diffDays)} day${Math.abs(diffDays) === 1 ? "" : "s"} overdue`,
      className: "text-destructive font-medium",
    }
  }
  if (diffDays === 0) {
    return { text: "Due today", className: "text-amber-600 font-medium" }
  }
  return { text: `In ${diffDays} day${diffDays === 1 ? "" : "s"}`, className: "" }
}

// Status, Current ETA and Save render as separate columns (matching the
// original table's headers) but edit one shared draft per shipment, so the
// draft lives in the parent TrackingTable and is threaded into each cell.
export function createTrackingColumns(
  drafts: Record<string, TrackingDraft>,
  setDraft: (shipmentId: string, patch: Partial<TrackingDraft>) => void
): ColumnDef<TrackingShipment>[] {
  const draftFor = (shipment: TrackingShipment): TrackingDraft =>
    drafts[shipment.id] ?? {
      status: shipment.status,
      currentEta: toDateInputValue(shipment.currentEta),
    }

  return [
    {
      accessorKey: "blNumber",
      meta: { label: "BL Number" },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="BL Number" />
      ),
      cell: ({ row }) => <span className="font-medium">{row.original.blNumber}</span>,
    },
    {
      accessorKey: "shippingLine",
      meta: { label: "Shipping Line" },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Shipping Line" />
      ),
    },
    {
      accessorKey: "dischargePort",
      meta: { label: "Discharge Port" },
      header: "Discharge Port",
      enableSorting: false,
      cell: ({ row }) => DISCHARGE_PORT_LABELS[row.original.dischargePort],
    },
    {
      accessorKey: "status",
      meta: { label: "Status" },
      header: "Status",
      filterFn: "equalsString",
      enableSorting: false,
      cell: ({ row }) => {
        const shipment = row.original
        const draft = draftFor(shipment)
        return (
          <Select
            value={draft.status}
            onValueChange={(v) => setDraft(shipment.id, { status: v as ShipmentStatus })}
          >
            <SelectTrigger className="w-56">
              <SelectValue placeholder="Select status">
                {(value: ShipmentStatus | null) =>
                  value ? SHIPMENT_STATUS_LABELS[value] : "Select status"
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {Object.values(ShipmentStatus).map((s) => (
                <SelectItem key={s} value={s}>
                  {SHIPMENT_STATUS_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )
      },
    },
    {
      id: "currentEta",
      accessorFn: (row) => row.currentEta,
      meta: { label: "Current ETA" },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Current ETA" />
      ),
      cell: ({ row }) => {
        const shipment = row.original
        const draft = draftFor(shipment)
        return (
          <Input
            type="date"
            className="w-40"
            value={draft.currentEta}
            onChange={(e) => setDraft(shipment.id, { currentEta: e.target.value })}
          />
        )
      },
    },
    {
      id: "countdown",
      meta: { label: "Countdown" },
      header: "Countdown",
      enableSorting: false,
      cell: ({ row }) => {
        const shipment = row.original
        const draft = draftFor(shipment)
        const countdown = formatCountdown(new Date(draft.currentEta), draft.status)
        return (
          <Badge variant="outline" className={countdown.className}>
            {countdown.text}
          </Badge>
        )
      },
    },
    {
      id: "save",
      header: () => <div className="text-right">Save</div>,
      enableHiding: false,
      enableSorting: false,
      cell: ({ row }) => {
        const shipment = row.original
        const draft = draftFor(shipment)
        const isDirty =
          draft.status !== shipment.status ||
          draft.currentEta !== toDateInputValue(shipment.currentEta)
        return <SaveButton shipment={shipment} draft={draft} isDirty={isDirty} />
      },
    },
  ]
}

function SaveButton({
  shipment,
  draft,
  isDirty,
}: {
  shipment: TrackingShipment
  draft: TrackingDraft
  isDirty: boolean
}) {
  const router = useRouter()
  const [isSaving, setIsSaving] = useState(false)

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await updateShipmentTracking({
        shipmentId: shipment.id,
        status: draft.status,
        currentEta: draft.currentEta,
      })
      toast.success(`${shipment.blNumber} updated`)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update shipment")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="flex justify-end">
      <Button type="button" size="sm" disabled={!isDirty || isSaving} onClick={handleSave}>
        <Save data-icon="inline-start" />
        {isSaving ? "Saving..." : "Save"}
      </Button>
    </div>
  )
}
