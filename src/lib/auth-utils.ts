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
