"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { MapPin, Trash2 } from "lucide-react"

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
import { formatDateTime } from "@/lib/format"

import type { ContainerForTransit } from "./container-transit-details"
import {
  addTruckStatusUpdate,
  deleteTruckStatusUpdate,
} from "./truck-status-actions"

export type TruckStatusUpdateInfo = {
  id: string
  location: string
  timestamp: Date
  notes: string | null
  createdBy: { name: string }
}

function toDateTimeInputValue(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function TruckStatusUpdatesBlock({
  containers,
  updatesByContainerId,
  canManage,
}: {
  containers: ContainerForTransit[]
  updatesByContainerId: Record<string, TruckStatusUpdateInfo[]>
  canManage: boolean
}) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-muted/30 px-3 py-2.5 text-sm">
      <span className="flex items-center gap-2 font-medium">
        <MapPin className="size-4 text-muted-foreground" />
        Truck Status Updates
      </span>

      <div className="flex flex-col gap-2">
        {containers.map((container) => (
          <TruckStatusRow
            key={container.id}
            container={container}
            updates={updatesByContainerId[container.id] ?? []}
            canManage={canManage}
          />
        ))}
      </div>
    </div>
  )
}

function TruckStatusRow({
  container,
  updates,
  canManage,
}: {
  container: ContainerForTransit
  updates: TruckStatusUpdateInfo[]
  canManage: boolean
}) {
  const router = useRouter()
  const [busyId, setBusyId] = useState<string | null>(null)

  const handleDelete = async (updateId: string) => {
    setBusyId(updateId)
    try {
      await deleteTruckStatusUpdate(updateId)
      toast.success("Truck status update deleted")
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete update")
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border bg-background px-3 py-2">
      <div className="flex items-center justify-between gap-3">
        <span className="font-medium">{container.containerNumber}</span>
        {canManage && <AddUpdateDialog container={container} />}
      </div>

      {updates.length === 0 ? (
        <span className="text-xs text-muted-foreground">No updates yet</span>
      ) : (
        <div className="flex flex-col gap-2 border-l pl-3">
          {updates.map((update) => (
            <div
              key={update.id}
              className="flex items-start justify-between gap-2 text-xs"
            >
              <div className="flex min-w-0 flex-col">
                <span className="font-medium text-foreground">
                  {update.location}
                </span>
                <span className="text-muted-foreground">
                  {formatDateTime(update.timestamp)} · {update.createdBy.name}
                </span>
                {update.notes && (
                  <span className="mt-0.5 text-muted-foreground italic">
                    &ldquo;{update.notes}&rdquo;
                  </span>
                )}
              </div>
              {canManage && (
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  disabled={busyId === update.id}
                  onClick={() => handleDelete(update.id)}
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function AddUpdateDialog({ container }: { container: ContainerForTransit }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [location, setLocation] = useState("")
  const [timestamp, setTimestamp] = useState(toDateTimeInputValue(new Date()))
  const [notes, setNotes] = useState("")

  const reset = () => {
    setLocation("")
    setTimestamp(toDateTimeInputValue(new Date()))
    setNotes("")
    setError(null)
  }

  const handleSave = async () => {
    setError(null)
    if (!location.trim()) {
      setError("Location is required")
      return
    }
    setIsSaving(true)
    try {
      await addTruckStatusUpdate({
        containerId: container.id,
        location: location.trim(),
        timestamp,
        notes: notes.trim() || undefined,
      })
      toast.success("Truck status update added")
      setOpen(false)
      reset()
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add update")
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
            <MapPin data-icon="inline-start" />
            Add Update
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Truck Status — {container.containerNumber}</DialogTitle>
          <DialogDescription>
            Record where this container&apos;s truck is right now.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>Location</Label>
            <Input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Nairobi border checkpoint"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Timestamp</Label>
            <Input
              type="datetime-local"
              value={timestamp}
              onChange={(e) => setTimestamp(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Notes (optional)</Label>
            <Textarea
              placeholder="Any additional context..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
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
