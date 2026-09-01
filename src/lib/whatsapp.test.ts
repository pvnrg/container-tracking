import { sendWhatsAppMessage } from "./whatsapp"

describe("sendWhatsAppMessage", () => {
  const originalKey = process.env.WHATSAPP_API_KEY

  afterEach(() => {
    process.env.WHATSAPP_API_KEY = originalKey
    jest.restoreAllMocks()
  })

  it("skips sending and never calls fetch when no API key is configured", async () => {
    delete process.env.WHATSAPP_API_KEY
    const fetchSpy = jest.spyOn(global, "fetch")

    const result = await sendWhatsAppMessage("+250700000000", "hello")

    expect(result).toEqual({ status: "skipped" })
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it("returns sent with the message id on a successful response", async () => {
    process.env.WHATSAPP_API_KEY = "test-key"
    jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ id: "abc123" }),
    } as Response)

    const result = await sendWhatsAppMessage("+250700000000", "hello")

    expect(result).toEqual({ status: "sent", messageSid: "abc123" })
  })

  it("returns failed with the response body on a non-2xx response", async () => {
    process.env.WHATSAPP_API_KEY = "test-key"
    jest.spyOn(global, "fetch").mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => "server error",
    } as Response)

    const result = await sendWhatsAppMessage("+250700000000", "hello")

    expect(result.status).toBe("failed")
    expect(result.error).toContain("HTTP 500")
    expect(result.error).toContain("server error")
  })

  it("returns failed when fetch throws (network error)", async () => {
    process.env.WHATSAPP_API_KEY = "test-key"
    jest.spyOn(global, "fetch").mockRejectedValue(new Error("network down"))

    const result = await sendWhatsAppMessage("+250700000000", "hello")

    expect(result).toEqual({ status: "failed", error: "network down" })
  })
})
