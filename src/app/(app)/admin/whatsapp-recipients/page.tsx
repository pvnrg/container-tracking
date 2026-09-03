import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

import { RecipientsPanel } from "./recipients-panel"

export default async function WhatsAppRecipientsPage() {
  const session = await auth()
  if (session?.user.role !== "ADMIN") {
    redirect("/dashboard")
  }

  const recipients = await prisma.whatsAppRecipient.findMany({
    orderBy: { createdAt: "asc" },
  })

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">WhatsApp Numbers</h1>
        <p className="text-sm text-muted-foreground">
          Extra numbers that receive a copy of every WhatsApp notification,
          separate from individual user accounts.
        </p>
      </div>
      <RecipientsPanel recipients={recipients} />
    </div>
  )
}
