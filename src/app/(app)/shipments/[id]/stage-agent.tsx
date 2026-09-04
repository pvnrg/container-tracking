"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { DocumentStage } from "@prisma/client"
import { UserRound } from "lucide-react"

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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { DOCUMENT_STAGE_LABELS } from "@/lib/document-labels"

import { upsertStageAgent } from "./stage-agent-actions"

export type StageAgentInfo = {
  name: string
  contact: string
  position: string | null
}

export function StageAgentBlock({
  shipmentId,
  stage,
  agent,
  canManage,
}: {
  shipmentId: string
  stage: DocumentStage
  agent: StageAgentInfo | null
  canManage: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/30 px-3 py-2 text-sm">
      <div className="flex min-w-0 items-center gap-2">
        <UserRound className="size-4 shrink-0 text-muted-foreground" />
        {agent ? (
          <span className="truncate">
            <span className="font-medium">{agent.name}</span>
            {agent.position && (
              <span className="text-muted-foreground"> · {agent.position}</span>
            )}
            <span className="text-muted-foreground"> · {agent.contact}</span>
          </span>
        ) : (
          <span className="text-muted-foreground">
            No agent assigned for this stage yet
          </span>
        )}
      </div>
      {canManage && <AgentDialog shipmentId={shipmentId} stage={stage} agent={agent} />}
    </div>
  )
}

function AgentDialog({
  shipmentId,
  stage,
  agent,
}: {
  shipmentId: string
  stage: DocumentStage
  agent: StageAgentInfo | null
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState(agent?.name ?? "")
  const [contact, setContact] = useState(agent?.contact ?? "")
  const [position, setPosition] = useState(agent?.position ?? "")

  const reset = () => {
    setName(agent?.name ?? "")
    setContact(agent?.contact ?? "")
    setPosition(agent?.position ?? "")
    setError(null)
  }

  const handleSave = async () => {
    setError(null)
    if (!name.trim() || !contact.trim()) {
      setError("Agent name and contact are required")
      return
    }
    setIsSaving(true)
    try {
      await upsertStageAgent({
        shipmentId,
        stage,
        name: name.trim(),
        contact: contact.trim(),
        position: position.trim() || undefined,
      })
      toast.success("Agent details saved")
      setOpen(false)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save agent details")
    } finally {
      setIsSaving(false)
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
          <Button type="button" size="sm" variant="outline">
            <UserRound data-icon="inline-start" />
            {agent ? "Edit Agent" : "Add Agent"}
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {agent ? "Edit" : "Add"} Agent — {DOCUMENT_STAGE_LABELS[stage]}
          </DialogTitle>
          <DialogDescription>
            Record who&apos;s handling this stage so it&apos;s easy to follow up
            on missing or delayed paperwork.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>Agent Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Jane Doe"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Position</Label>
            <Input
              value={position}
              onChange={(e) => setPosition(e.target.value)}
              placeholder="Customs Broker (optional)"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Contact</Label>
            <Input
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              placeholder="Phone or email"
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
