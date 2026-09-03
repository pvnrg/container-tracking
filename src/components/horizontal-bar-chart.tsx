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

  return (
    <div className="flex flex-col gap-2.5">
      {items.map((item) => {
        const pct = (item.value / max) * 100
        return (
          <div
            key={item.key}
            className="-mx-1 flex items-center gap-3 rounded-md px-1 py-0.5 hover:bg-muted/50"
          >
            <div className="flex w-36 shrink-0 items-center gap-1.5 text-sm text-muted-foreground">
              {item.icon ? <item.icon className="size-3.5 shrink-0" /> : null}
              <span className="truncate">{item.label}</span>
            </div>
            <div className="flex flex-1 items-center gap-2">
              <div className="h-6 flex-1 rounded-[2px] bg-muted/40">
                <div
                  className={cn("h-6 rounded-r-[4px]", item.colorClass)}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="w-8 shrink-0 text-right text-sm font-medium tabular-nums">
                {item.value}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
