"use client"

import { useMemo, useState } from "react"
import { ContainerStatus } from "@prisma/client"
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
import { CONTAINER_STATUS_LABELS } from "@/lib/shipment-labels"

import { offloadColumns, type OffloadContainer } from "./columns"

const ALL_STATUSES = "__all__"

export function OffloadTable({
  containers,
}: {
  containers: OffloadContainer[]
}) {
  const [statusFilter, setStatusFilter] = useState<string>(ALL_STATUSES)

  const availableStatuses = useMemo(
    () => Array.from(new Set(containers.map((c) => c.status))),
    [containers]
  )

  const filteredContainers = useMemo(
    () =>
      statusFilter === ALL_STATUSES
        ? containers
        : containers.filter((c) => c.status === statusFilter),
    [containers, statusFilter]
  )

  if (containers.length === 0) {
    return (
      <div className="rounded-lg border">
        <EmptyState
          icon={ListFilter}
          title="No containers to show"
          description="Containers appear here once their shipment has left port."
        />
      </div>
    )
  }

  return (
    <DataTable
      columns={offloadColumns}
      data={filteredContainers}
      searchableColumns={["blNumber", "containerNumber"]}
      searchPlaceholder="Search BL or container number..."
      emptyMessage="No containers match your filters."
      filters={
        <Select
          value={statusFilter}
          onValueChange={(value) => setStatusFilter(value ?? ALL_STATUSES)}
        >
          <SelectTrigger size="sm" className="w-48">
            <SelectValue placeholder="All statuses">
              {(value: string | null) =>
                value && value !== ALL_STATUSES
                  ? CONTAINER_STATUS_LABELS[value as ContainerStatus]
                  : "All statuses"
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_STATUSES}>All statuses</SelectItem>
            {availableStatuses.map((status) => (
              <SelectItem key={status} value={status}>
                {CONTAINER_STATUS_LABELS[status]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      }
    />
  )
}
