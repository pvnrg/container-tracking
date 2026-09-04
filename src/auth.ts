import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"

import {
  checkLoginRateLimit,
  recordFailedLogin,
  resetLoginAttempts,
} from "@/lib/login-rate-limit"
import { prisma } from "@/lib/prisma"

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        const email = credentials?.email
        const password = credentials?.password
        if (typeof email !== "string" || typeof password !== "string") {
          return null
        }

        // Same generic null-return path as any other auth failure below --
        // the login form always shows a generic "Invalid email or
        // password" message regardless of the reason, so this doesn't
        // reveal to an attacker that they've specifically been
        // rate-limited vs. just guessed wrong.
        const rateLimit = checkLoginRateLimit(email)
        if (!rateLimit.allowed) {
          return null
        }

        const user = await prisma.user.findUnique({ where: { email } })
        if (!user || !user.isActive) {
          recordFailedLogin(email)
          return null
        }

        const passwordValid = await bcrypt.compare(password, user.password)
        if (!passwordValid) {
          recordFailedLogin(email)
          return null
        }

        resetLoginAttempts(email)
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        }
      },
    }),
  ],
  callbacks: {
    jwt: ({ token, user }) => {
      if (user) {
        token.id = user.id as string
        token.role = user.role
      }
      return token
    },
    session: ({ session, token }) => {
      session.user.id = token.id
      session.user.role = token.role
      return session
    },
  },
})
