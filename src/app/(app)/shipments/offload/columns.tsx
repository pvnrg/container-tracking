"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import type { ColumnDef } from "@tanstack/react-table"
import { ContainerStatus, RwandanDestination } from "@prisma/client"
import { PackageCheck, Save } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header"
import { Input } from "@/components/ui/input"
import { formatDateTime } from "@/lib/format"
import {
  CONTAINER_STATUS_BADGE_CLASSES,
  CONTAINER_STATUS_LABELS,
  DESTINATION_WAREHOUSE_LABELS,
} from "@/lib/shipment-labels"

import { confirmContainerOffload, scheduleContainerOffload } from "./actions"

export type OffloadContainer = {
  id: string
  containerNumber: string
  inventoryReference: string
  status: ContainerStatus
  offloadScheduledAt: Date | null
  actualOffloadedAt: Date | null
  shipment: {
    id: string
    blNumber: string
    destinationWarehouse: RwandanDestination | null
  }
}

function toDatetimeLocalValue(date: Date | null) {
  if (!date) return ""
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export const offloadColumns: ColumnDef<OffloadContainer>[] = [
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
    accessorKey: "inventoryReference",
    meta: { label: "Inventory Reference" },
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Inventory Reference" />
    ),
  },
  {
    id: "destinationWarehouse",
    accessorFn: (row) => row.shipment.destinationWarehouse,
    meta: { label: "Destination Warehouse" },
    header: "Destination Warehouse",
    enableSorting: false,
    cell: ({ row }) =>
      row.original.shipment.destinationWarehouse
        ? DESTINATION_WAREHOUSE_LABELS[row.original.shipment.destinationWarehouse]
        : "Not yet allocated",
  },
  {
    accessorKey: "status",
    meta: { label: "Status" },
    header: "Status",
    filterFn: "equalsString",
    enableSorting: false,
    cell: ({ row }) => (
      <Badge variant="outline" className={CONTAINER_STATUS_BADGE_CLASSES[row.original.status]}>
        {CONTAINER_STATUS_LABELS[row.original.status]}
      </Badge>
    ),
  },
  {
    id: "offloadScheduledAt",
    accessorFn: (row) => row.offloadScheduledAt,
    meta: { label: "Offload Scheduled" },
    header: "Offload Scheduled",
    enableSorting: false,
    cell: ({ row }) => <ScheduleCell container={row.original} />,
  },
  {
    id: "actualOffloadedAt",
    accessorFn: (row) => row.actualOffloadedAt,
    meta: { label: "Actual Offloaded" },
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Actual Offloaded" />
    ),
    cell: ({ row }) => <ConfirmCell container={row.original} />,
  },
]

function ScheduleCell({ container }: { container: OffloadContainer }) {
  const router = useRouter()
  const [scheduledAt, setScheduledAt] = useState(
    toDatetimeLocalValue(container.offloadScheduledAt)
  )
  const [isSavingSchedule, setIsSavingSchedule] = useState(false)

  const isDirty = scheduledAt !== toDatetimeLocalValue(container.offloadScheduledAt)

  const handleSaveSchedule = async () => {
    setIsSavingSchedule(true)
    try {
      await scheduleContainerOffload({
        containerId: container.id,
        offloadScheduledAt: scheduledAt,
      })
      toast.success(`${container.containerNumber} schedule saved`)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save schedule")
    } finally {
      setIsSavingSchedule(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Input
        type="datetime-local"
        className="w-56"
        value={scheduledAt}
        onChange={(e) => setScheduledAt(e.target.value)}
      />
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={!isDirty || isSavingSchedule}
        onClick={handleSaveSchedule}
      >
        <Save data-icon="inline-start" />
        {isSavingSchedule ? "Saving..." : "Save"}
      </Button>
    </div>
  )
}

function ConfirmCell({ container }: { container: OffloadContainer }) {
  const router = useRouter()
  const [isConfirming, setIsConfirming] = useState(false)

  const handleConfirm = async () => {
    setIsConfirming(true)
    try {
      await confirmContainerOffload(container.id)
      toast.success(`${container.containerNumber} offload confirmed`)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to confirm offload")
    } finally {
      setIsConfirming(false)
    }
  }

  if (container.actualOffloadedAt) {
    return <span className="text-sm">{formatDateTime(container.actualOffloadedAt)}</span>
  }

  return (
    <Button type="button" size="sm" disabled={isConfirming} onClick={handleConfirm}>
      <PackageCheck data-icon="inline-start" />
      {isConfirming ? "Confirming..." : "Confirm Offload"}
    </Button>
  )
}
