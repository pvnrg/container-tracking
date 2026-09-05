import cron from "node-cron"

import { runDailyChecks } from "@/lib/daily-checks"

let started = false

/**
 * Runs the ETA-arrival auto-advance, 7-day ETA broadcast, and detention
 * escalation checks on a schedule inside the Next.js server process. Only
 * works for
 * deployments that keep a persistent Node process alive (this
 * dev server, a VPS, a Docker container running `next start`) --
 * not on serverless platforms like Vercel, which don't run code
 * between requests. Override the schedule with DAILY_CHECKS_CRON.
 */
export function startDailyChecksCron() {
  if (started) return
  started = true

  const pattern = process.env.DAILY_CHECKS_CRON || "0 6 * * *"

  if (!cron.validate(pattern)) {
    console.error(`[cron] Invalid DAILY_CHECKS_CRON pattern "${pattern}", scheduler not started.`)
    return
  }

  cron.schedule(
    pattern,
    async () => {
      const startedAt = new Date().toISOString()
      console.log(`[cron] Running daily checks (${startedAt})`)
      try {
        const result = await runDailyChecks()
        console.log("[cron] Daily checks complete:", JSON.stringify(result))
      } catch (err) {
        console.error("[cron] Daily checks failed:", err)
      }
    },
    { name: "daily-checks", noOverlap: true }
  )

  console.log(`[cron] Daily checks scheduled with pattern "${pattern}"`)
}
