"use client"

import { useState, type ReactNode } from "react"
import Link from "next/link"
import { ChevronDown } from "lucide-react"

import { cn } from "@/lib/utils"

export interface HorizontalBarChartDetail {
  id: string
  label: string
  href: string
}

export interface HorizontalBarChartItem {
  key: string
  label: string
  value: number
  colorClass: string
  // A rendered icon element (e.g. <Ship className="size-3.5" />), not a
  // component reference -- this is a Client Component, and passing an
  // already-rendered node from the server is what crosses that boundary
  // cleanly (a bare component function can't be serialized as a prop).
  icon?: ReactNode
  // When present (even as an empty array), the row becomes expandable to
  // list exactly what's in it -- click to toggle, not hover, so it works
  // the same on touch devices as it does with a mouse.
  details?: HorizontalBarChartDetail[]
}

const MAX_VISIBLE_DETAILS = 8

export function HorizontalBarChart({
  items,
}: {
  items: HorizontalBarChartItem[]
}) {
  const max = Math.max(1, ...items.map((item) => item.value))
  const [expandedKey, setExpandedKey] = useState<string | null>(null)

  return (
    <div className="flex flex-col gap-1">
      {items.map((item) => {
        const pct = item.value === 0 ? 0 : (item.value / max) * 100
        const isExpandable = item.details !== undefined && item.value > 0
        const isExpanded = isExpandable && expandedKey === item.key

        const row = (
          <div className="flex flex-1 items-center gap-3 py-1.5">
            <div className="flex w-[9.5rem] shrink-0 items-center gap-1.5 text-sm text-muted-foreground">
              {item.icon}
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
              {isExpandable && (
                <ChevronDown
                  className={cn(
                    "size-3.5 shrink-0 text-muted-foreground transition-transform",
                    isExpanded && "rotate-180"
                  )}
                />
              )}
            </div>
          </div>
        )

        return (
          <div key={item.key} className="-mx-1.5 flex flex-col">
            {isExpandable ? (
              <button
                type="button"
                onClick={() => setExpandedKey(isExpanded ? null : item.key)}
                aria-expanded={isExpanded}
                className="flex items-center rounded-md px-1.5 text-left hover:bg-muted/50"
              >
                {row}
              </button>
            ) : (
              <div className="px-1.5">{row}</div>
            )}
            {isExpanded && item.details && (
              <div className="mb-1 ml-[9.5rem] flex flex-col gap-1 border-l pl-3">
                {item.details.slice(0, MAX_VISIBLE_DETAILS).map((detail) => (
                  <Link
                    key={detail.id}
                    href={detail.href}
                    className="truncate text-sm text-primary hover:underline"
                  >
                    {detail.label}
                  </Link>
                ))}
                {item.details.length > MAX_VISIBLE_DETAILS && (
                  <span className="text-sm text-muted-foreground">
                    +{item.details.length - MAX_VISIBLE_DETAILS} more
                  </span>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
