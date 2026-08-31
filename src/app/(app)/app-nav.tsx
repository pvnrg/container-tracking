"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { signOut } from "next-auth/react"
import { UserRole } from "@prisma/client"
import {
  Anchor,
  CalendarClock,
  ChevronDown,
  PackagePlus,
  Ship,
  Timer,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
  const canManage = role === "ADMIN" || role === "LOGISTICS_OPERATOR"

  const links = [
    { href: "/dashboard", label: "Dashboard", show: true },
    { href: "/shipments", label: "Shipments", show: true },
    { href: "/admin/users", label: "Users", show: role === "ADMIN" },
    { href: "/notifications", label: "Notifications", show: true },
  ]

  const operationsLinks = [
    { href: "/shipments/new", label: "New Shipment", icon: PackagePlus },
    { href: "/shipments/tracking", label: "ETA Tracking", icon: CalendarClock },
    { href: "/shipments/offload", label: "Offload Scheduling", icon: Anchor },
    { href: "/shipments/detention", label: "Detention Tracking", icon: Timer },
  ]
  const isOperationsActive = operationsLinks.some((l) => l.href === pathname)

  const linkClassName = (active: boolean) =>
    cn(
      "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
      active && "bg-primary/10 font-medium text-primary"
    )

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
          <Link href="/dashboard" className={linkClassName(pathname === "/dashboard")}>
            Dashboard
          </Link>
          <Link href="/shipments" className={linkClassName(pathname === "/shipments")}>
            Shipments
          </Link>

          {canManage && (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <button
                    type="button"
                    className={cn(linkClassName(isOperationsActive), "cursor-pointer")}
                  />
                }
              >
                Operations
                <ChevronDown className="size-3.5" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="min-w-52">
                {operationsLinks.map((l) => (
                  <DropdownMenuItem
                    key={l.href}
                    render={<Link href={l.href} />}
                    className={cn(pathname === l.href && "bg-accent text-accent-foreground")}
                  >
                    <l.icon className="size-4" />
                    {l.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {links
            .filter((l) => l.show && l.href !== "/dashboard" && l.href !== "/shipments")
            .map((l) => (
              <Link key={l.href} href={l.href} className={linkClassName(pathname === l.href)}>
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
