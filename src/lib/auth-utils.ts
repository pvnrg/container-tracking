import { UserRole } from "@prisma/client"

import { auth } from "@/auth"

export async function requireRole(roles: UserRole[]) {
  const session = await auth()
  if (!session?.user || !roles.includes(session.user.role)) {
    throw new Error("Forbidden")
  }
  return session
}

export const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: "Administrator",
  LOGISTICS_OPERATOR: "Logistics Operator",
  TRANSPORTER: "Transporter",
}

export const ROLE_BADGE_CLASSES: Record<UserRole, string> = {
  ADMIN: "border-violet-600/30 bg-violet-500/10 text-violet-700 dark:text-violet-400",
  LOGISTICS_OPERATOR:
    "border-sky-600/30 bg-sky-500/10 text-sky-700 dark:text-sky-400",
  TRANSPORTER:
    "border-amber-600/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
}
