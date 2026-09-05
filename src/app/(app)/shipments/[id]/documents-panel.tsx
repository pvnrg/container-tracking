"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { DocumentStage, DocumentType } from "@prisma/client"
import {
  CheckCircle2,
  ChevronDown,
  CircleCheck,
  CircleDashed,
  Download,
  Eye,
  File,
  FileImage,
  FileQuestion,
  FileText,
  Trash2,
  Upload,
} from "lucide-react"

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
import { EmptyState } from "@/components/empty-state"
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
import { isStageComplete } from "@/lib/document-stage-alerts"
import {
  DOCUMENT_STAGE_LABELS,
  DOCUMENT_STAGE_NOTES,
  DOCUMENT_STATUS_BADGE_CLASSES,
  DOCUMENT_TYPE_LABELS,
  getPortClearanceChoice,
  getVisibleDocumentTypes,
} from "@/lib/document-labels"
import { formatDateTime } from "@/lib/format"
import { cn } from "@/lib/utils"

import {
  ContainerTransitDetailsBlock,
  type ContainerForTransit,
  type ContainerTransitDetailsInfo,
} from "./container-transit-details"
import { deleteDocument, uploadDocument, verifyDocument } from "./documents-actions"
import { StageAgentBlock, type StageAgentInfo } from "./stage-agent"

export type DocumentRow = {
  id: string
  stage: DocumentStage
  type: DocumentType
  fileName: string
  fileSize: number
  mimeType: string
  isVerified: boolean
  verifiedAt: Date | null
  comment: string | null
  referenceNumber: string | null
  createdAt: Date
  uploadedBy: { name: string }
}

const CUSTOMS_DECLARATION_TYPES: DocumentType[] = [
  "CUSTOMS_WH7",
  "CUSTOMS_T1",
  "CUSTOMS_IM4",
]

type StageStatus = "complete" | "partial" | "pending"

const STAGE_PROGRESS_CLASSES: Record<StageStatus, string> = {
  complete:
    "border-emerald-600/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  partial: "border-amber-600/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  pending: "border-border bg-muted/30 text-muted-foreground",
}

const STAGE_PROGRESS_ICONS: Record<StageStatus, typeof CheckCircle2> = {
  complete: CheckCircle2,
  partial: CircleDashed,
  pending: CircleDashed,
}

const STAGE_PROGRESS_TEXT: Record<StageStatus, string> = {
  complete: "Complete",
  partial: "In progress",
  pending: "Not started",
}

// `allDocuments` must include every stage's documents, not just this one --
// FINAL_CLEARANCE's requirement depends on what PORT_CLEARANCE resolved to.
function finalClearanceNote(
  stage: DocumentStage,
  allDocuments: DocumentRow[]
): string | undefined {
  if (stage !== "FINAL_CLEARANCE") return undefined
  const choice = getPortClearanceChoice(allDocuments)
  if (choice === "IM4") {
    return "Based on the Stage 2 IM4 declaration, only the Warehouse Offload Delivery Note applies."
  }
  if (choice === "WH7_T1") {
    return "Based on the Stage 2 customs declaration, only the Destination Clearance Document applies."
  }
  return undefined
}

function getStageStatus(stage: DocumentStage, allDocuments: DocumentRow[]): StageStatus {
  if (isStageComplete(stage, allDocuments)) return "complete"
  return allDocuments.some((d) => d.stage === stage) ? "partial" : "pending"
}

export function DocumentsPanel({
  shipmentId,
  documents,
  stageAgents,
  containers,
  transitDetailsByContainerId,
  transportCompanyNames,
  canManage,
}: {
  shipmentId: string
  documents: DocumentRow[]
  stageAgents: Partial<Record<DocumentStage, StageAgentInfo>>
  containers: ContainerForTransit[]
  transitDetailsByContainerId: Record<string, ContainerTransitDetailsInfo>
  transportCompanyNames: string[]
  canManage: boolean
}) {
  const stages = Object.values(DocumentStage)

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">Documents</h2>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {stages.map((stage) => {
          const status = getStageStatus(stage, documents)
          const Icon = STAGE_PROGRESS_ICONS[status]
          return (
            <div
              key={stage}
              className={cn(
                "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm",
                STAGE_PROGRESS_CLASSES[status]
              )}
            >
              <Icon className="size-4 shrink-0" />
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-xs opacity-80">
                  {DOCUMENT_STAGE_LABELS[stage].replace(/^Stage \d: /, "")}
                </span>
                <span className="font-medium">{STAGE_PROGRESS_TEXT[status]}</span>
              </div>
            </div>
          )
        })}
      </div>

      {stages.map((stage) => (
        <StageCard
          key={stage}
          shipmentId={shipmentId}
          stage={stage}
          allDocuments={documents}
          agent={stageAgents[stage] ?? null}
          containers={containers}
          transitDetailsByContainerId={transitDetailsByContainerId}
          transportCompanyNames={transportCompanyNames}
          canManage={canManage}
        />
      ))}
    </div>
  )
}

