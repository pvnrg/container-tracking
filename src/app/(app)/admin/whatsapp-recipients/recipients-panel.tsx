"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DataTable } from "@/components/data-table/data-table"

import { recipientColumns, type RecipientRow } from "./columns"
import { AddRecipientDialog } from "./add-recipient-dialog"

export function RecipientsPanel({
  recipients,
}: {
  recipients: RecipientRow[]
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>WhatsApp Numbers</CardTitle>
        <AddRecipientDialog />
      </CardHeader>
      <CardContent>
        {recipients.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No extra numbers added yet. Add one to start CC&apos;ing WhatsApp
            alerts to it.
          </p>
        ) : (
          <DataTable
            columns={recipientColumns}
            data={recipients}
            searchableColumns={["label", "phoneNumber"]}
            searchPlaceholder="Search label or phone number..."
            emptyMessage="No numbers match your search."
          />
        )}
      </CardContent>
    </Card>
  )
}
