"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { DischargePort, ShipmentStatus } from "@prisma/client"
import { ListFilter, Save } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/empty-state"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
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

function toDateInputValue(date: Date) {
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

export function TrackingTable({
  shipments,
}: {
  shipments: TrackingShipment[]
}) {
  const [hideCompleted, setHideCompleted] = useState(false)

  const visible = useMemo(
    () =>
      hideCompleted
        ? shipments.filter((s) => s.status !== "COMPLETED")
        : shipments,
    [shipments, hideCompleted]
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
        Hide completed shipments
      </label>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>BL Number</TableHead>
              <TableHead>Shipping Line</TableHead>
              <TableHead>Discharge Port</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Current ETA</TableHead>
              <TableHead>Countdown</TableHead>
              <TableHead className="text-right">Save</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="p-0">
                  <EmptyState
                    icon={ListFilter}
                    title="No shipments to show"
                    description={
                      hideCompleted
                        ? 'Try unchecking "Hide completed shipments".'
                        : "There are no shipments to track yet."
                    }
                  />
                </TableCell>
              </TableRow>
            )}
            {visible.map((shipment) => (
              <TrackingRow key={shipment.id} shipment={shipment} />
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

function TrackingRow({ shipment }: { shipment: TrackingShipment }) {
  const router = useRouter()
  const [status, setStatus] = useState<ShipmentStatus>(shipment.status)
  const [currentEta, setCurrentEta] = useState(
    toDateInputValue(shipment.currentEta)
  )
  const [isSaving, setIsSaving] = useState(false)

  const isDirty =
    status !== shipment.status ||
    currentEta !== toDateInputValue(shipment.currentEta)

  const countdown = formatCountdown(new Date(currentEta), status)

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await updateShipmentTracking({
        shipmentId: shipment.id,
        status,
        currentEta,
      })
      toast.success(`${shipment.blNumber} updated`)
      router.refresh()
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to update shipment"
      )
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <TableRow>
      <TableCell className="font-medium">{shipment.blNumber}</TableCell>
      <TableCell>{shipment.shippingLine}</TableCell>
      <TableCell>{DISCHARGE_PORT_LABELS[shipment.dischargePort]}</TableCell>
      <TableCell>
        <Select
          value={status}
          onValueChange={(v) => setStatus(v as ShipmentStatus)}
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
      </TableCell>
      <TableCell>
        <Input
          type="date"
          className="w-40"
          value={currentEta}
          onChange={(e) => setCurrentEta(e.target.value)}
        />
      </TableCell>
      <TableCell>
        <Badge variant="outline" className={countdown.className}>
          {countdown.text}
        </Badge>
      </TableCell>
      <TableCell className="text-right">
        <Button
          type="button"
          size="sm"
          disabled={!isDirty || isSaving}
          onClick={handleSave}
        >
          <Save data-icon="inline-start" />
          {isSaving ? "Saving..." : "Save"}
        </Button>
      </TableCell>
    </TableRow>
  )
}
