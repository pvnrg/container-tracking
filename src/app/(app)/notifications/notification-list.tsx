"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

import { markAllNotificationsRead, markNotificationRead } from "./actions"

export type NotificationRow = {
  id: string
  title: string
  message: string
  isRead: boolean
  waStatus: string | null
  createdAt: Date
  shipment: { id: string; blNumber: string } | null
}

export function NotificationList({
  notifications,
}: {
  notifications: NotificationRow[]
}) {
  const router = useRouter()
  const [isMarkingAll, setIsMarkingAll] = useState(false)

  const unreadCount = notifications.filter((n) => !n.isRead).length

  const handleMarkAll = async () => {
    setIsMarkingAll(true)
    try {
      await markAllNotificationsRead()
      router.refresh()
    } catch {
      toast.error("Failed to mark all as read")
    } finally {
      setIsMarkingAll(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {unreadCount > 0 && (
        <div className="flex justify-end">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={isMarkingAll}
            onClick={handleMarkAll}
          >
            {isMarkingAll ? "Marking..." : "Mark all read"}
          </Button>
        </div>
      )}

      {notifications.length === 0 && (
        <p className="text-sm text-muted-foreground">No notifications yet.</p>
      )}

      {notifications.map((n) => (
        <NotificationItem key={n.id} notification={n} />
      ))}
    </div>
  )
}

function NotificationItem({ notification }: { notification: NotificationRow }) {
  const router = useRouter()
  const [isMarking, setIsMarking] = useState(false)

  const handleMarkRead = async () => {
    setIsMarking(true)
    try {
      await markNotificationRead(notification.id)
      router.refresh()
    } catch {
      toast.error("Failed to mark as read")
    } finally {
      setIsMarking(false)
    }
  }

  return (
    <Card className={cn(!notification.isRead && "border-primary/40 bg-primary/5")}>
      <CardContent className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="font-medium">{notification.title}</span>
            {!notification.isRead && <Badge variant="default">New</Badge>}
          </div>
          <p className="text-sm text-muted-foreground">{notification.message}</p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{notification.createdAt.toLocaleString()}</span>
            {notification.shipment && (
              <>
                <span>·</span>
                <Link
                  href={`/shipments/${notification.shipment.id}`}
                  className="hover:underline"
                >
                  {notification.shipment.blNumber}
                </Link>
              </>
            )}
            {notification.waStatus && (
              <>
                <span>·</span>
                <span>WhatsApp: {notification.waStatus}</span>
              </>
            )}
          </div>
        </div>
        {!notification.isRead && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={isMarking}
            onClick={handleMarkRead}
          >
            {isMarking ? "..." : "Mark read"}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
