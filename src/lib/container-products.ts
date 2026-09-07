/**
 * Dedupes and summarizes a set of containers' product names into one short
 * line for display, e.g. "Steel Coils, Ceramic Tiles" or, once there are
 * more than two distinct products, "Steel Coils, Ceramic Tiles & 1 more".
 */
export function summarizeContainerProducts(
  containers: { inventoryReference: string }[]
): string | undefined {
  const names = Array.from(new Set(containers.map((c) => c.inventoryReference)))
  if (names.length === 0) return undefined
  if (names.length <= 2) return names.join(", ")
  return `${names.slice(0, 2).join(", ")} & ${names.length - 2} more`
}
