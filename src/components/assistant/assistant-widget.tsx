"use client"

import { useCallback, useEffect, useRef, useState, useTransition } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Anchor,
  ArrowRight,
  ArrowRightLeft,
  BellOff,
  Bot,
  CalendarClock,
  CircleCheck,
  FileCheck,
  FileWarning,
  Flame,
  Ship,
  Truck,
  X,
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  AssistantAlert,
  AssistantAlertKind,
  AssistantSeverity,
  countBySeverity,
  greetingFor,
  snoozeHoursForKey,
  sortAssistantAlerts,
  summaryLine,
} from "@/lib/assistant-alerts"
import { cn } from "@/lib/utils"

import { snoozeAssistantAlert } from "./actions"
import { QuickAction } from "./quick-action"

const REFRESH_MS = 2 * 60 * 1000
// Once per browser session: open the panel by itself the first time a
// critical alert is waiting, so it's seen right after login.
const AUTO_OPENED_KEY = "assistant:auto-opened"

const KIND_ICONS: Record<AssistantAlertKind, typeof Bot> = {
  detention: Flame,
  stage2: FileWarning,
  paperwork: ArrowRightLeft,
  eta: CalendarClock,
  offload: Anchor,
  verify: FileCheck,
  arriving: Ship,
  pickup: Truck,
}

// Same red / amber / sky family the dashboard's attention chips use.
const SEVERITY_CLASSES: Record<AssistantSeverity, string> = {
  critical: "bg-red-500/10 text-red-700 dark:text-red-400",
  warning: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  info: "bg-sky-500/10 text-sky-700 dark:text-sky-400",
}

const SEVERITY_LABELS: Record<AssistantSeverity, string> = {
  critical: "Urgent",
  warning: "To do",
  info: "FYI",
}

// /shipments/<id>, but not the static pages that share that prefix.
function shipmentIdFromPath(pathname: string) {
  const match = pathname.match(/^\/shipments\/([^/]+)$/)
  if (!match || ["new", "tracking", "offload", "detention"].includes(match[1])) {
    return null
  }
  return match[1]
}

// null on any failure (offline, server restarting, signed out) -- the
// widget then keeps showing the last result it had.
async function fetchAlerts(): Promise<{ alerts: AssistantAlert[] } | null> {
  try {
    const res = await fetch("/api/assistant/alerts", { cache: "no-store" })
    return res.ok ? await res.json() : null
  } catch {
    return null
  }
}

function readSessionFlag(key: string) {
  try {
    return window.sessionStorage.getItem(key) === "1"
  } catch {
    return false
  }
}

function writeSessionFlag(key: string) {
  try {
    window.sessionStorage.setItem(key, "1")
  } catch {
    // Private mode / blocked storage: worst case the panel auto-opens again.
  }
}

