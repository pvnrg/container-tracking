import { fileTypeFromBuffer } from "file-type"

// Legacy Office formats (.doc/.xls) share the same OLE Compound File Binary
// container, so file-type can only tell us "this is a CFB file" -- it can't
// distinguish a .doc from an .xls (or a .ppt) from the bytes alone. Anything
// declared as one of those legacy mime types is accepted if the bytes are a
// valid CFB container.
const LEGACY_OFFICE_MIME_TYPES = new Set([
  "application/msword",
  "application/vnd.ms-excel",
])

// Verifies the file's actual bytes (magic numbers) match what the browser
// claimed its type was, so a renamed/relabeled file can't sneak past the
// declared-mime-type allowlist check.
export async function fileContentsMatchDeclaredType(
  buffer: Buffer,
  declaredMimeType: string
): Promise<boolean> {
  const detected = await fileTypeFromBuffer(buffer)

  if (LEGACY_OFFICE_MIME_TYPES.has(declaredMimeType)) {
    return detected?.mime === "application/x-cfb"
  }

  return detected?.mime === declaredMimeType
}
