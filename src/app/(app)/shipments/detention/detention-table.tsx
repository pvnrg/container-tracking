"use client"

import { useMemo, useState } from "react"
import { Timer } from "lucide-react"

import { DataTable } from "@/components/data-table/data-table"
import { EmptyState } from "@/components/empty-state"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

import {
  DETENTION_STATUS_LABELS,
  detentionColumns,
  getDetentionStatus,
  type DetentionContainer,
  type DetentionStatus,
} from "./columns"

const ALL_RISK = "__all__"

export function DetentionTable({
  containers,
}: {
  containers: DetentionContainer[]
}) {
  const [riskFilter, setRiskFilter] = useState<string>(ALL_RISK)

  const filteredContainers = useMemo(
    () =>
      riskFilter === ALL_RISK
        ? containers
        : containers.filter((c) => getDetentionStatus(c) === riskFilter),
    [containers, riskFilter]
  )

  if (containers.length === 0) {
    return (
      <div className="rounded-lg border">
        <EmptyState
          icon={Timer}
          title="No containers to show"
          description="Containers appear here once their shipment has arrived at the discharge port."
        />
      </div>
    )
  }

  return (
    <DataTable
      columns={detentionColumns}
      data={filteredContainers}
      searchableColumns={["blNumber", "containerNumber"]}
      searchPlaceholder="Search BL or container number..."
      emptyMessage="No containers match your filters."
      filters={
        <Select
          value={riskFilter}
          onValueChange={(value) => setRiskFilter(value ?? ALL_RISK)}
        >
          <SelectTrigger size="sm" className="w-40">
            <SelectValue placeholder="All risk levels">
              {(value: string | null) =>
                value && value !== ALL_RISK
                  ? DETENTION_STATUS_LABELS[value as DetentionStatus]
                  : "All risk levels"
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_RISK}>All risk levels</SelectItem>
            {(Object.keys(DETENTION_STATUS_LABELS) as DetentionStatus[]).map(
              (status) => (
                <SelectItem key={status} value={status}>
                  {DETENTION_STATUS_LABELS[status]}
                </SelectItem>
              )
            )}
          </SelectContent>
        </Select>
      }
    />
  )
}
