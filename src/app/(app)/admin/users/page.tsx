import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

import { UsersPanel } from "./users-panel"

export default async function UsersPage() {
  const session = await auth()
  if (session?.user.role !== "ADMIN") {
    redirect("/dashboard")
  }

  const users = await prisma.user.findMany({ orderBy: { createdAt: "asc" } })

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Users</h1>
      <UsersPanel users={users} currentUserId={session.user.id} />
    </div>
  )
}
