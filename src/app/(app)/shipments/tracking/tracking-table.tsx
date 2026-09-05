"use client"

import { useCallback, useMemo, useState } from "react"
import { ShipmentStatus } from "@prisma/client"
import { ListFilter } from "lucide-react"

import { DataTable } from "@/components/data-table/data-table"
import { EmptyState } from "@/components/empty-state"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { SHIPMENT_STATUS_LABELS } from "@/lib/shipment-labels"

import {
  createTrackingColumns,
  toDateInputValue,
  type TrackingDraft,
  type TrackingShipment,
} from "./columns"

const ALL_STATUSES = "__all__"

export function TrackingTable({
  shipments,
}: {
  shipments: TrackingShipment[]
}) {
  const [statusFilter, setStatusFilter] = useState<string>(ALL_STATUSES)
  const [drafts, setDrafts] = useState<Record<string, TrackingDraft>>({})

  const shipmentsById = useMemo(
    () => new Map(shipments.map((s) => [s.id, s])),
    [shipments]
  )

  const setDraft = useCallback(
    (shipmentId: string, patch: Partial<TrackingDraft>) => {
      setDrafts((prev) => {
        const shipment = shipmentsById.get(shipmentId)
        const base = prev[shipmentId] ??
          (shipment
            ? { status: shipment.status, currentEta: toDateInputValue(shipment.currentEta) }
            : undefined)
        return { ...prev, [shipmentId]: { ...base, ...patch } as TrackingDraft }
      })
    },
    [shipmentsById]
  )

  const columns = useMemo(
    () => createTrackingColumns(drafts, setDraft),
    [drafts, setDraft]
  )

  const availableStatuses = useMemo(
    () => Array.from(new Set(shipments.map((s) => s.status))),
    [shipments]
  )

  const filteredShipments = useMemo(
    () =>
      statusFilter === ALL_STATUSES
        ? shipments
        : shipments.filter((s) => s.status === statusFilter),
    [shipments, statusFilter]
  )

  if (shipments.length === 0) {
    return (
      <div className="rounded-lg border">
        <EmptyState
          icon={ListFilter}
          title="No shipments to show"
          description="There are no shipments to track yet."
        />
      </div>
    )
  }

  return (
    <DataTable
      columns={columns}
      data={filteredShipments}
      searchableColumns={["blNumber"]}
      searchPlaceholder="Search BL number..."
      emptyMessage="No shipments match your filters."
      filters={
        <Select
          value={statusFilter}
          onValueChange={(value) => setStatusFilter(value ?? ALL_STATUSES)}
        >
          <SelectTrigger size="sm" className="w-48">
            <SelectValue placeholder="All statuses">
              {(value: string | null) =>
                value && value !== ALL_STATUSES
                  ? SHIPMENT_STATUS_LABELS[value as ShipmentStatus]
                  : "All statuses"
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_STATUSES}>All statuses</SelectItem>
            {availableStatuses.map((status) => (
              <SelectItem key={status} value={status}>
                {SHIPMENT_STATUS_LABELS[status]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      }
    />
  )
}
