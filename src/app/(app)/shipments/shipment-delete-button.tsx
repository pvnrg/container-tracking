"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"

import { deleteShipment } from "./actions"

export function ShipmentDeleteButton({
  shipmentId,
  blNumber,
  redirectTo,
}: {
  shipmentId: string
  blNumber: string
  redirectTo?: string
}) {
  const router = useRouter()
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDelete = async () => {
    if (
      !window.confirm(
        `Delete shipment ${blNumber}? This also deletes its containers and documents, and can't be undone.`
      )
    ) {
      return
    }

    setIsDeleting(true)
    try {
      await deleteShipment(shipmentId)
      toast.success(`${blNumber} deleted`)
      if (redirectTo) {
        router.push(redirectTo)
      } else {
        router.refresh()
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete shipment")
      setIsDeleting(false)
    }
  }

  return (
    <Button
      type="button"
      size="sm"
      variant="destructive"
      disabled={isDeleting}
      onClick={handleDelete}
    >
      <Trash2 data-icon="inline-start" />
      {isDeleting ? "Deleting..." : "Delete"}
    </Button>
  )
}
