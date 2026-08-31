export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startDailyChecksCron } = await import("@/lib/cron")
    startDailyChecksCron()
  }
}
