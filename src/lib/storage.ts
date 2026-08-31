import { randomUUID } from "node:crypto"
import { mkdir, readFile as fsReadFile, rm, writeFile } from "node:fs/promises"
import path from "node:path"

const UPLOAD_ROOT = path.join(process.cwd(), "uploads")

function sanitizeFilename(name: string) {
  const base = name.replace(/[/\\]/g, "_").replace(/\0/g, "").replace(/\.\./g, "_")
  const trimmed = base.trim().slice(-100) || "file"
  return trimmed
}

function resolveKeyPath(key: string) {
  const resolved = path.resolve(UPLOAD_ROOT, key)
  if (!resolved.startsWith(UPLOAD_ROOT + path.sep)) {
    throw new Error("Invalid storage key")
  }
  return resolved
}

export async function saveFile({
  shipmentId,
  originalName,
  buffer,
}: {
  shipmentId: string
  originalName: string
  buffer: Buffer
}): Promise<{ key: string }> {
  const safeName = sanitizeFilename(originalName)
  const key = `${shipmentId}/${randomUUID()}-${safeName}`
  const filePath = resolveKeyPath(key)

  await mkdir(path.dirname(filePath), { recursive: true })
  await writeFile(filePath, buffer)

  return { key }
}

export async function readFile(key: string): Promise<Buffer> {
  return fsReadFile(resolveKeyPath(key))
}

export async function deleteFile(key: string): Promise<void> {
  await rm(resolveKeyPath(key), { force: true })
}
