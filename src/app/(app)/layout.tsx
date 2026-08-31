import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

import { AppNav } from "./app-nav"

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()
  if (!session?.user) {
    redirect("/login")
  }

  const unreadNotifications = await prisma.notification.count({
    where: { userId: session.user.id, isRead: false },
  })

  return (
    <div className="flex min-h-svh flex-col">
      <AppNav
        role={session.user.role}
        name={session.user.name ?? session.user.email ?? "User"}
        unreadNotifications={unreadNotifications}
      />
      <main className="flex-1 p-6">{children}</main>
    </div>
  )
}
