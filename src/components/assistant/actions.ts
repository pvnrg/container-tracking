"use server"

import { auth } from "@/auth"
import { snoozeHoursForKey } from "@/lib/assistant-alerts"
import { prisma } from "@/lib/prisma"

/**
 * Hide one of the assistant's alerts for the current user. The duration
 * comes from the alert key (snoozeHoursForKey), not from the client, so a
 * critical alert can't be pushed away for longer than intended.
 */
export async function snoozeAssistantAlert(alertKey: string) {
  const session = await auth()
  if (!session?.user) {
    throw new Error("Not authenticated")
  }
  if (typeof alertKey !== "string" || alertKey.length === 0 || alertKey.length > 200) {
    throw new Error("Invalid alert")
  }

  const until = new Date(Date.now() + snoozeHoursForKey(alertKey) * 60 * 60 * 1000)
  const userId = session.user.id

  await prisma.$transaction([
    // Housekeeping: expired snoozes do nothing, so drop them as we go.
    prisma.assistantSnooze.deleteMany({ where: { userId, until: { lte: new Date() } } }),
    prisma.assistantSnooze.upsert({
      where: { userId_alertKey: { userId, alertKey } },
      create: { userId, alertKey, until },
      update: { until },
    }),
  ])
}
