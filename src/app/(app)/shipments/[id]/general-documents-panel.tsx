"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { FileText, Plus, Trash2, Upload } from "lucide-react"

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

import { deleteDocument, uploadGeneralDocuments } from "./documents-actions"

export type GeneralDocumentRow = {
  id: string
  title: string | null
  fileName: string
  fileSize: number
  uploadedBy: { name: string }
}

export function GeneralDocumentsPanel({
  shipmentId,
  documents,
  canManage,
}: {
  shipmentId: string
  documents: GeneralDocumentRow[]
  canManage: boolean
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>General Documents</CardTitle>
        {canManage && <UploadGeneralDocumentsDialog shipmentId={shipmentId} />}
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {documents.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No general documents uploaded yet.
          </p>
        )}
        {documents.map((doc) => (
          <DocumentRowItem key={doc.id} doc={doc} canManage={canManage} />
        ))}
      </CardContent>
    </Card>
  )
}

function DocumentRowItem({
  doc,
  canManage,
}: {
  doc: GeneralDocumentRow
  canManage: boolean
}) {
  const router = useRouter()
  const [isBusy, setIsBusy] = useState(false)

  const handleDelete = async () => {
    setIsBusy(true)
    try {
      await deleteDocument(doc.id)
      toast.success("Document deleted")
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete document")
    } finally {
      setIsBusy(false)
    }
  }

  return (
    <div className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
      <div className="flex items-center gap-2">
        <FileText className="size-4 text-muted-foreground" />
        <div className="flex flex-col">
          <span className="font-medium">{doc.title || doc.fileName}</span>
          <span className="text-xs text-muted-foreground">
            {doc.fileName} · {(doc.fileSize / 1024).toFixed(0)} KB · Uploaded
            by {doc.uploadedBy.name}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <a
          href={`/api/documents/${doc.id}/download`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-sm text-primary underline-offset-4 hover:underline"
        >
          <Upload className="size-3.5 rotate-180" />
          Download
        </a>
        {canManage && (
          <Button
            type="button"
            size="sm"
            variant="destructive"
            disabled={isBusy}
            onClick={handleDelete}
          >
            <Trash2 data-icon="inline-start" />
            Delete
          </Button>
        )}
      </div>
    </div>
  )
}

type DocRow = { title: string; file: File | null }

function UploadGeneralDocumentsDialog({ shipmentId }: { shipmentId: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [rows, setRows] = useState<DocRow[]>([{ title: "", file: null }])
  const [error, setError] = useState<string | null>(null)

  const reset = () => {
    setRows([{ title: "", file: null }])
    setError(null)
  }

  const handleSubmit = async () => {
    setError(null)
    const rowsWithFiles = rows.filter((r) => r.file)
    if (rowsWithFiles.length === 0) {
      setError("Select at least one file")
      return
    }
    setIsSubmitting(true)
    try {
      const formData = new FormData()
      formData.set("shipmentId", shipmentId)
      rowsWithFiles.forEach((r) => {
        formData.append("files", r.file as File)
        formData.append("titles", r.title)
      })
      await uploadGeneralDocuments(formData)
      toast.success("Documents uploaded")
      setOpen(false)
      reset()
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload documents")
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
          <Button type="button" size="sm">
            <Upload data-icon="inline-start" />
            Upload Documents
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload General Documents</DialogTitle>
          <DialogDescription>
            Attach one or more supporting documents with a title each.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          {rows.map((row, index) => (
            <div key={index} className="flex items-center gap-2">
              <Input
                placeholder="Document title"
                value={row.title}
                onChange={(e) => {
                  const next = [...rows]
                  next[index] = { ...next[index], title: e.target.value }
                  setRows(next)
                }}
              />
              <Input
                type="file"
                className="w-44"
                onChange={(e) => {
                  const next = [...rows]
                  next[index] = { ...next[index], file: e.target.files?.[0] ?? null }
                  setRows(next)
                }}
              />
              {rows.length > 1 && (
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  onClick={() => setRows(rows.filter((_, i) => i !== index))}
                >
                  <Trash2 />
                </Button>
              )}
            </div>
          ))}
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="w-fit"
            onClick={() => setRows([...rows, { title: "", file: null }])}
          >
            <Plus data-icon="inline-start" />
            Add another file
          </Button>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button type="button" disabled={isSubmitting} onClick={handleSubmit}>
            <Upload data-icon="inline-start" />
            {isSubmitting ? "Uploading..." : "Upload"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
