import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { getAssistantAlerts } from "@/lib/assistant-alerts-server"

// Polled by the floating assistant (src/components/assistant). /api is
// excluded from the auth proxy's matcher (src/proxy.ts), so the session
// check has to happen here.
export async function GET() {
  const session = await auth()
  if (!session?.user) {
    return new NextResponse("Unauthorized", { status: 401 })
  }

  return NextResponse.json(await getAssistantAlerts(session))
}
