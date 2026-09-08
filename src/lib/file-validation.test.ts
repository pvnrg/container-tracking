// file-type ships ESM-only, which this project's CJS-based jest transform
// can't load from node_modules -- mock it at the module boundary instead of
// fighting the transform config. This still exercises the actual logic
// under test (the declared-vs-detected mime comparison and the legacy
// CFB/.doc/.xls branching in fileContentsMatchDeclaredType), just without
// depending on file-type's own real magic-byte sniffing.
const detectMock = jest.fn()
jest.mock("file-type", () => ({ fileTypeFromBuffer: (...args: unknown[]) => detectMock(...args) }))

import { fileContentsMatchDeclaredType } from "./file-validation"

function bufferTaggedAs(mime: string | undefined) {
  detectMock.mockResolvedValueOnce(mime ? { mime, ext: "bin" } : undefined)
  return Buffer.from("irrelevant -- detection is mocked above")
}

describe("fileContentsMatchDeclaredType", () => {
  it("accepts a file whose detected bytes match its declared mime type", async () => {
    const buf = bufferTaggedAs("application/pdf")
    expect(await fileContentsMatchDeclaredType(buf, "application/pdf")).toBe(true)
  })

  it("rejects a file relabeled as a different type (renamed-file spoofing)", async () => {
    const pngBytesDeclaredAsPdf = bufferTaggedAs("image/png")
    expect(await fileContentsMatchDeclaredType(pngBytesDeclaredAsPdf, "application/pdf")).toBe(
      false
    )
  })

  it("rejects content with no recognizable file signature at all", async () => {
    const unrecognizable = bufferTaggedAs(undefined)
    expect(await fileContentsMatchDeclaredType(unrecognizable, "application/pdf")).toBe(false)
  })

  // Legacy Office formats (.doc/.xls) share one OLE Compound File Binary
  // container signature that file-type can't split further -- both must be
  // accepted from a detected "application/x-cfb", not just an exact match.
  it("accepts a CFB container declared as legacy .doc", async () => {
    const cfb = bufferTaggedAs("application/x-cfb")
    expect(await fileContentsMatchDeclaredType(cfb, "application/msword")).toBe(true)
  })

  it("accepts a CFB container declared as legacy .xls", async () => {
    const cfb = bufferTaggedAs("application/x-cfb")
    expect(await fileContentsMatchDeclaredType(cfb, "application/vnd.ms-excel")).toBe(true)
  })

  it("rejects a non-CFB file declared as legacy .doc/.xls", async () => {
    const pdf = bufferTaggedAs("application/pdf")
    expect(await fileContentsMatchDeclaredType(pdf, "application/msword")).toBe(false)
  })

  it("rejects an unrecognizable file declared as legacy .doc/.xls", async () => {
    const unrecognizable = bufferTaggedAs(undefined)
    expect(await fileContentsMatchDeclaredType(unrecognizable, "application/vnd.ms-excel")).toBe(
      false
    )
  })

  it("does not apply the legacy CFB carve-out to modern Office formats", async () => {
    // .docx/.xlsx are real zip containers, not CFB -- a CFB detection under
    // a modern declared type must still be rejected like any other mismatch.
    const cfb = bufferTaggedAs("application/x-cfb")
    expect(
      await fileContentsMatchDeclaredType(
        cfb,
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      )
    ).toBe(false)
  })
})
