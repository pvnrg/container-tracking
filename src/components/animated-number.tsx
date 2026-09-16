"use client"

import { useEffect, useState } from "react"

// Counts up from 0 to `value` on mount using an eased requestAnimationFrame
// loop -- collapses to a single immediate frame for prefers-reduced-motion,
// rather than short-circuiting with a setState call directly in the effect
// body (react-hooks/set-state-in-effect).
export function AnimatedNumber({
  value,
  duration = 900,
}: {
  value: number
  duration?: number
}) {
  const [display, setDisplay] = useState(0)

  useEffect(() => {
    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    const effectiveDuration = prefersReducedMotion ? 0 : duration

    let frame: number
    const start = performance.now()

    function tick(now: number) {
      const progress =
        effectiveDuration <= 0 ? 1 : Math.min((now - start) / effectiveDuration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplay(Math.round(eased * value))
      if (progress < 1) frame = requestAnimationFrame(tick)
    }

    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [value, duration])

  return <span className="tabular-nums">{display}</span>
}
