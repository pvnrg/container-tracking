import type { UserRole } from "@prisma/client"
import type { DefaultSession } from "next-auth"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      role: UserRole
      restrictToOwnData: boolean
    } & DefaultSession["user"]
  }

  interface User {
    role: UserRole
    restrictToOwnData: boolean
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id: string
    role: UserRole
    restrictToOwnData: boolean
  }
}
