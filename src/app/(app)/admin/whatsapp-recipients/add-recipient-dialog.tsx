"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
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

import { addRecipient } from "./actions"

export function AddRecipientDialog() {
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
