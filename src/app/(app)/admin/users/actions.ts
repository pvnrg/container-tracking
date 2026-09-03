"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { Prisma, UserRole } from "@prisma/client"
import bcrypt from "bcryptjs"

import { requireRole } from "@/lib/auth-utils"
import { prisma } from "@/lib/prisma"

const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+[1-9]\d{7,14}$/, "Enter a phone number in E.164 format, e.g. +250700000001")

const createUserSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  email: z.string().trim().email("Enter a valid email"),
  phone: phoneSchema,
  role: z.nativeEnum(UserRole),
  password: z.string().min(8, "Password must be at least 8 characters"),
})

export async function createUser(input: {
  name: string
  email: string
  phone: string
  role: UserRole
  password: string
}) {
  await requireRole(["ADMIN"])
  const parsed = createUserSchema.parse(input)

  const existing = await prisma.user.findUnique({ where: { email: parsed.email } })
  if (existing) {
    throw new Error("A user with this email already exists")
  }

  const passwordHash = await bcrypt.hash(parsed.password, 10)
  await prisma.user.create({
    data: {
      name: parsed.name,
      email: parsed.email,
      phone: parsed.phone,
      role: parsed.role,
      password: passwordHash,
    },
  })

  revalidatePath("/admin/users")
}

const updateUserSchema = z.object({
  userId: z.string().min(1),
  name: z.string().trim().min(1, "Name is required"),
  email: z.string().trim().email("Enter a valid email"),
  phone: phoneSchema,
  role: z.nativeEnum(UserRole),
})

export async function updateUser(input: {
  userId: string
  name: string
  email: string
  phone: string
  role: UserRole
}) {
  await requireRole(["ADMIN"])
  const parsed = updateUserSchema.parse(input)

  try {
    await prisma.user.update({
      where: { id: parsed.userId },
      data: {
        name: parsed.name,
        email: parsed.email,
        phone: parsed.phone,
        role: parsed.role,
      },
    })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new Error("A user with this email already exists")
    }
    throw err
  }

  revalidatePath("/admin/users")
}

const resetPasswordSchema = z.object({
  userId: z.string().min(1),
  password: z.string().min(8, "Password must be at least 8 characters"),
})

export async function resetUserPassword(input: { userId: string; password: string }) {
  await requireRole(["ADMIN"])
  const parsed = resetPasswordSchema.parse(input)

  const passwordHash = await bcrypt.hash(parsed.password, 10)
  await prisma.user.update({
    where: { id: parsed.userId },
    data: { password: passwordHash },
  })

  revalidatePath("/admin/users")
}

export async function setUserActive(userId: string, isActive: boolean) {
  const session = await requireRole(["ADMIN"])
  if (userId === session.user.id && !isActive) {
    throw new Error("You can't deactivate your own account")
  }

  await prisma.user.update({
    where: { id: userId },
    data: { isActive },
  })

  revalidatePath("/admin/users")
}

export async function deleteUser(userId: string) {
  const session = await requireRole(["ADMIN"])
  if (userId === session.user.id) {
    throw new Error("You can't delete your own account")
  }

  try {
    await prisma.user.delete({ where: { id: userId } })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2003") {
      throw new Error(
        "This user has created shipments, uploaded documents, or has other linked records, so they can't be deleted. Deactivate them instead."
      )
    }
    throw err
  }

  revalidatePath("/admin/users")
}
