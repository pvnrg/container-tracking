"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Plus, Power, Trash2 } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

import { addRecipient, removeRecipient, setRecipientActive } from "./actions"

export type RecipientRow = {
  id: string
  label: string
  phoneNumber: string
  isActive: boolean
}

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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Label</TableHead>
                <TableHead>Phone Number</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recipients.map((r) => (
                <RecipientRowItem key={r.id} recipient={r} />
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}

function RecipientRowItem({ recipient }: { recipient: RecipientRow }) {
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
    <TableRow>
      <TableCell className="font-medium">{recipient.label}</TableCell>
      <TableCell>{recipient.phoneNumber}</TableCell>
      <TableCell>
        <Badge
          variant="outline"
          className={
            recipient.isActive
              ? "border-emerald-600/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
              : "border-border text-muted-foreground"
          }
        >
          {recipient.isActive ? "Active" : "Paused"}
        </Badge>
      </TableCell>
      <TableCell className="flex justify-end gap-2">
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
      </TableCell>
    </TableRow>
  )
}

function AddRecipientDialog() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [label, setLabel] = useState("")
  const [phoneNumber, setPhoneNumber] = useState("")
  const [error, setError] = useState<string | null>(null)

  const reset = () => {
    setLabel("")
    setPhoneNumber("")
    setError(null)
  }

  const handleSubmit = async () => {
    setError(null)
    setIsSubmitting(true)
    try {
      const formData = new FormData()
      formData.set("label", label)
      formData.set("phoneNumber", phoneNumber)
      await addRecipient(formData)
      toast.success("Number added")
      setOpen(false)
      reset()
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add number")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) reset()
      }}
    >
      <DialogTrigger
        render={
          <Button>
            <Plus data-icon="inline-start" />
            Add Number
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add WhatsApp Number</DialogTitle>
          <DialogDescription>
            This number will receive a copy of every WhatsApp notification the
            system sends, in addition to the notified user&apos;s own number.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>Label</Label>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Ops Manager"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Phone Number</Label>
            <Input
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="+250700000001"
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button type="button" disabled={isSubmitting} onClick={handleSubmit}>
            <Plus data-icon="inline-start" />
            {isSubmitting ? "Adding..." : "Add Number"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
