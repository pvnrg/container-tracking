"use client"

import { useSyncExternalStore } from "react"
import { useTheme } from "next-themes"
import { Moon, Sparkles, Sun } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

const THEMES = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "glass", label: "Glass", icon: Sparkles },
] as const

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  // Avoids a hydration mismatch -- the server always renders the default
  // theme's icon, since it can't know the visitor's stored preference until
  // next-themes reads it client-side after mount. No-op subscribe since
  // "mounted" never changes again once true; only the snapshots differ.
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  )

  const current = THEMES.find((t) => t.value === theme) ?? THEMES[0]
  const CurrentIcon = current.icon

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="outline" size="icon" aria-label="Change theme">
            {mounted ? <CurrentIcon className="size-4" /> : <Sun className="size-4" />}
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="min-w-40">
        {THEMES.map((t) => (
          <DropdownMenuItem
            key={t.value}
            onClick={() => setTheme(t.value)}
            className={cn(mounted && theme === t.value && "bg-accent text-accent-foreground")}
          >
            <t.icon className="size-4" />
            {t.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
