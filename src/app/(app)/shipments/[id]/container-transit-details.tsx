"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Plus, Trash2, Truck, User } from "lucide-react"

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
import { formatDate } from "@/lib/format"

import { upsertContainerTransitDetails } from "./container-transit-actions"

export type TransitDriverInfo = {
  id: string
  name: string
  phone: string | null
}

export type ContainerTransitDetailsInfo = {
  transporterName: string
  assignmentDate: Date | null
  loadingDate: Date | null
  truckDetails: string | null
  journeyStartDate: Date | null
  drivers: TransitDriverInfo[]
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
    <div className="flex flex-col gap-2.5 rounded-md border bg-background px-3 py-2.5">
      <div className="flex items-center justify-between gap-3">
        <span className="font-medium">{container.containerNumber}</span>
        {canManage && (
          <TransitDetailsDialog
            container={container}
            details={details}
            transportCompanyNames={transportCompanyNames}
          />
        )}
      </div>

      {details ? (
        <div className="flex flex-col gap-2.5 border-t pt-2.5">
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-3">
            <TransitField label="Transporter" value={details.transporterName} />
            <TransitField
              label="Truck Details"
              value={details.truckDetails ?? "—"}
            />
            <TransitField
              label="Assignment Date"
              value={
                details.assignmentDate ? formatDate(details.assignmentDate) : "—"
              }
            />
            <TransitField
              label="Loading Date"
              value={details.loadingDate ? formatDate(details.loadingDate) : "—"}
            />
            <TransitField
              label="Journey Start"
              value={
                details.journeyStartDate
                  ? formatDate(details.journeyStartDate)
                  : "—"
              }
            />
          </div>

          <div className="flex flex-col gap-1 text-xs">
            <span className="text-muted-foreground">Drivers</span>
            {details.drivers.length === 0 ? (
              <span className="font-medium text-foreground">—</span>
            ) : (
              <div className="flex flex-col gap-1">
                {details.drivers.map((driver) => (
                  <div
                    key={driver.id}
                    className="flex items-center gap-1.5 font-medium text-foreground"
                  >
                    <User className="size-3 shrink-0 text-muted-foreground" />
                    <span>{driver.name}</span>
                    {driver.phone && (
                      <span className="font-normal text-muted-foreground">
                        · {driver.phone}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <span className="text-xs text-muted-foreground">Not added yet</span>
      )}
    </div>
  )
}

function TransitField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium break-words text-foreground">{value}</span>
    </div>
  )
}

type DriverDraft = { name: string; phone: string }

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

  const initialDrivers = (): DriverDraft[] =>
    details?.drivers.map((d) => ({ name: d.name, phone: d.phone ?? "" })) ?? []

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
  const [drivers, setDrivers] = useState<DriverDraft[]>(initialDrivers)

  const reset = () => {
    setTransporterName(details?.transporterName ?? "")
    setAssignmentDate(toDateInputValue(details?.assignmentDate ?? null))
    setLoadingDate(toDateInputValue(details?.loadingDate ?? null))
    setTruckDetails(details?.truckDetails ?? "")
    setJourneyStartDate(toDateInputValue(details?.journeyStartDate ?? null))
    setDrivers(initialDrivers())
    setError(null)
  }

  const updateDriver = (index: number, field: keyof DriverDraft, value: string) => {
    setDrivers((prev) =>
      prev.map((d, i) => (i === index ? { ...d, [field]: value } : d))
    )
  }

  const removeDriver = (index: number) => {
    setDrivers((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSave = async () => {
    setError(null)
    if (!transporterName.trim()) {
      setError("Transporter name is required")
      return
    }
    const cleanedDrivers = drivers
      .map((d) => ({ name: d.name.trim(), phone: d.phone.trim() }))
      .filter((d) => d.name || d.phone)
    if (cleanedDrivers.some((d) => !d.name)) {
      setError("Each driver needs a name")
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
        journeyStartDate: journeyStartDate || undefined,
        drivers: cleanedDrivers.map((d) => ({
          name: d.name,
          phone: d.phone || undefined,
        })),
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
            Record the transporter, truck, and driver(s) assigned to this
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

          <div className="flex flex-col gap-2">
            <Label>Drivers</Label>
            {drivers.length > 0 && (
              <div className="flex flex-col gap-2">
                {drivers.map((driver, index) => (
                  <div key={index} className="flex items-start gap-2">
                    <Input
                      value={driver.name}
                      onChange={(e) => updateDriver(index, "name", e.target.value)}
                      placeholder="Driver name"
                      className="flex-1"
                    />
                    <Input
                      value={driver.phone}
                      onChange={(e) => updateDriver(index, "phone", e.target.value)}
                      placeholder="Phone number"
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() => removeDriver(index)}
                      className="shrink-0 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="self-start"
              onClick={() => setDrivers((prev) => [...prev, { name: "", phone: "" }])}
            >
              <Plus data-icon="inline-start" />
              Add Driver
            </Button>
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
