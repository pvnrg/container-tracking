import path from "node:path"
import { createWorker, type Worker } from "tesseract.js"
import pdfParse from "pdf-parse"

let workerPromise: Promise<Worker> | null = null

function getWorker(): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = createWorker("eng", 1, {
      cachePath: path.join(process.cwd(), ".cache", "tesseract"),
    })
  }
  return workerPromise
}

export async function recognizeImageText(buffer: Buffer): Promise<string> {
  const worker = await getWorker()
  const { data } = await worker.recognize(buffer)
  return data.text
}

export async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  const result = await pdfParse(buffer)
  const text = result.text?.trim() ?? ""
  if (!text) {
    throw new Error(
      "This PDF has no selectable text (it looks like a scanned image). Upload a clear photo or image file of the OBL instead."
    )
  }
  return text
}
