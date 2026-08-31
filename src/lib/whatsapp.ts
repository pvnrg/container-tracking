const WHATSAPP_API_BASE = "https://richautomate.in/api/v1"

export type WhatsAppSendResult = {
  status: "sent" | "skipped" | "failed"
  messageSid?: string
  error?: string
}

function normalizePhone(phone: string) {
  return phone.replace(/^\+/, "").replace(/[^\d]/g, "")
}

export async function sendWhatsAppMessage(
  phone: string,
  message: string
): Promise<WhatsAppSendResult> {
  const apiKey = process.env.WHATSAPP_API_KEY

  if (!apiKey) {
    console.log(`[whatsapp:skipped] to=${phone} message=${message}`)
    return { status: "skipped" }
  }

  try {
    const res = await fetch(`${WHATSAPP_API_BASE}/send-message`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ phone: normalizePhone(phone), message }),
    })

    if (!res.ok) {
      const text = await res.text().catch(() => "")
      return { status: "failed", error: `HTTP ${res.status}: ${text.slice(0, 200)}` }
    }

    const data = await res.json().catch(() => ({}) as Record<string, unknown>)
    const messageSid =
      typeof data.id === "string"
        ? data.id
        : typeof data.message_id === "string"
          ? data.message_id
          : undefined

    return { status: "sent", messageSid }
  } catch (err) {
    return {
      status: "failed",
      error: err instanceof Error ? err.message : "Unknown error",
    }
  }
}
