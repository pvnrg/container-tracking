"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { FileSpreadsheet, Lock, Plus, Trash2, Unlock } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

import { ProformaInvoiceDialog } from "./proforma-invoice"
import { reopenRateSheet, saveRateSheet } from "./rate-sheet-actions"

export type RateLineItemInfo = { description: string; amount: string }
export type RateSheetInfo = {
  invoiceNumber: string
  currency: string
  finalizedAt: Date | null
  lineItems: RateLineItemInfo[]
}

const CURRENCIES = ["USD", "EUR", "GBP", "RWF", "KES", "TZS"]

export function RateSheetBlock({
  shipmentId,
  blNumber,
  shipperName,
  consigneeName,
  rateSheet,
  canManage,
}: {
  shipmentId: string
  blNumber: string
  shipperName: string | null
  consigneeName: string | null
  rateSheet: RateSheetInfo | null
  canManage: boolean
}) {
  if (rateSheet?.finalizedAt) {
    return (
      <FinalizedRateSheet
        shipmentId={shipmentId}
        blNumber={blNumber}
        shipperName={shipperName}
        consigneeName={consigneeName}
        rateSheet={{ ...rateSheet, finalizedAt: rateSheet.finalizedAt }}
        canManage={canManage}
      />
    )
  }

  if (!canManage) {
    return (
      <div className="rounded-lg border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
        Transit rates haven&apos;t been finalized yet.
      </div>
    )
  }

  return <RateSheetEditor shipmentId={shipmentId} rateSheet={rateSheet} />
}

function FinalizedRateSheet({
  shipmentId,
  blNumber,
  shipperName,
  consigneeName,
  rateSheet,
  canManage,
}: {
  shipmentId: string
  blNumber: string
  shipperName: string | null
  consigneeName: string | null
  rateSheet: RateSheetInfo & { finalizedAt: Date }
  canManage: boolean
}) {
  const router = useRouter()
  const [isReopening, setIsReopening] = useState(false)
  const total = rateSheet.lineItems.reduce((sum, li) => sum + Number(li.amount), 0)

  const handleReopen = async () => {
    setIsReopening(true)
    try {
      await reopenRateSheet(shipmentId)
      toast.success("Rate sheet reopened for edits")
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to reopen rate sheet")
    } finally {
      setIsReopening(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/30 px-3 py-2.5 text-sm">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <Lock className="size-4 shrink-0 text-muted-foreground" />
        <span className="truncate">
          Invoice <span className="font-medium">{rateSheet.invoiceNumber}</span> ·{" "}
          {rateSheet.lineItems.length} item{rateSheet.lineItems.length === 1 ? "" : "s"} ·{" "}
          <span className="font-medium">
            {rateSheet.currency} {total.toFixed(2)}
          </span>
        </span>
        <Badge
          variant="outline"
          className="border-emerald-600/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
        >
          Finalized
        </Badge>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <ProformaInvoiceDialog
          blNumber={blNumber}
          shipperName={shipperName}
          consigneeName={consigneeName}
          rateSheet={rateSheet}
        />
        {canManage && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={isReopening}
            onClick={handleReopen}
          >
            <Unlock data-icon="inline-start" />
            {isReopening ? "Reopening..." : "Reopen"}
          </Button>
        )}
      </div>
    </div>
  )
}

function RateSheetEditor({
  shipmentId,
  rateSheet,
}: {
  shipmentId: string
  rateSheet: RateSheetInfo | null
}) {
  const router = useRouter()
  const [currency, setCurrency] = useState(rateSheet?.currency ?? "USD")
  const [items, setItems] = useState<RateLineItemInfo[]>(
    rateSheet?.lineItems.length ? rateSheet.lineItems : [{ description: "", amount: "" }]
  )
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const updateItem = (index: number, patch: Partial<RateLineItemInfo>) => {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)))
  }
  const addRow = () => setItems((prev) => [...prev, { description: "", amount: "" }])
  const removeRow = (index: number) =>
    setItems((prev) => prev.filter((_, i) => i !== index))

  const total = items.reduce((sum, it) => sum + (parseFloat(it.amount) || 0), 0)

  const submit = async (finalize: boolean) => {
    setError(null)
    const cleaned = items
      .map((it) => ({ description: it.description.trim(), amount: it.amount }))
      .filter((it) => it.description.length > 0)
    if (cleaned.length === 0) {
      setError("Add at least one rate line item")
      return
    }
    const amounts = cleaned.map((it) => Number(it.amount))
    if (amounts.some((a) => !Number.isFinite(a) || a < 0)) {
      setError("Each line item needs a valid, non-negative amount")
      return
    }

    setIsSaving(true)
    try {
      const { autoAdvancedTo } = await saveRateSheet({
        shipmentId,
        currency,
        lineItems: cleaned.map((it, i) => ({
          description: it.description,
          amount: amounts[i],
        })),
        finalize,
      })
      toast.success(
        finalize
          ? autoAdvancedTo
            ? `Rate sheet finalized — shipment status advanced to ${autoAdvancedTo}`
            : "Rate sheet finalized"
          : "Draft saved"
      )
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save rate sheet")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border px-3 py-3 text-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="size-4 text-muted-foreground" />
          <span className="font-medium">Transit Rates</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Label className="text-xs text-muted-foreground">Currency</Label>
          <Select
            value={currency}
            onValueChange={(v) => v && setCurrency(v)}
          >
            <SelectTrigger className="h-8 w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CURRENCIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {items.map((item, index) => (
          <div key={index} className="flex items-center gap-2">
            <Input
              placeholder="e.g. Road freight, Loading charges..."
              value={item.description}
              onChange={(e) => updateItem(index, { description: e.target.value })}
              className="flex-1"
            />
            <Input
              type="number"
              inputMode="decimal"
              placeholder="0.00"
              value={item.amount}
              onChange={(e) => updateItem(index, { amount: e.target.value })}
              className="w-28"
            />
            <Button
              type="button"
              size="icon"
              variant="ghost"
              disabled={items.length === 1}
              onClick={() => removeRow(index)}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        ))}
      </div>

      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={addRow}
        className="w-fit"
      >
        <Plus data-icon="inline-start" />
        Add Line Item
      </Button>

      <div className="flex items-center justify-between border-t pt-2">
        <span className="text-muted-foreground">Total</span>
        <span className="font-medium">
          {currency} {total.toFixed(2)}
        </span>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex flex-wrap justify-end gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={isSaving}
          onClick={() => submit(false)}
        >
          {isSaving ? "Saving..." : "Save Draft"}
        </Button>
        <Button type="button" size="sm" disabled={isSaving} onClick={() => submit(true)}>
          <Lock data-icon="inline-start" />
          {isSaving ? "Saving..." : "Save & Close Stage"}
        </Button>
      </div>
    </div>
  )
}
