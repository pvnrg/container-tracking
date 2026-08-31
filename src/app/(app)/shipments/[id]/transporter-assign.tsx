"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Save } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

import { assignTransporter } from "../actions"

export type TransporterOption = { id: string; name: string }

export function TransporterAssign({
  shipmentId,
  currentTransporterId,
  transporters,
}: {
  shipmentId: string
  currentTransporterId: string | null
  transporters: TransporterOption[]
}) {
  const router = useRouter()
  const [selected, setSelected] = useState(currentTransporterId ?? "")
  const [isSaving, setIsSaving] = useState(false)

  const isDirty = selected !== (currentTransporterId ?? "")

  const handleSave = async () => {
    if (!selected) return
    setIsSaving(true)
    try {
      await assignTransporter({ shipmentId, transporterId: selected })
      toast.success("Transporter assigned")
      router.refresh()
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to assign transporter"
      )
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Select
        value={selected}
        onValueChange={(value) => setSelected(value ?? "")}
      >
        <SelectTrigger className="w-56">
          <SelectValue placeholder="Select transporter">
            {(value: string | null) =>
              transporters.find((t) => t.id === value)?.name ??
              "Select transporter"
            }
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {transporters.map((t) => (
            <SelectItem key={t.id} value={t.id}>
              {t.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={!isDirty || isSaving}
        onClick={handleSave}
      >
        <Save data-icon="inline-start" />
        {isSaving ? "Saving..." : "Save"}
      </Button>
    </div>
  )
}
