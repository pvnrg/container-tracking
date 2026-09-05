import { LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"

export interface HorizontalBarChartItem {
  key: string
  label: string
  value: number
  colorClass: string
  icon?: LucideIcon
}

export function HorizontalBarChart({
  items,
}: {
  items: HorizontalBarChartItem[]
}) {
  const max = Math.max(1, ...items.map((item) => item.value))
  const total = items.reduce((sum, item) => sum + item.value, 0)

  return (
    <div className="flex flex-col gap-3">
      {items.map((item) => {
        const pct = total === 0 ? 0 : (item.value / max) * 100
        return (
          <div key={item.key} className="flex items-center gap-3">
            <div className="flex w-[9.5rem] shrink-0 items-center gap-1.5 text-sm text-muted-foreground">
              {item.icon ? <item.icon className="size-3.5 shrink-0" /> : null}
              <span className="truncate">{item.label}</span>
            </div>
            <div className="flex flex-1 items-center gap-2.5">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted/60">
                {pct > 0 && (
                  <div
                    className={cn(
                      "h-full rounded-full transition-[width]",
                      item.colorClass
                    )}
                    style={{ width: `${pct}%` }}
                  />
                )}
              </div>
              <span className="w-6 shrink-0 text-right text-sm font-semibold tabular-nums">
                {item.value}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
