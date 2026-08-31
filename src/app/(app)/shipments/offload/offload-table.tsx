"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { ContainerStatus, RwandanDestination } from "@prisma/client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  CONTAINER_STATUS_BADGE_CLASSES,
  CONTAINER_STATUS_LABELS,
  DESTINATION_WAREHOUSE_LABELS,
} from "@/lib/shipment-labels"

import { confirmContainerOffload, scheduleContainerOffload } from "./actions"

const COMPLETED_STATUSES: ContainerStatus[] = [
  "OFFLOADED",
  "EMPTY_RETURNED_TO_DEPOT",
]

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

export function OffloadTable({
  containers,
}: {
  containers: OffloadContainer[]
}) {
  const [hideCompleted, setHideCompleted] = useState(false)

  const visible = useMemo(
    () =>
      hideCompleted
        ? containers.filter((c) => !COMPLETED_STATUSES.includes(c.status))
        : containers,
    [containers, hideCompleted]
  )

  return (
    <div className="flex flex-col gap-4">
      <label className="flex w-fit items-center gap-2 text-sm text-muted-foreground">
        <input
          type="checkbox"
          className="size-4 rounded border-input"
          checked={hideCompleted}
          onChange={(e) => setHideCompleted(e.target.checked)}
        />
        Hide completed containers
      </label>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>BL Number</TableHead>
              <TableHead>Container Number</TableHead>
              <TableHead>Inventory Reference</TableHead>
              <TableHead>Destination Warehouse</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Offload Scheduled</TableHead>
              <TableHead>Actual Offloaded</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-center text-muted-foreground"
                >
                  No containers to show.
                </TableCell>
              </TableRow>
            )}
            {visible.map((container) => (
              <OffloadRow key={container.id} container={container} />
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

function OffloadRow({ container }: { container: OffloadContainer }) {
  const router = useRouter()
  const [scheduledAt, setScheduledAt] = useState(
    toDatetimeLocalValue(container.offloadScheduledAt)
  )
  const [isSavingSchedule, setIsSavingSchedule] = useState(false)
  const [isConfirming, setIsConfirming] = useState(false)

  const isDirty =
    scheduledAt !== toDatetimeLocalValue(container.offloadScheduledAt)

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
      toast.error(
        err instanceof Error ? err.message : "Failed to save schedule"
      )
    } finally {
      setIsSavingSchedule(false)
    }
  }

  const handleConfirm = async () => {
    setIsConfirming(true)
    try {
      await confirmContainerOffload(container.id)
      toast.success(`${container.containerNumber} offload confirmed`)
      router.refresh()
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to confirm offload"
      )
    } finally {
      setIsConfirming(false)
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
      <TableCell>{container.inventoryReference}</TableCell>
      <TableCell>
        {container.shipment.destinationWarehouse
          ? DESTINATION_WAREHOUSE_LABELS[container.shipment.destinationWarehouse]
          : "Not yet allocated"}
      </TableCell>
      <TableCell>
        <Badge
          variant="outline"
          className={CONTAINER_STATUS_BADGE_CLASSES[container.status]}
        >
          {CONTAINER_STATUS_LABELS[container.status]}
        </Badge>
      </TableCell>
      <TableCell>
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
            {isSavingSchedule ? "Saving..." : "Save"}
          </Button>
        </div>
      </TableCell>
      <TableCell>
        {container.actualOffloadedAt ? (
          <span className="text-sm">
            {container.actualOffloadedAt.toLocaleString()}
          </span>
        ) : (
          <Button
            type="button"
            size="sm"
            disabled={isConfirming}
            onClick={handleConfirm}
          >
            {isConfirming ? "Confirming..." : "Confirm Offload"}
          </Button>
        )}
      </TableCell>
    </TableRow>
  )
}
