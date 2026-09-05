"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import type { ColumnDef } from "@tanstack/react-table"
import { UserRole } from "@prisma/client"
import { Key, Pencil, Power, Trash2 } from "lucide-react"

import { Badge } from "@/components/ui/badge"
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
import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ROLE_BADGE_CLASSES, ROLE_LABELS } from "@/lib/auth-utils"

import { deleteUser, resetUserPassword, setUserActive, updateUser } from "./actions"

export type UserRow = {
  id: string
  name: string
  email: string
  phone: string
  role: UserRole
  isActive: boolean
}

export function createUserColumns(currentUserId: string): ColumnDef<UserRow>[] {
  return [
    {
      accessorKey: "name",
      meta: { label: "Name" },
      header: ({ column }) => <DataTableColumnHeader column={column} title="Name" />,
      cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
    },
    {
      accessorKey: "email",
      meta: { label: "Email" },
      header: ({ column }) => <DataTableColumnHeader column={column} title="Email" />,
    },
    {
      accessorKey: "phone",
      meta: { label: "Phone" },
      header: "Phone",
      enableSorting: false,
    },
    {
      accessorKey: "role",
      meta: { label: "Role" },
      header: "Role",
      filterFn: "equalsString",
      cell: ({ row }) => (
        <Badge variant="outline" className={ROLE_BADGE_CLASSES[row.original.role]}>
          {ROLE_LABELS[row.original.role]}
        </Badge>
      ),
      enableSorting: false,
    },
    {
      accessorKey: "isActive",
      meta: { label: "Status" },
      header: "Status",
      enableSorting: false,
      cell: ({ row }) => (
        <Badge
          variant={row.original.isActive ? "outline" : "destructive"}
          className={
            row.original.isActive
              ? "border-emerald-600/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
              : undefined
          }
        >
          {row.original.isActive ? "Active" : "Inactive"}
        </Badge>
      ),
    },
    {
      id: "actions",
      header: () => <div className="text-right">Actions</div>,
      enableHiding: false,
      enableSorting: false,
      cell: ({ row }) => (
        <UserRowActions user={row.original} isSelf={row.original.id === currentUserId} />
      ),
    },
  ]
}

function UserRowActions({ user, isSelf }: { user: UserRow; isSelf: boolean }) {
  const router = useRouter()
  const [isBusy, setIsBusy] = useState(false)

  const handleToggleActive = async () => {
    setIsBusy(true)
    try {
      await setUserActive(user.id, !user.isActive)
      toast.success(user.isActive ? "User deactivated" : "User activated")
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update user")
    } finally {
      setIsBusy(false)
    }
  }

  const handleDelete = async () => {
    if (!window.confirm(`Delete ${user.name}? This can't be undone.`)) return
    setIsBusy(true)
    try {
      await deleteUser(user.id)
      toast.success("User deleted")
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete user")
    } finally {
      setIsBusy(false)
    }
  }

  return (
    <div className="flex justify-end gap-2">
      <EditUserDialog user={user} />
      <ResetPasswordDialog userId={user.id} userName={user.name} />
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={isBusy || isSelf}
        title={isSelf ? "You can't deactivate your own account" : undefined}
        onClick={handleToggleActive}
      >
        <Power data-icon="inline-start" />
        {user.isActive ? "Deactivate" : "Activate"}
      </Button>
      <Button
        type="button"
        size="sm"
        variant="destructive"
        disabled={isBusy || isSelf}
        title={isSelf ? "You can't delete your own account" : undefined}
        onClick={handleDelete}
      >
        <Trash2 data-icon="inline-start" />
        Delete
      </Button>
    </div>
  )
}

function EditUserDialog({ user }: { user: UserRow }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [name, setName] = useState(user.name)
  const [email, setEmail] = useState(user.email)
  const [phone, setPhone] = useState(user.phone)
  const [role, setRole] = useState<UserRole>(user.role)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    setError(null)
    if (!name.trim() || !email.trim() || !phone.trim()) {
      setError("Fill in all fields")
      return
    }
    setIsSubmitting(true)
    try {
      await updateUser({
        userId: user.id,
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        role,
      })
      toast.success("User updated")
      setOpen(false)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update user")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) {
          setName(user.name)
          setEmail(user.email)
          setPhone(user.phone)
          setRole(user.role)
          setError(null)
        }
      }}
    >
      <DialogTrigger
        render={
          <Button type="button" size="sm" variant="outline">
            <Pencil data-icon="inline-start" />
            Edit
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit {user.name}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Phone</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Role</Label>
            <Select value={role} onValueChange={(v) => setRole(v as UserRole)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select role">
                  {(value: UserRole | null) => (value ? ROLE_LABELS[value] : "Select role")}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {Object.values(UserRole).map((r) => (
                  <SelectItem key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button type="button" disabled={isSubmitting} onClick={handleSubmit}>
            {isSubmitting ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ResetPasswordDialog({ userId, userName }: { userId: string; userName: string }) {
  const [open, setOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    setError(null)
    if (password.length < 8) {
      setError("Password must be at least 8 characters")
      return
    }
    setIsSubmitting(true)
    try {
      await resetUserPassword({ userId, password })
      toast.success("Password reset")
      setOpen(false)
      setPassword("")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reset password")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) {
          setPassword("")
          setError(null)
        }
      }}
    >
      <DialogTrigger
        render={
          <Button type="button" size="sm" variant="outline">
            <Key data-icon="inline-start" />
            Reset Password
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reset Password for {userName}</DialogTitle>
          <DialogDescription>
            Sets a new password immediately. Share it with them directly.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>New Password</Label>
            <Input
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button type="button" disabled={isSubmitting} onClick={handleSubmit}>
            <Key data-icon="inline-start" />
            {isSubmitting ? "Saving..." : "Reset Password"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
