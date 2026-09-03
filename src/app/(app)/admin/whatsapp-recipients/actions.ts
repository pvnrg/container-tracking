"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { requireRole } from "@/lib/auth-utils"
import { prisma } from "@/lib/prisma"

const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+[1-9]\d{7,14}$/, "Enter a phone number in E.164 format, e.g. +250700000001")

const addRecipientSchema = z.object({
  label: z.string().trim().min(1, "Label is required"),
  phoneNumber: phoneSchema,
})

export async function addRecipient(formData: FormData) {
  await requireRole(["ADMIN"])

  const parsed = addRecipientSchema.parse({
    label: formData.get("label"),
    phoneNumber: formData.get("phoneNumber"),
  })

  const existing = await prisma.whatsAppRecipient.findUnique({
    where: { phoneNumber: parsed.phoneNumber },
  })
  if (existing) {
    throw new Error("This phone number is already on the list")
  }

  await prisma.whatsAppRecipient.create({ data: parsed })

  revalidatePath("/admin/whatsapp-recipients")
}

export async function setRecipientActive(id: string, isActive: boolean) {
  await requireRole(["ADMIN"])

  await prisma.whatsAppRecipient.update({
    where: { id },
    data: { isActive },
  })

  revalidatePath("/admin/whatsapp-recipients")
}

export async function removeRecipient(id: string) {
  await requireRole(["ADMIN"])

  await prisma.whatsAppRecipient.delete({ where: { id } })

  revalidatePath("/admin/whatsapp-recipients")
}
