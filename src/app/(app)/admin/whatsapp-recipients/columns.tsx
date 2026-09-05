"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import type { ColumnDef } from "@tanstack/react-table"
import { Power, Trash2 } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header"

import { removeRecipient, setRecipientActive } from "./actions"

export type RecipientRow = {
  id: string
  label: string
  phoneNumber: string
  isActive: boolean
}

export const recipientColumns: ColumnDef<RecipientRow>[] = [
  {
    accessorKey: "label",
    meta: { label: "Label" },
    header: ({ column }) => <DataTableColumnHeader column={column} title="Label" />,
    cell: ({ row }) => <span className="font-medium">{row.original.label}</span>,
  },
  {
    accessorKey: "phoneNumber",
    meta: { label: "Phone Number" },
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Phone Number" />
    ),
  },
  {
    accessorKey: "isActive",
    meta: { label: "Status" },
    header: "Status",
    enableSorting: false,
    cell: ({ row }) => (
      <Badge
        variant="outline"
        className={
          row.original.isActive
            ? "border-emerald-600/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
            : "border-border text-muted-foreground"
        }
      >
        {row.original.isActive ? "Active" : "Paused"}
      </Badge>
    ),
  },
  {
    id: "actions",
    header: () => <div className="text-right">Actions</div>,
    enableHiding: false,
    enableSorting: false,
    cell: ({ row }) => <RecipientRowActions recipient={row.original} />,
  },
]

function RecipientRowActions({ recipient }: { recipient: RecipientRow }) {
  const router = useRouter()
  const [isBusy, setIsBusy] = useState(false)

  const handleToggle = async () => {
    setIsBusy(true)
    try {
      await setRecipientActive(recipient.id, !recipient.isActive)
      toast.success(recipient.isActive ? "Number paused" : "Number resumed")
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update number")
    } finally {
      setIsBusy(false)
    }
  }

  const handleRemove = async () => {
    setIsBusy(true)
    try {
      await removeRecipient(recipient.id)
      toast.success("Number removed")
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove number")
    } finally {
      setIsBusy(false)
    }
  }

  return (
    <div className="flex justify-end gap-2">
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={isBusy}
        onClick={handleToggle}
      >
        <Power data-icon="inline-start" />
        {recipient.isActive ? "Pause" : "Resume"}
      </Button>
      <Button
        type="button"
        size="sm"
        variant="destructive"
        disabled={isBusy}
        onClick={handleRemove}
      >
        <Trash2 data-icon="inline-start" />
        Remove
      </Button>
    </div>
  )
}
