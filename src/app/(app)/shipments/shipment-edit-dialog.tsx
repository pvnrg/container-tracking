"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { RwandanDestination, ShipmentStatus } from "@prisma/client"
import { Pencil, Plus, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DESTINATION_WAREHOUSE_LABELS,
  SHIPMENT_STATUS_LABELS,
} from "@/lib/shipment-labels"

import { uploadGeneralDocuments } from "./[id]/documents-actions"
import { updateShipmentTracking } from "./tracking/actions"

export type EditableShipment = {
  id: string
  blNumber: string
  status: ShipmentStatus
  currentEta: Date
  actualDischargeDate: Date | null
  transitStartedAt: Date | null
  transitArrivalEta: Date | null
  destinationWarehouse: RwandanDestination | null
}

function toDateInputValue(date: Date) {
  return date.toISOString().slice(0, 10)
}

function toDateTimeInputValue(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

type DocRow = { title: string; file: File | null }

export function ShipmentEditDialog({
  shipment,
}: {
  shipment: EditableShipment
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [status, setStatus] = useState<ShipmentStatus>(shipment.status)
  const [currentEta, setCurrentEta] = useState(
    toDateInputValue(shipment.currentEta)
  )

  const [arrivalDateTime, setArrivalDateTime] = useState(
    toDateTimeInputValue(shipment.actualDischargeDate ?? new Date())
  )
  const [docRows, setDocRows] = useState<DocRow[]>([{ title: "", file: null }])
  const [transitStartedAt, setTransitStartedAt] = useState(
    toDateTimeInputValue(shipment.transitStartedAt ?? new Date())
  )
  const [transitArrivalEta, setTransitArrivalEta] = useState(
    shipment.transitArrivalEta
      ? toDateTimeInputValue(shipment.transitArrivalEta)
      : ""
  )
  const [destinationWarehouse, setDestinationWarehouse] = useState(
    shipment.destinationWarehouse ?? ("" as RwandanDestination)
  )

  const resetExtras = () => {
    setArrivalDateTime(toDateTimeInputValue(new Date()))
    setDocRows([{ title: "", file: null }])
    setTransitStartedAt(toDateTimeInputValue(new Date()))
    setTransitArrivalEta("")
    setDestinationWarehouse(shipment.destinationWarehouse ?? ("" as RwandanDestination))
    setError(null)
  }

  const handleSave = async () => {
    setError(null)
    if (status === "LOADED_ROAD_TRANSIT" && !destinationWarehouse) {
      setError("Select a destination warehouse")
      return
    }

    setIsSaving(true)
    try {
      await updateShipmentTracking({
        shipmentId: shipment.id,
        status,
        currentEta,
        actualDischargeDate:
          status === "ARRIVED_PORT_OF_DISCHARGE" ? arrivalDateTime : undefined,
        transitStartedAt:
          status === "LOADED_ROAD_TRANSIT" ? transitStartedAt : undefined,
        transitArrivalEta:
          status === "LOADED_ROAD_TRANSIT" && transitArrivalEta
            ? transitArrivalEta
            : undefined,
        destinationWarehouse:
          status === "LOADED_ROAD_TRANSIT" ? destinationWarehouse : undefined,
      })

      if (status === "CUSTOMS_CLEARED") {
        const rowsWithFiles = docRows.filter((r) => r.file)
        if (rowsWithFiles.length > 0) {
          const formData = new FormData()
          formData.set("shipmentId", shipment.id)
          rowsWithFiles.forEach((r) => {
            formData.append("files", r.file as File)
            formData.append("titles", r.title)
          })
          await uploadGeneralDocuments(formData)
        }
      }

      toast.success(`${shipment.blNumber} updated`)
      setOpen(false)
      resetExtras()
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update shipment")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) {
          setStatus(shipment.status)
          setCurrentEta(toDateInputValue(shipment.currentEta))
          resetExtras()
        }
      }}
    >
      <DialogTrigger
        render={
          <Button type="button" size="sm" variant="outline">
            <Pencil data-icon="inline-start" />
            Edit
          </Button>
        }
      />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit {shipment.blNumber}</DialogTitle>
          <DialogDescription>
            Update the shipment&apos;s status and ETA. Some statuses ask for
            extra details.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>Status</Label>
            <Select
              value={status}
              onValueChange={(v) => setStatus(v as ShipmentStatus)}
            >
              <SelectTrigger className="w-full">
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
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Current ETA</Label>
            <Input
              type="date"
              value={currentEta}
              onChange={(e) => setCurrentEta(e.target.value)}
            />
          </div>

          {status === "ARRIVED_PORT_OF_DISCHARGE" && (
            <div className="flex flex-col gap-1.5 rounded-lg border p-3">
              <Label>Arrived at Port -- Date &amp; Time</Label>
              <Input
                type="datetime-local"
                value={arrivalDateTime}
                onChange={(e) => setArrivalDateTime(e.target.value)}
              />
            </div>
          )}

          {status === "CUSTOMS_CLEARED" && (
            <div className="flex flex-col gap-2 rounded-lg border p-3">
              <Label>Attach Documents (optional)</Label>
              {docRows.map((row, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    placeholder="Document title"
                    value={row.title}
                    onChange={(e) => {
                      const next = [...docRows]
                      next[index] = { ...next[index], title: e.target.value }
                      setDocRows(next)
                    }}
                  />
                  <Input
                    type="file"
                    className="w-44"
                    onChange={(e) => {
                      const next = [...docRows]
                      next[index] = {
                        ...next[index],
                        file: e.target.files?.[0] ?? null,
                      }
                      setDocRows(next)
                    }}
                  />
                  {docRows.length > 1 && (
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      onClick={() =>
                        setDocRows(docRows.filter((_, i) => i !== index))
                      }
                    >
                      <Trash2 />
                    </Button>
                  )}
                </div>
              ))}
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="w-fit"
                onClick={() => setDocRows([...docRows, { title: "", file: null }])}
              >
                <Plus data-icon="inline-start" />
                Add another file
              </Button>
            </div>
          )}

          {status === "LOADED_ROAD_TRANSIT" && (
            <div className="flex flex-col gap-3 rounded-lg border p-3">
              <div className="flex flex-col gap-1.5">
                <Label>Transit Started</Label>
                <Input
                  type="datetime-local"
                  value={transitStartedAt}
                  onChange={(e) => setTransitStartedAt(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Expected Arrival at Destination</Label>
                <Input
                  type="datetime-local"
                  value={transitArrivalEta}
                  onChange={(e) => setTransitArrivalEta(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Destination Warehouse</Label>
                <Select
                  value={destinationWarehouse}
                  onValueChange={(v) =>
                    setDestinationWarehouse(v as RwandanDestination)
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select destination warehouse">
                      {(value: RwandanDestination | null) =>
                        value
                          ? DESTINATION_WAREHOUSE_LABELS[value]
                          : "Select destination warehouse"
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {Object.values(RwandanDestination).map((dest) => (
                      <SelectItem key={dest} value={dest}>
                        {DESTINATION_WAREHOUSE_LABELS[dest]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button type="button" disabled={isSaving} onClick={handleSave}>
            {isSaving ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
