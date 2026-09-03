import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

export function EmptyState({
  icon: Icon,
  illustration,
  title,
  description,
  className,
}: {
  icon?: LucideIcon
  illustration?: ReactNode
  title: string
  description?: string
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 py-10 text-center",
        className
      )}
    >
      {illustration ?? (
        <div className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
          {Icon && <Icon className="size-5" />}
        </div>
      )}
      <p className="text-sm font-medium">{title}</p>
      {description && (
        <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      )}
    </div>
  )
}
