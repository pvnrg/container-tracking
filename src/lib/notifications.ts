import { NotificationChannel } from "@prisma/client"

import { prisma } from "@/lib/prisma"
import { normalizePhone, sendWhatsAppMessage } from "@/lib/whatsapp"

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

    await notifyExtraRecipients(message, user?.phone)
  }

  return notification
}

// Admin-managed numbers (not tied to a User account) that get a copy of
// every WhatsApp notification. Best-effort: failures here don't affect the
// primary notification's stored status.
async function notifyExtraRecipients(message: string, primaryPhone?: string) {
  const recipients = await prisma.whatsAppRecipient.findMany({
    where: { isActive: true },
    select: { phoneNumber: true },
  })

  const primaryNormalized = primaryPhone ? normalizePhone(primaryPhone) : null

  await Promise.all(
    recipients
      .filter((r) => normalizePhone(r.phoneNumber) !== primaryNormalized)
      .map((r) =>
        sendWhatsAppMessage(r.phoneNumber, message).catch((err) => {
          console.error(`[whatsapp:extra-recipient-failed] to=${r.phoneNumber}`, err)
        })
      )
  )
}
