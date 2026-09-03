"use client"

import { useRef, useState } from "react"
import { toast } from "sonner"
import { ChevronDown, FileText, Loader2, ScanLine, UploadCloud } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

import {
  extractShipmentFromDocument,
  type ExtractedShipmentData,
} from "./extract-actions"

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"]

export function OblUploadCard({
  onExtracted,
}: {
  onExtracted: (file: File, data: ExtractedShipmentData) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">(
    "idle"
  )
  const [fileName, setFileName] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [rawText, setRawText] = useState<string | null>(null)
  const [showRawText, setShowRawText] = useState(false)
  const [isDragging, setIsDragging] = useState(false)

  const handleFile = async (file: File) => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast.error("Upload a JPEG, PNG, WEBP, or PDF of the OBL.")
      return
    }

    setFileName(file.name)
    setStatus("loading")
    setMessage(null)
    setRawText(null)
    setShowRawText(false)

    try {
      const formData = new FormData()
      formData.set("file", file)
      const data = await extractShipmentFromDocument(formData)
      setStatus("done")
      setRawText(data.rawText)
      const count = data.filledFieldCount
      setMessage(
        count > 0
          ? `Auto-filled ${count} field${count === 1 ? "" : "s"} from ${file.name}. This is a local text scan, not AI comprehension -- please check every field before submitting.`
          : `Couldn't confidently match any fields from ${file.name}. Check the scanned text below, or fill in the form manually.`
      )
      onExtracted(file, data)
      if (count > 0) {
        toast.success("Form auto-filled from the scanned document")
      }
    } catch (err) {
      setStatus("error")
      const errorMessage =
        err instanceof Error ? err.message : "Failed to read that document."
      setMessage(errorMessage)
      toast.error(errorMessage)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ScanLine className="size-4 text-primary" />
          Auto-fill from Bill of Lading
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div
          className={cn(
            "flex flex-col items-center gap-2 rounded-lg border-2 border-dashed px-4 py-8 text-center transition-colors",
            isDragging ? "border-primary bg-primary/5" : "border-border",
            status === "loading" && "pointer-events-none opacity-70"
          )}
          onDragOver={(e) => {
            e.preventDefault()
            setIsDragging(true)
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault()
            setIsDragging(false)
            const file = e.dataTransfer.files?.[0]
            if (file) void handleFile(file)
          }}
        >
          {status === "loading" ? (
            <>
              <Loader2 className="size-6 animate-spin text-primary" />
              <p className="text-sm font-medium">Scanning {fileName}...</p>
              <p className="text-xs text-muted-foreground">
                Reading text from your document locally -- this can take a
                moment for photos or scanned PDFs.
              </p>
            </>
          ) : (
            <>
              <UploadCloud className="size-6 text-muted-foreground" />
              <p className="text-sm font-medium">
                Upload a photo or scan of the OBL
              </p>
              <p className="text-xs text-muted-foreground">
                Drag and drop, or browse a JPEG, PNG, WEBP, or PDF. We scan it
                locally (no external service) and auto-fill what we can match
                below for you to review.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-1"
                onClick={() => inputRef.current?.click()}
              >
                <FileText data-icon="inline-start" />
                Browse file
              </Button>
            </>
          )}
        </div>

        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_TYPES.join(",")}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) void handleFile(file)
            e.target.value = ""
          }}
        />

        {message && (
          <p
            className={cn(
              "text-sm",
              status === "error" ? "text-destructive" : "text-muted-foreground"
            )}
          >
            {message}
          </p>
        )}

        {rawText && (
          <div className="flex flex-col gap-2">
            <button
              type="button"
              className="flex w-fit items-center gap-1 text-sm text-primary underline-offset-4 hover:underline"
              onClick={() => setShowRawText((v) => !v)}
            >
              <ChevronDown
                className={cn(
                  "size-3.5 transition-transform",
                  showRawText && "rotate-180"
                )}
              />
              {showRawText ? "Hide" : "View"} scanned text
            </button>
            {showRawText && (
              <pre className="max-h-64 overflow-auto rounded-lg border bg-muted/40 p-3 text-xs whitespace-pre-wrap text-muted-foreground">
                {rawText}
              </pre>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
