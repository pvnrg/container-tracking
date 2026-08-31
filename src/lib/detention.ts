export type DetentionRiskLevel = "normal" | "warning" | "critical" | "overdue"

export function getDetentionRisk(deadlineDate: Date): {
  level: DetentionRiskLevel
  daysRemaining: number
} {
  const daysRemaining = Math.ceil(
    (deadlineDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  )

  if (daysRemaining < 0) return { level: "overdue", daysRemaining }
  if (daysRemaining < 7) return { level: "critical", daysRemaining }
  if (daysRemaining <= 15) return { level: "warning", daysRemaining }
  return { level: "normal", daysRemaining }
}

export const DETENTION_RISK_LABELS: Record<DetentionRiskLevel, string> = {
  normal: "Normal",
  warning: "Warning",
  critical: "Critical",
  overdue: "Overdue",
}

export const DETENTION_RISK_CLASSES: Record<DetentionRiskLevel, string> = {
  normal: "border-emerald-600/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  warning: "border-amber-600/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  critical: "border-destructive/40 bg-destructive/10 text-destructive",
  overdue: "border-destructive bg-destructive/15 text-destructive font-medium",
}
