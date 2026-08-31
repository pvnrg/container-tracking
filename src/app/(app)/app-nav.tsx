"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { signOut } from "next-auth/react"
import { UserRole } from "@prisma/client"
import { Ship } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { ROLE_LABELS } from "@/lib/auth-utils"

export function AppNav({
  role,
  name,
  unreadNotifications,
}: {
  role: UserRole
  name: string
  unreadNotifications: number
}) {
  const pathname = usePathname()

  const links = [
    { href: "/dashboard", label: "Dashboard", show: true },
    { href: "/shipments", label: "Shipments", show: true },
    {
      href: "/shipments/new",
      label: "New Shipment",
      show: role === "ADMIN" || role === "LOGISTICS_OPERATOR",
    },
    {
      href: "/shipments/tracking",
      label: "ETA Tracking",
      show: role === "ADMIN" || role === "LOGISTICS_OPERATOR",
    },
    {
      href: "/shipments/offload",
      label: "Offload Scheduling",
      show: role === "ADMIN" || role === "LOGISTICS_OPERATOR",
    },
    {
      href: "/shipments/detention",
      label: "Detention Tracking",
      show: role === "ADMIN" || role === "LOGISTICS_OPERATOR",
    },
    { href: "/admin/users", label: "Users", show: role === "ADMIN" },
    { href: "/notifications", label: "Notifications", show: true },
  ]

  return (
    <header className="flex items-center justify-between border-b bg-background px-6 py-3">
      <div className="flex items-center gap-6">
        <span className="flex items-center gap-2 text-sm font-semibold">
          <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Ship className="size-4" />
          </span>
          Container Tracking
        </span>
        <nav className="flex items-center gap-1 text-sm">
          {links
            .filter((l) => l.show)
            .map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
                  pathname === l.href && "bg-primary/10 font-medium text-primary"
                )}
              >
                {l.label}
                {l.href === "/notifications" && unreadNotifications > 0 && (
                  <Badge variant="default" className="h-4 min-w-4 px-1 text-[10px]">
                    {unreadNotifications}
                  </Badge>
                )}
              </Link>
            ))}
        </nav>
      </div>
      <div className="flex items-center gap-3 text-sm">
        <span className="text-muted-foreground">
          {name} &middot; {ROLE_LABELS[role]}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => signOut({ callbackUrl: "/login" })}
        >
          Sign out
        </Button>
      </div>
    </header>
  )
}
