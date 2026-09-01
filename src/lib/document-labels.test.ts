import { DocumentType } from "@prisma/client"

import { STAGE_DOCUMENT_TYPES } from "./document-labels"

describe("STAGE_DOCUMENT_TYPES", () => {
  it("partitions every DocumentType exactly once across the four stages", () => {
    const allTypes = Object.values(DocumentType)
    const assigned = Object.values(STAGE_DOCUMENT_TYPES).flat()

    expect([...assigned].sort()).toEqual([...allTypes].sort())
    expect(new Set(assigned).size).toBe(assigned.length)
  })
})
