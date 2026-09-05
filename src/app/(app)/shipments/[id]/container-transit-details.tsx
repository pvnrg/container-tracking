"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Truck } from "lucide-react"

import {
  Autocomplete,
  AutocompleteContent,
  AutocompleteInput,
  AutocompleteItem,
} from "@/components/ui/autocomplete"
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

import { upsertContainerTransitDetails } from "./container-transit-actions"

export type ContainerTransitDetailsInfo = {
  transporterName: string
  assignmentDate: Date | null
  loadingDate: Date | null
  truckDetails: string | null
  driverDetails: string | null
  journeyStartDate: Date | null
}

export type ContainerForTransit = {
  id: string
  containerNumber: string
}

function toDateInputValue(date: Date | null) {
  return date ? date.toISOString().slice(0, 10) : ""
}

export function ContainerTransitDetailsBlock({
  containers,
  detailsByContainerId,
  transportCompanyNames,
  canManage,
}: {
  containers: ContainerForTransit[]
  detailsByContainerId: Record<string, ContainerTransitDetailsInfo>
  transportCompanyNames: string[]
  canManage: boolean
}) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-muted/30 px-3 py-2.5 text-sm">
      <span className="flex items-center gap-2 font-medium">
        <Truck className="size-4 text-muted-foreground" />
        Transit Details
      </span>

      <div className="flex flex-col gap-2">
        {containers.map((container) => (
          <ContainerTransitRow
            key={container.id}
            container={container}
            details={detailsByContainerId[container.id] ?? null}
            transportCompanyNames={transportCompanyNames}
            canManage={canManage}
          />
        ))}
      </div>
    </div>
  )
}

function ContainerTransitRow({
  container,
  details,
  transportCompanyNames,
  canManage,
}: {
  container: ContainerForTransit
  details: ContainerTransitDetailsInfo | null
  transportCompanyNames: string[]
  canManage: boolean
}) {
  return (
    <div className="flex flex-col gap-2 rounded-md border bg-background px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 flex-col gap-1">
        <span className="font-medium">{container.containerNumber}</span>
        {details ? (
          <span className="truncate text-xs text-muted-foreground">
            {details.transporterName}
            {details.truckDetails ? ` · ${details.truckDetails}` : ""}
            {details.driverDetails ? ` · ${details.driverDetails}` : ""}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">Not added yet</span>
        )}
      </div>
      {canManage && (
        <TransitDetailsDialog
          container={container}
          details={details}
          transportCompanyNames={transportCompanyNames}
        />
      )}
    </div>
  )
}

function TransitDetailsDialog({
  container,
  details,
  transportCompanyNames,
}: {
  container: ContainerForTransit
  details: ContainerTransitDetailsInfo | null
  transportCompanyNames: string[]
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
  const [driverDetails, setDriverDetails] = useState(details?.driverDetails ?? "")
  const [journeyStartDate, setJourneyStartDate] = useState(
    toDateInputValue(details?.journeyStartDate ?? null)
  )

  const reset = () => {
    setTransporterName(details?.transporterName ?? "")
    setAssignmentDate(toDateInputValue(details?.assignmentDate ?? null))
    setLoadingDate(toDateInputValue(details?.loadingDate ?? null))
    setTruckDetails(details?.truckDetails ?? "")
    setDriverDetails(details?.driverDetails ?? "")
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
      await upsertContainerTransitDetails({
        containerId: container.id,
        transporterName: transporterName.trim(),
        assignmentDate: assignmentDate || undefined,
        loadingDate: loadingDate || undefined,
        truckDetails: truckDetails.trim() || undefined,
        driverDetails: driverDetails.trim() || undefined,
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
          <DialogTitle>Transit Details — {container.containerNumber}</DialogTitle>
          <DialogDescription>
            Record the transporter, truck, and driver assigned to this
            container&apos;s road leg.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>Transporter Name</Label>
            <Autocomplete
              items={transportCompanyNames}
              value={transporterName}
              onValueChange={setTransporterName}
              openOnInputClick
            >
              <AutocompleteInput placeholder="ABC Logistics Ltd" />
              <AutocompleteContent
                emptyMessage={
                  transporterName.trim()
                    ? `"${transporterName.trim()}" will be added as a new transporter`
                    : "Start typing to add a new transporter"
                }
              >
                {(name) => (
                  <AutocompleteItem key={name} value={name}>
                    {name}
                  </AutocompleteItem>
                )}
              </AutocompleteContent>
            </Autocomplete>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>Assignment Date</Label>
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
              placeholder="Plate number, vehicle type..."
              value={truckDetails}
              onChange={(e) => setTruckDetails(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Driver Details</Label>
            <Textarea
              placeholder="Driver name, phone number..."
              value={driverDetails}
              onChange={(e) => setDriverDetails(e.target.value)}
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
