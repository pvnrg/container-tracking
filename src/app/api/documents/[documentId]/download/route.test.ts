const authMock = jest.fn()
jest.mock("@/auth", () => ({ auth: (...args: unknown[]) => authMock(...args) }))

const findUniqueDocumentMock = jest.fn()
jest.mock("@/lib/prisma", () => ({
  prisma: { document: { findUnique: (...args: unknown[]) => findUniqueDocumentMock(...args) } },
}))

const readFileMock = jest.fn()
jest.mock("@/lib/storage", () => ({ readFile: (...args: unknown[]) => readFileMock(...args) }))

import { GET } from "./route"

function req() {
  return {} as never
}

function ctx(documentId: string) {
  return { params: Promise.resolve({ documentId }) }
}

const OWNED_DOC = {
  id: "doc-1",
  fileUrl: "key-1",
  fileName: "invoice.pdf",
  mimeType: "application/pdf",
  fileSize: 4,
  shipment: { createdById: "owner-1" },
}

beforeEach(() => {
  jest.clearAllMocks()
  readFileMock.mockResolvedValue(Buffer.from("data"))
})

describe("GET /api/documents/[documentId]/download", () => {
  it("returns 401 when there is no session at all", async () => {
    authMock.mockResolvedValue(null)

    const res = await GET(req(), ctx("doc-1"))

    expect(res.status).toBe(401)
    expect(findUniqueDocumentMock).not.toHaveBeenCalled()
  })

  it("returns 404 when the document doesn't exist", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", restrictToOwnData: false } })
    findUniqueDocumentMock.mockResolvedValue(null)

    const res = await GET(req(), ctx("missing"))

    expect(res.status).toBe(404)
  })

  // Regression: this route used to only check for a logged-in session,
  // letting any restrictToOwnData account fetch any other user's shipment
  // documents by ID.
  it("returns 404 (not the file) for a restricted account requesting a document from a shipment it doesn't own", async () => {
    authMock.mockResolvedValue({ user: { id: "someone-else", restrictToOwnData: true } })
    findUniqueDocumentMock.mockResolvedValue(OWNED_DOC)

    const res = await GET(req(), ctx("doc-1"))

    expect(res.status).toBe(404)
    expect(readFileMock).not.toHaveBeenCalled()
  })

  it("serves the file for a restricted account requesting its own shipment's document", async () => {
    authMock.mockResolvedValue({ user: { id: "owner-1", restrictToOwnData: true } })
    findUniqueDocumentMock.mockResolvedValue(OWNED_DOC)

    const res = await GET(req(), ctx("doc-1"))

    expect(res.status).toBe(200)
    expect(res.headers.get("Content-Type")).toBe("application/pdf")
    expect(readFileMock).toHaveBeenCalledWith("key-1")
  })

  it("serves the file for a full-access account regardless of who created the shipment", async () => {
    authMock.mockResolvedValue({ user: { id: "admin-1", restrictToOwnData: false } })
    findUniqueDocumentMock.mockResolvedValue(OWNED_DOC)

    const res = await GET(req(), ctx("doc-1"))

    expect(res.status).toBe(200)
  })
})