export function AssistantWidget({ firstName }: { firstName: string }) {
  const pathname = usePathname()
  const [alerts, setAlerts] = useState<AssistantAlert[] | null>(null)
  const [open, setOpen] = useState(false)
  const [shakeCount, setShakeCount] = useState(0)
  const [, startSnooze] = useTransition()
  const seenKeys = useRef<Set<string> | null>(null)

  // Split from the fetch so effects only ever set state from a promise
  // callback, never synchronously in the effect body.
  const applyAlerts = useCallback((data: { alerts: AssistantAlert[] } | null) => {
    if (!data) return

    // Shake the robot when something actionable shows up that wasn't
    // there on the previous check (not on the very first load).
    const previous = seenKeys.current
    if (
      previous &&
      data.alerts.some((a) => a.severity !== "info" && !previous.has(a.key))
    ) {
      setShakeCount((n) => n + 1)
    }
    seenKeys.current = new Set(data.alerts.map((a) => a.key))

    if (
      data.alerts.some((a) => a.severity === "critical") &&
      !readSessionFlag(AUTO_OPENED_KEY)
    ) {
      writeSessionFlag(AUTO_OPENED_KEY)
      setOpen(true)
    }

    setAlerts(data.alerts)
  }, [])

  const refresh = useCallback(() => fetchAlerts().then(applyAlerts), [applyAlerts])

  // Re-check on every navigation (the user may just have fixed something)
  // and on a timer, plus whenever the tab comes back into view.
  useEffect(() => {
    void fetchAlerts().then(applyAlerts)
  }, [pathname, applyAlerts])

  useEffect(() => {
    const timer = window.setInterval(() => void refresh(), REFRESH_MS)
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh()
    }
    document.addEventListener("visibilitychange", onVisible)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener("visibilitychange", onVisible)
    }
  }, [refresh])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open])

  const currentShipmentId = shipmentIdFromPath(pathname)
  const sorted = alerts ? sortAssistantAlerts(alerts, currentShipmentId) : []
  const counts = countBySeverity(sorted)
  const hasCritical = counts.critical > 0

  // A quick action fixed it: drop it now, then re-check, since one fix can
  // clear or create other alerts (e.g. verifying a document can advance
  // the shipment's status).
  function resolve(alert: AssistantAlert) {
    setAlerts((current) => current?.filter((a) => a.key !== alert.key) ?? null)
    seenKeys.current?.delete(alert.key)
    void refresh()
  }

  function snooze(alert: AssistantAlert) {
    setAlerts((current) => current?.filter((a) => a.key !== alert.key) ?? null)
    startSnooze(async () => {
      try {
        await snoozeAssistantAlert(alert.key)
        const hours = snoozeHoursForKey(alert.key)
        toast.success(`Snoozed for ${hours === 24 ? "a day" : `${hours} hours`}`)
      } catch {
        toast.error("Couldn't snooze that alert. Try again.")
      }
      await refresh()
    })
  }

  return (
    <>
      {open && (
        <div
          role="dialog"
          aria-label="Assistant"
          className="fixed right-4 bottom-22 z-50 flex max-h-[min(34rem,calc(100svh-8rem))] w-[min(23rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-xl border bg-background shadow-xl animate-in fade-in slide-in-from-bottom-2 duration-200"
        >
          <div className="flex items-center gap-3 border-b px-4 py-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Bot className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">
                {greetingFor(new Date())}, {firstName}
              </p>
              <p className="text-xs text-muted-foreground">
                {alerts ? summaryLine(sorted) : "Checking your shipments…"}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Close assistant"
              onClick={() => setOpen(false)}
            >
              <X />
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {alerts && sorted.length === 0 && (
              <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
                <CircleCheck className="size-8 text-emerald-600 dark:text-emerald-400" />
                <p className="text-sm font-medium">Nothing needs you right now</p>
                <p className="text-xs text-muted-foreground">
                  I&apos;ll let you know as soon as something does.
                </p>
              </div>
            )}

            <ul className="divide-y">
              {sorted.map((alert) => {
                const Icon = KIND_ICONS[alert.kind]
                const isHere = currentShipmentId != null && alert.shipmentId === currentShipmentId
                return (
                  <li key={alert.key} className="flex gap-3 px-4 py-3">
                    <span
                      className={cn(
                        "flex size-8 shrink-0 items-center justify-center rounded-lg",
                        SEVERITY_CLASSES[alert.severity]
                      )}
                    >
                      <Icon className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm leading-snug font-medium">{alert.title}</p>
                        <span
                          className={cn(
                            "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium",
                            SEVERITY_CLASSES[alert.severity]
                          )}
                        >
                          {SEVERITY_LABELS[alert.severity]}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {isHere && (
                          <span className="font-medium text-primary">This shipment · </span>
                        )}
                        {alert.detail}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-1">
                        {alert.quickAction && (
                          <QuickAction
                            action={alert.quickAction}
                            onDone={() => resolve(alert)}
                          />
                        )}
                        <Button
                          size="xs"
                          // The in-panel fix leads when there is one; the
                          // full page becomes the secondary route.
                          variant={alert.quickAction ? "ghost" : "outline"}
                          render={<Link href={alert.href} />}
                          nativeButton={false}
                          onClick={() => setOpen(false)}
                        >
                          {alert.actionLabel}
                          <ArrowRight data-icon="inline-end" />
                        </Button>
                        <Button
                          size="xs"
                          variant="ghost"
                          className="text-muted-foreground"
                          onClick={() => snooze(alert)}
                        >
                          <BellOff data-icon="inline-start" />
                          Snooze
                        </Button>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>

          <div className="border-t px-4 py-2 text-right">
            <Link
              href="/notifications"
              className="text-xs text-primary hover:underline"
              onClick={() => setOpen(false)}
            >
              View all notifications
            </Link>
          </div>
        </div>
      )}

      <button
        key={shakeCount}
        type="button"
        aria-label={
          sorted.length > 0
            ? `Open assistant, ${sorted.length} alert${sorted.length === 1 ? "" : "s"}`
            : "Open assistant"
        }
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "fixed right-4 bottom-4 z-50 flex size-14 cursor-pointer items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105 active:scale-95",
          // The ring color follows currentColor; the wrapper keeps the
          // glyph itself white while the ring pulses red.
          hasCritical && !open && "animate-pulse-ring text-red-500",
          shakeCount > 0 && "animate-attention-shake"
        )}
      >
        <Bot className="size-7 text-primary-foreground" />
        {sorted.length > 0 && (
          <span
            className={cn(
              "absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] font-semibold text-white ring-2 ring-background",
              hasCritical ? "bg-red-600" : counts.warning > 0 ? "bg-amber-500" : "bg-sky-600"
            )}
          >
            {sorted.length > 99 ? "99+" : sorted.length}
          </span>
        )}
      </button>
    </>
  )
}
