import { NextRequest, NextResponse } from "next/server"

import { runDailyChecks } from "@/lib/daily-checks"

function isAuthorized(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const header = req.headers.get("authorization")
  return header === `Bearer ${secret}`
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return new NextResponse("Unauthorized", { status: 401 })
  }

  const result = await runDailyChecks()
  return NextResponse.json(result)
}
