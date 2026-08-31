"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { signOut } from "next-auth/react"
import { UserRole } from "@prisma/client"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { ROLE_LABELS } from "@/lib/auth-utils"

export function AppNav({
  role,
  name,
}: {
  role: UserRole
  name: string
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
  ]

  return (
    <header className="flex items-center justify-between border-b bg-background px-6 py-3">
      <div className="flex items-center gap-6">
        <span className="text-sm font-semibold">Container Tracking</span>
        <nav className="flex items-center gap-4 text-sm">
          {links
            .filter((l) => l.show)
            .map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={cn(
                  "text-muted-foreground transition-colors hover:text-foreground",
                  pathname === l.href && "font-medium text-foreground"
                )}
              >
                {l.label}
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
