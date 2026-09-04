export async function register() {
  const { assertRequiredEnv } = await import("@/lib/env")

  // AUTH_SECRET is needed by both the Edge (middleware) and Node.js
  // runtimes, since src/proxy.ts calls auth() too.
  assertRequiredEnv([{ name: "AUTH_SECRET", minLength: 32 }])

  if (process.env.NEXT_RUNTIME === "nodejs") {
    assertRequiredEnv([
      { name: "DATABASE_URL" },
      { name: "CRON_SECRET", minLength: 16 },
    ])

    const { startDailyChecksCron } = await import("@/lib/cron")
    startDailyChecksCron()
  }
}
