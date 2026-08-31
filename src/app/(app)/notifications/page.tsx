import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

import { NotificationList } from "./notification-list"

export default async function NotificationsPage() {
  const session = await auth()
  if (!session?.user) {
    redirect("/login")
  }

  const notifications = await prisma.notification.findMany({
    where: { userId: session.user.id },
    include: { shipment: { select: { id: true, blNumber: true } } },
    orderBy: { createdAt: "desc" },
  })

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Notifications</h1>
          <p className="text-sm text-muted-foreground">
            Alerts about your shipments and containers.
          </p>
        </div>
      </div>
      <NotificationList notifications={notifications} />
    </div>
  )
}
