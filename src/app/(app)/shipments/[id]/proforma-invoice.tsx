"use client"

import { useState } from "react"
import { Download, Eye } from "lucide-react"

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
import { formatDate } from "@/lib/format"

import type { RateLineItemInfo } from "./rate-sheet"

export type ProformaInvoiceInfo = {
  invoiceNumber: string
  currency: string
  finalizedAt: Date
  lineItems: RateLineItemInfo[]
}

// PDF is generated client-side (jsPDF), lazy-loaded only when the user
// actually clicks Download -- keeps it off the main bundle and off the
// server entirely, which matters on the low-RAM production box.
async function downloadInvoicePdf({
  blNumber,
  shipperName,
  consigneeName,
  rateSheet,
  total,
}: {
  blNumber: string
  shipperName: string | null
  consigneeName: string | null
  rateSheet: ProformaInvoiceInfo
  total: number
}) {
  const { default: jsPDF } = await import("jspdf")
  const doc = new jsPDF()

  doc.setFontSize(18)
  doc.text("Proforma Invoice", 14, 20)

  doc.setFontSize(10)
  doc.text(`Invoice No: ${rateSheet.invoiceNumber}`, 14, 30)
  doc.text(`Date: ${formatDate(rateSheet.finalizedAt)}`, 14, 36)
  doc.text(`BL Number: ${blNumber}`, 14, 42)
  let y = 48
  if (shipperName) {
    doc.text(`Shipper: ${shipperName}`, 14, y)
    y += 6
  }
  if (consigneeName) {
    doc.text(`Consignee: ${consigneeName}`, 14, y)
    y += 6
  }

  y += 10
  doc.setFontSize(11)
  doc.text("Description", 14, y)
  doc.text("Amount", 196, y, { align: "right" })
  y += 4
  doc.line(14, y, 196, y)
  y += 6

  doc.setFontSize(10)
  for (const item of rateSheet.lineItems) {
    doc.text(item.description, 14, y)
    doc.text(`${rateSheet.currency} ${Number(item.amount).toFixed(2)}`, 196, y, {
      align: "right",
    })
    y += 7
  }

  y += 2
  doc.line(14, y, 196, y)
  y += 8
  doc.setFontSize(12)
  doc.text("Total", 14, y)
  doc.text(`${rateSheet.currency} ${total.toFixed(2)}`, 196, y, { align: "right" })

  doc.save(`${rateSheet.invoiceNumber}.pdf`)
}

export function ProformaInvoiceDialog({
  blNumber,
  shipperName,
  consigneeName,
  rateSheet,
}: {
  blNumber: string
  shipperName: string | null
  consigneeName: string | null
  rateSheet: ProformaInvoiceInfo
}) {
  const [isDownloading, setIsDownloading] = useState(false)
  const total = rateSheet.lineItems.reduce((sum, li) => sum + Number(li.amount), 0)

  const handleDownload = async () => {
    setIsDownloading(true)
    try {
      await downloadInvoicePdf({ blNumber, shipperName, consigneeName, rateSheet, total })
    } finally {
      setIsDownloading(false)
    }
  }

  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button type="button" size="sm" variant="outline">
            <Eye data-icon="inline-start" />
            View Invoice
          </Button>
        }
      />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Proforma Invoice</DialogTitle>
          <DialogDescription>
            {rateSheet.invoiceNumber} · {formatDate(rateSheet.finalizedAt)}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-muted-foreground">BL Number</p>
              <p className="font-medium">{blNumber}</p>
            </div>
            {shipperName && (
              <div>
                <p className="text-xs text-muted-foreground">Shipper</p>
                <p className="font-medium">{shipperName}</p>
              </div>
            )}
            {consigneeName && (
              <div>
                <p className="text-xs text-muted-foreground">Consignee</p>
                <p className="font-medium">{consigneeName}</p>
              </div>
            )}
          </div>

          <div className="overflow-hidden rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Description</th>
                  <th className="px-3 py-2 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {rateSheet.lineItems.map((item, i) => (
                  <tr key={i} className="border-t">
                    <td className="px-3 py-2">{item.description}</td>
                    <td className="px-3 py-2 text-right">
                      {rateSheet.currency} {Number(item.amount).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t bg-muted/30 font-medium">
                  <td className="px-3 py-2">Total</td>
                  <td className="px-3 py-2 text-right">
                    {rateSheet.currency} {total.toFixed(2)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" disabled={isDownloading} onClick={handleDownload}>
            <Download data-icon="inline-start" />
            {isDownloading ? "Preparing..." : "Download PDF"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
