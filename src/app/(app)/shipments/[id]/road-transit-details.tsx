"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Truck } from "lucide-react"

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
import { Textarea } from "@/components/ui/textarea"
import { formatDate } from "@/lib/format"

import { upsertRoadTransitDetails } from "./road-transit-actions"

export type RoadTransitDetailsInfo = {
  transporterName: string
  assignmentDate: Date | null
  loadingDate: Date | null
  truckDetails: string | null
  journeyStartDate: Date | null
}

function toDateInputValue(date: Date | null) {
  return date ? date.toISOString().slice(0, 10) : ""
}

export function RoadTransitDetailsBlock({
  shipmentId,
  details,
  canManage,
}: {
  shipmentId: string
  details: RoadTransitDetailsInfo | null
  canManage: boolean
}) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-muted/30 px-3 py-2.5 text-sm">
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 font-medium">
          <Truck className="size-4 text-muted-foreground" />
          Transit Details
        </span>
        {canManage && (
          <TransitDetailsDialog shipmentId={shipmentId} details={details} />
        )}
      </div>

      {details ? (
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
          <Field label="Transporter" value={details.transporterName} />
          <Field
            label="Assignment Date"
            value={details.assignmentDate ? formatDate(details.assignmentDate) : "—"}
          />
          <Field
            label="Loading Date"
            value={details.loadingDate ? formatDate(details.loadingDate) : "—"}
          />
          <Field
            label="Journey Start"
            value={
              details.journeyStartDate ? formatDate(details.journeyStartDate) : "—"
            }
          />
          <Field
            label="Truck Details"
            value={details.truckDetails ?? "—"}
            className="col-span-2 sm:col-span-3"
          />
        </div>
      ) : (
        <p className="text-muted-foreground">No transit details recorded yet</p>
      )}
    </div>
  )
}

function Field({
  label,
  value,
  className,
}: {
  label: string
  value: string
  className?: string
}) {
  return (
    <div className={`flex flex-col gap-0.5 ${className ?? ""}`}>
      <span className="text-xs text-muted-foreground">{label}</span>
      <span>{value}</span>
    </div>
  )
}

function TransitDetailsDialog({
  shipmentId,
  details,
}: {
  shipmentId: string
  details: RoadTransitDetailsInfo | null
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [transporterName, setTransporterName] = useState(
    details?.transporterName ?? ""
  )
  const [assignmentDate, setAssignmentDate] = useState(
    toDateInputValue(details?.assignmentDate ?? null)
  )
  const [loadingDate, setLoadingDate] = useState(
    toDateInputValue(details?.loadingDate ?? null)
  )
  const [truckDetails, setTruckDetails] = useState(details?.truckDetails ?? "")
  const [journeyStartDate, setJourneyStartDate] = useState(
    toDateInputValue(details?.journeyStartDate ?? null)
  )

  const reset = () => {
    setTransporterName(details?.transporterName ?? "")
    setAssignmentDate(toDateInputValue(details?.assignmentDate ?? null))
    setLoadingDate(toDateInputValue(details?.loadingDate ?? null))
    setTruckDetails(details?.truckDetails ?? "")
    setJourneyStartDate(toDateInputValue(details?.journeyStartDate ?? null))
    setError(null)
  }

  const handleSave = async () => {
    setError(null)
    if (!transporterName.trim()) {
      setError("Transporter name is required")
      return
    }
    setIsSaving(true)
    try {
      await upsertRoadTransitDetails({
        shipmentId,
        transporterName: transporterName.trim(),
        assignmentDate: assignmentDate || undefined,
        loadingDate: loadingDate || undefined,
        truckDetails: truckDetails.trim() || undefined,
        journeyStartDate: journeyStartDate || undefined,
      })
      toast.success("Transit details saved")
      setOpen(false)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save transit details")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) reset()
      }}
    >
      <DialogTrigger
        render={
          <Button type="button" size="sm" variant="outline">
            <Truck data-icon="inline-start" />
            {details ? "Edit Details" : "Add Details"}
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Road Transit Details</DialogTitle>
          <DialogDescription>
            Record the transporter and dispatch schedule for this shipment&apos;s
            road leg.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>Transporter Name</Label>
            <Input
              value={transporterName}
              onChange={(e) => setTransporterName(e.target.value)}
              placeholder="ABC Logistics Ltd"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>Shipment Assignment Date</Label>
              <Input
                type="date"
                value={assignmentDate}
                onChange={(e) => setAssignmentDate(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Loading Date</Label>
              <Input
                type="date"
                value={loadingDate}
                onChange={(e) => setLoadingDate(e.target.value)}
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Journey Start Date</Label>
            <Input
              type="date"
              value={journeyStartDate}
              onChange={(e) => setJourneyStartDate(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Truck Details</Label>
            <Textarea
              placeholder="Plate number, driver name, vehicle type..."
              value={truckDetails}
              onChange={(e) => setTruckDetails(e.target.value)}
            />
          </div>

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
