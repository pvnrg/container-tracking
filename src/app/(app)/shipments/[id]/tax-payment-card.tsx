"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Receipt } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
import { formatDateTime } from "@/lib/format"

import { recordTaxPayment } from "./tax-actions"

export type TaxPaymentInfo = {
  isTaxPaid: boolean
  taxLocation: string | null
  taxReceivedBy: string | null
  taxAmount: string | null
  taxCurrency: string | null
  taxPaidAt: Date | null
}

function toDateTimeInputValue(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function TaxPaymentCard({
  shipmentId,
  info,
  canManage,
}: {
  shipmentId: string
  info: TaxPaymentInfo
  canManage: boolean
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Tax Payment</CardTitle>
        {canManage && <RecordPaymentDialog shipmentId={shipmentId} info={info} />}
      </CardHeader>
      <CardContent>
        {!info.isTaxPaid ? (
          <p className="text-sm text-muted-foreground">
            No tax payment recorded yet.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Location" value={info.taxLocation ?? "—"} />
            <Field label="Received By" value={info.taxReceivedBy ?? "—"} />
            <Field
              label="Amount"
              value={
                info.taxAmount
                  ? `${info.taxCurrency ?? ""} ${info.taxAmount}`.trim()
                  : "—"
              }
            />
            <Field
              label="Paid At"
              value={info.taxPaidAt ? formatDateTime(info.taxPaidAt) : "—"}
            />
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm">{value}</span>
    </div>
  )
}

function RecordPaymentDialog({
  shipmentId,
  info,
}: {
  shipmentId: string
  info: TaxPaymentInfo
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [location, setLocation] = useState(info.taxLocation ?? "")
  const [receivedBy, setReceivedBy] = useState(info.taxReceivedBy ?? "")
  const [amount, setAmount] = useState(info.taxAmount ?? "")
  const [currency, setCurrency] = useState(info.taxCurrency ?? "USD")
  const [paidAt, setPaidAt] = useState(
    toDateTimeInputValue(info.taxPaidAt ?? new Date())
  )

  const handleSave = async () => {
    setError(null)
    if (!location.trim() || !receivedBy.trim() || !amount || !currency.trim()) {
      setError("Fill in all fields")
      return
    }
    setIsSaving(true)
    try {
      await recordTaxPayment({
        shipmentId,
        location: location.trim(),
        receivedBy: receivedBy.trim(),
        amount: Number(amount),
        currency: currency.trim(),
        paidAt,
      })
      toast.success("Tax payment recorded")
      setOpen(false)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to record payment")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button type="button" size="sm" variant="outline">
            <Receipt data-icon="inline-start" />
            {info.isTaxPaid ? "Update Payment" : "Record Payment"}
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record Tax Payment</DialogTitle>
          <DialogDescription>
            Log where the import tax was paid, who received it, and how much.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>Location</Label>
            <Input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Mombasa Port Customs"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Received By</Label>
            <Input
              value={receivedBy}
              onChange={(e) => setReceivedBy(e.target.value)}
              placeholder="Officer name"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>Amount</Label>
              <Input
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Currency</Label>
              <Input value={currency} onChange={(e) => setCurrency(e.target.value)} />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Paid At</Label>
            <Input
              type="datetime-local"
              value={paidAt}
              onChange={(e) => setPaidAt(e.target.value)}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button type="button" disabled={isSaving} onClick={handleSave}>
            {isSaving ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
