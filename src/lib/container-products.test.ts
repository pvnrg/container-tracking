import { summarizeContainerProducts } from "./container-products"

describe("summarizeContainerProducts", () => {
  it("returns undefined for no containers", () => {
    expect(summarizeContainerProducts([])).toBeUndefined()
  })

  it("returns the single product name as-is", () => {
    expect(
      summarizeContainerProducts([{ inventoryReference: "Steel Coils" }])
    ).toBe("Steel Coils")
  })

  it("joins up to two distinct products with a comma", () => {
    expect(
      summarizeContainerProducts([
        { inventoryReference: "Steel Coils" },
        { inventoryReference: "Ceramic Tiles" },
      ])
    ).toBe("Steel Coils, Ceramic Tiles")
  })

  it("dedupes repeated product names", () => {
    expect(
      summarizeContainerProducts([
        { inventoryReference: "Steel Coils" },
        { inventoryReference: "Steel Coils" },
      ])
    ).toBe("Steel Coils")
  })

  it("shows the first two plus a count once there are more than two", () => {
    expect(
      summarizeContainerProducts([
        { inventoryReference: "Steel Coils" },
        { inventoryReference: "Ceramic Tiles" },
        { inventoryReference: "LED Lighting Fixtures" },
      ])
    ).toBe("Steel Coils, Ceramic Tiles & 1 more")
  })
})
