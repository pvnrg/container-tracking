import { DetentionRiskLevel } from "./detention"
import { formatDate } from "./format"

// Pure half of the floating assistant's alert engine -- types, wording,
// and ordering only, no Prisma -- so the client widget can import it
// without pulling the database client into the browser bundle. The queries
// that feed it live in assistant-alerts-server.ts.

export type AssistantSeverity = "critical" | "warning" | "info"

// Picks the icon the widget shows; kept separate from severity so two
// alerts of the same urgency still read as different kinds of work.
export type AssistantAlertKind =
  | "detention"
  | "stage2"
  | "paperwork"
  | "eta"
  | "offload"
  | "verify"
  | "arriving"
  | "pickup"

export type AssistantAlert = {
  // Stable across requests, and the snooze key -- see AssistantSnooze in
  // schema.prisma for why severity is part of it where it can change.
  key: string
  severity: AssistantSeverity
  kind: AssistantAlertKind
  title: string
  detail: string
  actionLabel: string
  href: string
  shipmentId?: string
}

const SEVERITY_RANK: Record<AssistantSeverity, number> = {
  critical: 0,
  warning: 1,
  info: 2,
}

// Critical alerts stay snoozable, but only briefly -- an overdue container
// keeps costing money, so it shouldn't disappear for a whole day.
export const SNOOZE_HOURS: Record<AssistantSeverity, number> = {
  critical: 4,
  warning: 24,
  info: 24,
}

/**
 * Snooze length for an alert, worked out from its key alone so the server
 * never has to trust a severity sent by the browser. Only detention alerts
 * are ever critical, and their key carries the risk level (see
 * buildDetentionAlert).
 */
export function snoozeHoursForKey(key: string) {
  return /^detention:.+:(critical|overdue)$/.test(key)
    ? SNOOZE_HOURS.critical
    : SNOOZE_HOURS.warning
}

/**
 * Most urgent first. Alerts for `currentShipmentId` (the shipment page the
 * user is on) jump ahead of everything else, since that's what they're
 * already looking at; order within each group is otherwise preserved.
 */
export function sortAssistantAlerts(
  alerts: AssistantAlert[],
  currentShipmentId?: string | null
): AssistantAlert[] {
  const inContext = (a: AssistantAlert) =>
    currentShipmentId != null && a.shipmentId === currentShipmentId ? 0 : 1

  return alerts
    .map((alert, index) => ({ alert, index }))
    .sort(
      (a, b) =>
        inContext(a.alert) - inContext(b.alert) ||
        SEVERITY_RANK[a.alert.severity] - SEVERITY_RANK[b.alert.severity] ||
        a.index - b.index
    )
    .map(({ alert }) => alert)
}

export function countBySeverity(alerts: AssistantAlert[]) {
  const counts: Record<AssistantSeverity, number> = { critical: 0, warning: 0, info: 0 }
  for (const alert of alerts) counts[alert.severity]++
  return counts
}

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? "" : "s"}`
}

export type DetentionAlertInput = {
  trackerId: string
  containerNumber: string
  shipmentId: string
  blNumber: string
  deadlineDate: Date
  level: DetentionRiskLevel
  daysRemaining: number
}

/**
 * One container's detention alert, worded for who's reading it: ops can
 * act on the detention page, while a transporter can't change anything in
 * the app (every detention action requires ADMIN/LOGISTICS_OPERATOR) and is
 * pointed at the shipment for the details they need to return it.
 */
export function buildDetentionAlert(
  input: DetentionAlertInput,
  audience: "ops" | "transporter"
): AssistantAlert | null {
  if (input.level === "normal") return null

  const severity: AssistantSeverity = input.level === "warning" ? "warning" : "critical"
  const title =
    input.level === "overdue"
      ? `${input.containerNumber} is past its free time`
      : audience === "transporter"
        ? `Return ${input.containerNumber} to the depot`
        : `${input.containerNumber} is running out of free time`
  const timing =
    input.level === "overdue"
      ? `${plural(-input.daysRemaining, "day")} overdue — detention charges are running`
      : `${plural(input.daysRemaining, "day")} left · deadline ${formatDate(input.deadlineDate)}`

  return {
    key: `detention:${input.trackerId}:${input.level}`,
    severity,
    kind: "detention",
    title,
    detail: `${timing} · ${input.blNumber}`,
    actionLabel: audience === "transporter" ? "View shipment" : "Open detention",
    href: audience === "transporter" ? `/shipments/${input.shipmentId}` : "/shipments/detention",
    shipmentId: input.shipmentId,
  }
}

export function greetingFor(date: Date) {
  const hour = date.getHours()
  if (hour < 12) return "Good morning"
  if (hour < 17) return "Good afternoon"
  return "Good evening"
}

export function summaryLine(alerts: AssistantAlert[]) {
  if (alerts.length === 0) return "You're all caught up"
  const { critical } = countBySeverity(alerts)
  const base = `${plural(alerts.length, "thing")} need${alerts.length === 1 ? "s" : ""} your attention`
  return critical > 0 ? `${base} · ${critical} urgent` : base
}
