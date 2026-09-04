"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { DocumentStage, DocumentType } from "@prisma/client"
import { CircleCheck, Download, Trash2, Upload } from "lucide-react"

import { Badge } from "@/components/ui/badge"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
  DOCUMENT_STAGE_LABELS,
  DOCUMENT_STAGE_NOTES,
  DOCUMENT_STATUS_BADGE_CLASSES,
  DOCUMENT_TYPE_LABELS,
  STAGE_DOCUMENT_TYPES,
} from "@/lib/document-labels"

import { deleteDocument, uploadDocument, verifyDocument } from "./documents-actions"

export type DocumentRow = {
  id: string
  stage: DocumentStage
  type: DocumentType
  fileName: string
  fileSize: number
  isVerified: boolean
  comment: string | null
  uploadedBy: { name: string }
}

export function DocumentsPanel({
  shipmentId,
  documents,
  canManage,
}: {
  shipmentId: string
  documents: DocumentRow[]
  canManage: boolean
}) {
  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">Documents</h2>
      {Object.values(DocumentStage).map((stage) => (
        <StageCard
          key={stage}
          shipmentId={shipmentId}
          stage={stage}
          documents={documents.filter((d) => d.stage === stage)}
          canManage={canManage}
        />
      ))}
    </div>
  )
}

function StageCard({
  shipmentId,
  stage,
  documents,
  canManage,
}: {
  shipmentId: string
  stage: DocumentStage
  documents: DocumentRow[]
  canManage: boolean
}) {
  const types = STAGE_DOCUMENT_TYPES[stage]
  const note = DOCUMENT_STAGE_NOTES[stage]

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className="text-base">{DOCUMENT_STAGE_LABELS[stage]}</CardTitle>
          {note && <p className="text-xs text-muted-foreground">{note}</p>}
        </div>
        {canManage && (
          <UploadDocumentDialog shipmentId={shipmentId} stage={stage} />
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-2">
          {types.map((type) => {
            const docsForType = documents.filter((d) => d.type === type)
            const verified = docsForType.some((d) => d.isVerified)
            const uploaded = docsForType.length > 0
            const status = verified ? "verified" : uploaded ? "uploaded" : "missing"
            return (
              <Badge
                key={type}
                variant="outline"
                className={DOCUMENT_STATUS_BADGE_CLASSES[status]}
              >
                {DOCUMENT_TYPE_LABELS[type]}
                {verified ? " · Verified" : uploaded ? " · Uploaded" : " · Missing"}
              </Badge>
            )
          })}
        </div>

        {documents.length > 0 && (
          <div className="flex flex-col gap-2">
            {documents.map((doc) => (
              <DocumentRowItem key={doc.id} doc={doc} canManage={canManage} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function DocumentRowItem({
  doc,
  canManage,
}: {
  doc: DocumentRow
  canManage: boolean
}) {
  const router = useRouter()
  const [isBusy, setIsBusy] = useState(false)

  const handleVerify = async () => {
    setIsBusy(true)
    try {
      await verifyDocument(doc.id)
      toast.success("Document verified")
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to verify document")
    } finally {
      setIsBusy(false)
    }
  }

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
    <div className="flex flex-col gap-2 rounded-lg border px-3 py-2 text-sm">
      <div className="flex items-center justify-between">
        <div className="flex flex-col">
          <span className="font-medium">{doc.fileName}</span>
          <span className="text-xs text-muted-foreground">
            {DOCUMENT_TYPE_LABELS[doc.type]} · {(doc.fileSize / 1024).toFixed(0)} KB ·
            Uploaded by {doc.uploadedBy.name}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className={
              DOCUMENT_STATUS_BADGE_CLASSES[doc.isVerified ? "verified" : "uploaded"]
            }
          >
            {doc.isVerified ? "Verified" : "Unverified"}
          </Badge>
          <a
            href={`/api/documents/${doc.id}/download`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-sm text-primary underline-offset-4 hover:underline"
          >
            <Download className="size-3.5" />
            Download
          </a>
          {canManage && !doc.isVerified && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={isBusy}
              onClick={handleVerify}
            >
              <CircleCheck data-icon="inline-start" />
              Verify
            </Button>
          )}
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
      {doc.comment && (
        <p className="rounded-md bg-muted/50 px-2 py-1.5 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Comment: </span>
          {doc.comment}
        </p>
      )}
    </div>
  )
}

function UploadDocumentDialog({
  shipmentId,
  stage,
}: {
  shipmentId: string
  stage: DocumentStage
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [type, setType] = useState<DocumentType | "">("")
  const [file, setFile] = useState<File | null>(null)
  const [comment, setComment] = useState("")
  const [error, setError] = useState<string | null>(null)

  const availableTypes = STAGE_DOCUMENT_TYPES[stage]

  const reset = () => {
    setType("")
    setFile(null)
    setComment("")
    setError(null)
  }

  const handleSubmit = async () => {
    setError(null)
    if (!type || !file) {
      setError("Select a document type and file")
      return
    }
    setIsSubmitting(true)
    try {
      const formData = new FormData()
      formData.set("shipmentId", shipmentId)
      formData.set("stage", stage)
      formData.set("type", type)
      formData.set("file", file)
      if (comment.trim()) {
        formData.set("comment", comment.trim())
      }
      await uploadDocument(formData)
      toast.success("Document uploaded")
      setOpen(false)
      reset()
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload document")
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
            Upload Document
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload Document — {DOCUMENT_STAGE_LABELS[stage]}</DialogTitle>
          <DialogDescription>
            Attach a document to {DOCUMENT_STAGE_LABELS[stage]} for this shipment.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>Document Type</Label>
            <Select
              value={type}
              onValueChange={(v) => setType(v as DocumentType)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select document type">
                  {(value: DocumentType | null) =>
                    value ? DOCUMENT_TYPE_LABELS[value] : "Select document type"
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {availableTypes.map((t) => (
                  <SelectItem key={t} value={t}>
                    {DOCUMENT_TYPE_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>File</Label>
            <Input
              type="file"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Comment (optional)</Label>
            <Textarea
              placeholder="Add any context for this document..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
          </div>

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
