"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { DocumentStage, DocumentType } from "@prisma/client"

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
import {
  DOCUMENT_STAGE_LABELS,
  DOCUMENT_STAGE_NOTES,
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
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Documents</h2>
        {canManage && <UploadDocumentDialog shipmentId={shipmentId} />}
      </div>
      {Object.values(DocumentStage).map((stage) => (
        <StageCard
          key={stage}
          stage={stage}
          documents={documents.filter((d) => d.stage === stage)}
          canManage={canManage}
        />
      ))}
    </div>
  )
}

function StageCard({
  stage,
  documents,
  canManage,
}: {
  stage: DocumentStage
  documents: DocumentRow[]
  canManage: boolean
}) {
  const types = STAGE_DOCUMENT_TYPES[stage]
  const note = DOCUMENT_STAGE_NOTES[stage]

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{DOCUMENT_STAGE_LABELS[stage]}</CardTitle>
        {note && <p className="text-xs text-muted-foreground">{note}</p>}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-2">
          {types.map((type) => {
            const docsForType = documents.filter((d) => d.type === type)
            const verified = docsForType.some((d) => d.isVerified)
            const uploaded = docsForType.length > 0
            return (
              <Badge
                key={type}
                variant={verified ? "default" : uploaded ? "secondary" : "outline"}
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
    <div className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
      <div className="flex flex-col">
        <span className="font-medium">{doc.fileName}</span>
        <span className="text-xs text-muted-foreground">
          {DOCUMENT_TYPE_LABELS[doc.type]} · {(doc.fileSize / 1024).toFixed(0)} KB ·
          Uploaded by {doc.uploadedBy.name}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Badge variant={doc.isVerified ? "default" : "outline"}>
          {doc.isVerified ? "Verified" : "Unverified"}
        </Badge>
        <a
          href={`/api/documents/${doc.id}/download`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-primary underline-offset-4 hover:underline"
        >
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
            Verify
          </Button>
        )}
        {canManage && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={isBusy}
            onClick={handleDelete}
          >
            Delete
          </Button>
        )}
      </div>
    </div>
  )
}

function UploadDocumentDialog({ shipmentId }: { shipmentId: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [stage, setStage] = useState<DocumentStage | "">("")
  const [type, setType] = useState<DocumentType | "">("")
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)

  const availableTypes = stage ? STAGE_DOCUMENT_TYPES[stage] : []

  const reset = () => {
    setStage("")
    setType("")
    setFile(null)
    setError(null)
  }

  const handleSubmit = async () => {
    setError(null)
    if (!stage || !type || !file) {
      setError("Select a stage, document type, and file")
      return
    }
    setIsSubmitting(true)
    try {
      const formData = new FormData()
      formData.set("shipmentId", shipmentId)
      formData.set("stage", stage)
      formData.set("type", type)
      formData.set("file", file)
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
      <DialogTrigger render={<Button>Upload Document</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload Document</DialogTitle>
          <DialogDescription>
            Attach a document to a stage for this shipment.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>Stage</Label>
            <Select
              value={stage}
              onValueChange={(v) => {
                setStage(v as DocumentStage)
                setType("")
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select stage">
                  {(value: DocumentStage | null) =>
                    value ? DOCUMENT_STAGE_LABELS[value] : "Select stage"
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {Object.values(DocumentStage).map((s) => (
                  <SelectItem key={s} value={s}>
                    {DOCUMENT_STAGE_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Document Type</Label>
            <Select
              value={type}
              onValueChange={(v) => setType(v as DocumentType)}
            >
              <SelectTrigger className="w-full" disabled={!stage}>
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

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button type="button" disabled={isSubmitting} onClick={handleSubmit}>
            {isSubmitting ? "Uploading..." : "Upload"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
