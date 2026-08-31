"use server"

import { revalidatePath } from "next/cache"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export async function markNotificationRead(notificationId: string) {
  const session = await auth()
  if (!session?.user) {
    throw new Error("Not authenticated")
  }

  await prisma.notification.updateMany({
    where: { id: notificationId, userId: session.user.id },
    data: { isRead: true },
  })

  revalidatePath("/notifications")
}

export async function markAllNotificationsRead() {
  const session = await auth()
  if (!session?.user) {
    throw new Error("Not authenticated")
  }

  await prisma.notification.updateMany({
    where: { userId: session.user.id, isRead: false },
    data: { isRead: true },
  })

  revalidatePath("/notifications")
}
