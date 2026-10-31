"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { CalendarClock, Check, FileSearch, PackageCheck, Undo2 } from "lucide-react"
import { toast } from "sonner"

import { verifyDocument } from "@/app/(app)/shipments/[id]/documents-actions"
import { markContainerReturned } from "@/app/(app)/shipments/detention/actions"
import {
  confirmContainerOffload,
  scheduleContainerOffload,
} from "@/app/(app)/shipments/offload/actions"
import { updateShipmentTracking } from "@/app/(app)/shipments/tracking/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { AssistantQuickAction } from "@/lib/assistant-alerts"

// UTC date, matching the ETA Tracking page's date inputs.
function toDateInputValue(date: Date) {
  return date.toISOString().slice(0, 10)
}

// Local time, matching the Offload Scheduling page's datetime inputs.
function toDatetimeLocalValue(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function tomorrowAtNine() {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  d.setHours(9, 0, 0, 0)
  return d
}

/**
 * The in-panel fix for one alert. Every action here is an existing server
 * action (the same one the full page uses), so validation, permissions,
 * audit logging, and status auto-advance all behave exactly as they do
 * there. `onDone` lets the panel drop the alert and re-check right away.
 */
export function QuickAction({
  action,
  onDone,
}: {
  action: AssistantQuickAction
  onDone: () => void
}) {
  const router = useRouter()
  const [step, setStep] = useState<"idle" | "confirm" | "form">("idle")
  const [value, setValue] = useState("")
  const [fileOpened, setFileOpened] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function run(work: () => Promise<unknown>, successMessage: string) {
    setSaving(true)
    try {
      await work()
      toast.success(successMessage)
      router.refresh()
      onDone()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "That didn't work. Try again.")
      setSaving(false)
    }
  }

  function openForm(initial: string) {
    setValue(initial)
    setError(null)
    setStep("form")
  }

  const cancel = (
    <Button size="xs" variant="ghost" disabled={saving} onClick={() => setStep("idle")}>
      Cancel
    </Button>
  )

  if (step === "confirm") {
    const isReturn = action.type === "markReturned"
    const confirm = () => {
      if (action.type === "markReturned") {
        void run(() => markContainerReturned(action.containerId), "Marked as returned to depot")
      } else if (action.type === "confirmOffload") {
        void run(() => confirmContainerOffload(action.containerId), "Offload confirmed")
      }
    }
    return (
      <div className="flex w-full flex-wrap items-center gap-1 rounded-md bg-muted/60 px-2 py-1.5">
        <span className="mr-1 text-xs">
          {isReturn ? "Returned to the depot today?" : "Offloaded and unsealed now?"}
        </span>
        <Button size="xs" disabled={saving} onClick={confirm}>
          <Check data-icon="inline-start" />
          {saving ? "Saving…" : "Yes, confirm"}
        </Button>
        {cancel}
      </div>
    )
  }

  if (step === "form") {
    const isEta = action.type === "updateEta"
    const save = () => {
      if (!value) {
        setError(isEta ? "Pick the new ETA" : "Pick a date and time")
        return
      }
      if (action.type === "updateEta") {
        void run(
          () =>
            updateShipmentTracking({
              shipmentId: action.shipmentId,
              status: action.status,
              currentEta: value,
            }),
          "ETA updated"
        )
      } else if (action.type === "scheduleOffload") {
        void run(
          () =>
            scheduleContainerOffload({
              containerId: action.containerId,
              offloadScheduledAt: value,
            }),
          "Offload scheduled"
        )
      }
    }
    return (
      <div className="flex w-full flex-col gap-1 rounded-md bg-muted/60 px-2 py-1.5">
        <label className="text-xs" htmlFor={`qa-${action.type}`}>
          {isEta ? "New ETA" : "Offload date and time"}
        </label>
        <Input
          id={`qa-${action.type}`}
          type={isEta ? "date" : "datetime-local"}
          className="h-8 w-full text-sm"
          value={value}
          aria-invalid={error ? true : undefined}
          onChange={(e) => {
            setValue(e.target.value)
            setError(null)
          }}
        />
        {error && <p className="text-xs text-destructive">{error}</p>}
        <div className="flex items-center gap-1">
          <Button size="xs" disabled={saving} onClick={save}>
            {saving ? "Saving…" : "Save"}
          </Button>
          {cancel}
        </div>
      </div>
    )
  }

  switch (action.type) {
    case "markReturned":
      return (
        <Button size="xs" variant="outline" onClick={() => setStep("confirm")}>
          <Undo2 data-icon="inline-start" />
          Mark returned
        </Button>
      )
    case "confirmOffload":
      return (
        <Button size="xs" variant="outline" onClick={() => setStep("confirm")}>
          <PackageCheck data-icon="inline-start" />
          Confirm offload
        </Button>
      )
    case "scheduleOffload":
      return (
        <Button
          size="xs"
          variant="outline"
          onClick={() => openForm(toDatetimeLocalValue(tomorrowAtNine()))}
        >
          <CalendarClock data-icon="inline-start" />
          Schedule
        </Button>
      )
    case "updateEta":
      return (
        <Button
          size="xs"
          variant="outline"
          onClick={() => openForm(toDateInputValue(new Date()))}
        >
          <CalendarClock data-icon="inline-start" />
          Set new ETA
        </Button>
      )
    case "verifyDocument":
      // Verifying is a judgement call, so the file has to be opened first;
      // "Mark verified" only appears after that.
      return (
        <>
          <Button
            size="xs"
            variant="outline"
            render={
              <a
                href={`/api/documents/${action.documentId}/download`}
                target="_blank"
                rel="noopener noreferrer"
              />
            }
            nativeButton={false}
            onClick={() => setFileOpened(true)}
          >
            <FileSearch data-icon="inline-start" />
            Review file
          </Button>
          {fileOpened && (
            <Button
              size="xs"
              disabled={saving}
              onClick={() => run(() => verifyDocument(action.documentId), "Document verified")}
            >
              <Check data-icon="inline-start" />
              {saving ? "Saving…" : "Mark verified"}
            </Button>
          )}
        </>
      )
  }
}
