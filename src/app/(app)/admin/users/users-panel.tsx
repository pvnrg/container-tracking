"use client"

import { useMemo, useState } from "react"
import { UserRole } from "@prisma/client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DataTable } from "@/components/data-table/data-table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ROLE_LABELS } from "@/lib/auth-utils"

import { createUserColumns, type UserRow } from "./columns"
import { AddUserDialog } from "./add-user-dialog"

const ALL_ROLES = "__all__"

export function UsersPanel({
  users,
  currentUserId,
}: {
  users: UserRow[]
  currentUserId: string
}) {
  const [roleFilter, setRoleFilter] = useState<string>(ALL_ROLES)

  const columns = useMemo(() => createUserColumns(currentUserId), [currentUserId])

  const filteredUsers = useMemo(
    () => (roleFilter === ALL_ROLES ? users : users.filter((u) => u.role === roleFilter)),
    [users, roleFilter]
  )

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>All Users</CardTitle>
        <AddUserDialog />
      </CardHeader>
      <CardContent>
        <DataTable
          columns={columns}
          data={filteredUsers}
          searchableColumns={["name", "email"]}
          searchPlaceholder="Search name or email..."
          emptyMessage="No users match your filters."
          filters={
            <Select
              value={roleFilter}
              onValueChange={(value) => setRoleFilter(value ?? ALL_ROLES)}
            >
              <SelectTrigger size="sm" className="w-40">
                <SelectValue placeholder="All roles">
                  {(value: string | null) =>
                    value && value !== ALL_ROLES
                      ? ROLE_LABELS[value as UserRole]
                      : "All roles"
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_ROLES}>All roles</SelectItem>
                {Object.values(UserRole).map((role) => (
                  <SelectItem key={role} value={role}>
                    {ROLE_LABELS[role]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          }
        />
      </CardContent>
    </Card>
  )
}