function StageCard({
  shipmentId,
  stage,
  allDocuments,
  agent,
  containers,
  transitDetailsByContainerId,
  transportCompanyNames,
  canManage,
}: {
  shipmentId: string
  stage: DocumentStage
  allDocuments: DocumentRow[]
  agent: StageAgentInfo | null
  containers: ContainerForTransit[]
  transitDetailsByContainerId: Record<string, ContainerTransitDetailsInfo>
  transportCompanyNames: string[]
  canManage: boolean
}) {
  const documents = allDocuments.filter((d) => d.stage === stage)
  const types = getVisibleDocumentTypes(stage, allDocuments)
  const note = DOCUMENT_STAGE_NOTES[stage] ?? finalClearanceNote(stage, allDocuments)
  const status = getStageStatus(stage, allDocuments)
  const [open, setOpen] = useState(status !== "complete")

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex min-w-0 flex-1 items-start gap-2 text-left"
          aria-expanded={open}
        >
          <ChevronDown
            className={cn(
              "mt-1 size-4 shrink-0 text-muted-foreground transition-transform",
              open && "rotate-180"
            )}
          />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-base">{DOCUMENT_STAGE_LABELS[stage]}</CardTitle>
              <Badge variant="outline" className={STAGE_PROGRESS_CLASSES[status]}>
                {STAGE_PROGRESS_TEXT[status]}
              </Badge>
            </div>
            {note && <p className="mt-0.5 text-xs text-muted-foreground">{note}</p>}
          </div>
        </button>
        {canManage && (
          <UploadDocumentDialog
            shipmentId={shipmentId}
            stage={stage}
            availableTypes={types}
          />
        )}
      </CardHeader>
      {open && (
        <CardContent className="flex flex-col gap-4">
          {(stage === "PORT_CLEARANCE" || stage === "FINAL_CLEARANCE") && (
            <StageAgentBlock
              shipmentId={shipmentId}
              stage={stage}
              agent={agent}
              canManage={canManage}
            />
          )}
          {stage === "PORT_CLEARANCE" && (
            <ContainerTransitDetailsBlock
              containers={containers}
              detailsByContainerId={transitDetailsByContainerId}
              transportCompanyNames={transportCompanyNames}
              canManage={canManage}
            />
          )}
          <div className="flex flex-wrap gap-2">
            {types.map((type) => {
              const docsForType = documents.filter((d) => d.type === type)
              const verified = docsForType.some((d) => d.isVerified)
              const uploaded = docsForType.length > 0
              const docStatus = verified ? "verified" : uploaded ? "uploaded" : "missing"
              return (
                <Badge
                  key={type}
                  variant="outline"
                  className={DOCUMENT_STATUS_BADGE_CLASSES[docStatus]}
                >
                  {DOCUMENT_TYPE_LABELS[type]}
                  {verified ? " · Verified" : uploaded ? " · Uploaded" : " · Missing"}
                </Badge>
              )
            })}
          </div>

          {documents.length > 0 ? (
            <div className="flex flex-col gap-2">
              {documents.map((doc) => (
                <DocumentRowItem key={doc.id} doc={doc} canManage={canManage} />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={FileQuestion}
              title="No documents uploaded yet"
              description="Documents attached to this stage will appear here."
              className="py-6"
            />
          )}
        </CardContent>
      )}
    </Card>
  )
}

const FILE_ICONS = {
  image: FileImage,
  pdf: FileText,
  other: File,
} as const

function fileKindFor(mimeType: string): keyof typeof FILE_ICONS {
  if (mimeType.startsWith("image/")) return "image"
  if (mimeType === "application/pdf") return "pdf"
  return "other"
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
  const FileIcon = FILE_ICONS[fileKindFor(doc.mimeType)]

  const handleVerify = async () => {
    setIsBusy(true)
    try {
      const { autoAdvancedTo } = await verifyDocument(doc.id)
      toast.success(
        autoAdvancedTo
          ? `Document verified — shipment status advanced to ${autoAdvancedTo}`
          : "Document verified"
      )
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
    <div className="flex flex-col gap-2 rounded-lg border px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-2.5">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
          <FileIcon className="size-4" />
        </div>
        <div className="flex min-w-0 flex-col">
          <span className="font-medium">
            {DOCUMENT_TYPE_LABELS[doc.type]}
            {doc.referenceNumber && (
              <span className="font-normal text-muted-foreground">
                {" "}
                · No. {doc.referenceNumber}
              </span>
            )}
          </span>
          <span className="truncate text-xs text-muted-foreground">
            {doc.fileName} · {(doc.fileSize / 1024).toFixed(0)} KB · Uploaded by{" "}
            {doc.uploadedBy.name}
          </span>
          {doc.comment && (
            <span className="mt-0.5 truncate text-xs text-muted-foreground italic">
              &ldquo;{doc.comment}&rdquo;
            </span>
          )}
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
        <Badge
          variant="outline"
          className={
            DOCUMENT_STATUS_BADGE_CLASSES[doc.isVerified ? "verified" : "uploaded"]
          }
        >
          {doc.isVerified ? "Verified" : "Unverified"}
        </Badge>
        <DocumentViewDialog doc={doc} />
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
  )
}

function DocumentViewDialog({ doc }: { doc: DocumentRow }) {
  const fileUrl = `/api/documents/${doc.id}/download`
  const isImage = doc.mimeType.startsWith("image/")
  const isPdf = doc.mimeType === "application/pdf"

  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button type="button" size="sm" variant="outline">
            <Eye data-icon="inline-start" />
            View
          </Button>
        }
      />
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{doc.fileName}</DialogTitle>
          <DialogDescription>
            {DOCUMENT_TYPE_LABELS[doc.type]} · {DOCUMENT_STAGE_LABELS[doc.stage]}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <Badge
              variant="outline"
              className={
                DOCUMENT_STATUS_BADGE_CLASSES[doc.isVerified ? "verified" : "uploaded"]
              }
            >
              {doc.isVerified ? "Verified" : "Unverified"}
            </Badge>
            <span className="text-muted-foreground">
              Uploaded by {doc.uploadedBy.name} on {formatDateTime(doc.createdAt)}
            </span>
          </div>
          {doc.isVerified && doc.verifiedAt && (
            <p className="-mt-2 text-xs text-muted-foreground">
              Verified on {formatDateTime(doc.verifiedAt)}
            </p>
          )}

          {doc.comment && (
            <div className="rounded-md bg-muted/50 px-3 py-2 text-sm">
              <p className="text-xs font-medium text-muted-foreground">Comment</p>
              <p>{doc.comment}</p>
            </div>
          )}

          <div className="overflow-hidden rounded-lg border bg-muted/30">
            {isImage ? (
              // eslint-disable-next-line @next/next/no-img-element -- authenticated route, not a static asset Next can optimize
              <img
                src={fileUrl}
                alt={doc.fileName}
                className="max-h-[75vh] w-full object-contain"
              />
            ) : isPdf ? (
              <iframe
                src={fileUrl}
                title={doc.fileName}
                className="h-[75vh] w-full"
              />
            ) : (
              <div className="flex flex-col items-center gap-2 px-4 py-10 text-center text-sm text-muted-foreground">
                <FileQuestion className="size-8" />
                <p>Preview isn&apos;t available for this file type.</p>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            nativeButton={false}
            render={
              <a href={fileUrl} target="_blank" rel="noopener noreferrer">
                <Download data-icon="inline-start" />
                Download
              </a>
            }
          />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function UploadDocumentDialog({
  shipmentId,
  stage,
  availableTypes,
}: {
  shipmentId: string
  stage: DocumentStage
  availableTypes: DocumentType[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [type, setType] = useState<DocumentType | "">("")
  const [file, setFile] = useState<File | null>(null)
  const [comment, setComment] = useState("")
  const [referenceNumber, setReferenceNumber] = useState("")
  const [error, setError] = useState<string | null>(null)

  const reset = () => {
    setType("")
    setFile(null)
    setComment("")
    setReferenceNumber("")
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
      if (referenceNumber.trim()) {
        formData.set("referenceNumber", referenceNumber.trim())
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

          {type && CUSTOMS_DECLARATION_TYPES.includes(type) && (
            <div className="flex flex-col gap-1.5">
              <Label>Document Number</Label>
              <Input
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                placeholder="e.g. the declaration's WH7/T1/IM4 number"
              />
            </div>
          )}

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
