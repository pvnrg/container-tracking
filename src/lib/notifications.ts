import { NotificationChannel } from "@prisma/client"

import { prisma } from "@/lib/prisma"
import { sendWhatsAppMessage } from "@/lib/whatsapp"

export async function createNotification({
  userId,
  shipmentId,
  title,
  message,
  channel = "BOTH",
}: {
  userId: string
  shipmentId?: string
  title: string
  message: string
  channel?: NotificationChannel
}) {
  const notification = await prisma.notification.create({
    data: { userId, shipmentId, title, message, channel },
  })

  if (channel === "WHATSAPP" || channel === "BOTH") {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { phone: true },
    })

    if (user?.phone) {
      const result = await sendWhatsAppMessage(user.phone, message)
      await prisma.notification.update({
        where: { id: notification.id },
        data: {
          waStatus: result.status,
          waMessageSid: result.messageSid,
          waSentAt: result.status === "sent" ? new Date() : undefined,
        },
      })
    }
  }

  return notification
}
