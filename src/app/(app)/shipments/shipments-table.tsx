"use client"

import { useMemo, useState } from "react"
import type { ShipmentStatus } from "@prisma/client"

import { DataTable } from "@/components/data-table/data-table"
import { EmptyState } from "@/components/empty-state"
import { ContainerStackIllustration } from "@/components/illustrations/container-stack"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { SHIPMENT_STATUS_LABELS } from "@/lib/shipment-labels"

import { createShipmentColumns, type ShipmentRow } from "./columns"

const ALL_STATUSES = "__all__"

export function ShipmentsTable({
  shipments,
  canManage,
  presetFilterLabel,
}: {
  shipments: ShipmentRow[]
  canManage: boolean
  presetFilterLabel?: string
}) {
  const [statusFilter, setStatusFilter] = useState<string>(ALL_STATUSES)

  const columns = useMemo(() => createShipmentColumns(canManage), [canManage])

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
          illustration={<ContainerStackIllustration className="w-40 opacity-80" />}
          title={presetFilterLabel ? "No matching shipments" : "No shipments yet"}
          description={
            presetFilterLabel
              ? `No shipments match "${presetFilterLabel}".`
              : canManage
                ? "Create your first shipment to start tracking it."
                : "Shipments will appear here once one is created."
          }
        />
      </div>
    )
  }

  return (
    <DataTable
      columns={columns}
      data={filteredShipments}
      searchableColumns={["blNumber", "shippingLine"]}
      searchPlaceholder="Search BL number or shipping line..."
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
            {(Object.keys(SHIPMENT_STATUS_LABELS) as ShipmentStatus[]).map(
              (status) => (
                <SelectItem key={status} value={status}>
                  {SHIPMENT_STATUS_LABELS[status]}
                </SelectItem>
              )
            )}
          </SelectContent>
        </Select>
      }
    />
  )
}
