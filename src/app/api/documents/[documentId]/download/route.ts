import { NextRequest, NextResponse } from "next/server"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { readFile } from "@/lib/storage"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
  const session = await auth()
  if (!session?.user) {
    return new NextResponse("Unauthorized", { status: 401 })
  }

  const { documentId } = await params
  const doc = await prisma.document.findUnique({ where: { id: documentId } })
  if (!doc) {
    return new NextResponse("Not found", { status: 404 })
  }

  const buffer = await readFile(doc.fileUrl)

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": doc.mimeType,
      "Content-Disposition": `inline; filename="${encodeURIComponent(doc.fileName)}"`,
      "Content-Length": String(doc.fileSize),
    },
  })
}
