import { PrismaClient, UserRole } from "@prisma/client"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()

const SEED_USERS: {
  email: string
  name: string
  phone: string
  role: UserRole
  password: string
}[] = [
  {
    email: "admin@shippingt.test",
    name: "Amina Admin",
    phone: "+250700000001",
    role: "ADMIN",
    password: "Password123!",
  },
  {
    email: "operator@shippingt.test",
    name: "Oscar Operator",
    phone: "+250700000002",
    role: "LOGISTICS_OPERATOR",
    password: "Password123!",
  },
  {
    email: "transporter@shippingt.test",
    name: "Tessa Transporter",
    phone: "+250700000003",
    role: "TRANSPORTER",
    password: "Password123!",
  },
]

const SEED_EMAILS = new Set(SEED_USERS.map((u) => u.email))

async function main() {
  // These accounts share a well-known password (printed below) and are
  // meant for local development only. Refuse to run against anything that
  // looks like a real environment, so they can never land somewhere an
  // attacker could find and use them.
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "Refusing to seed: NODE_ENV=production. These accounts use a shared, well-known password and must never exist outside local development."
    )
  }

  const otherUsers = await prisma.user.findMany({
    where: { email: { notIn: [...SEED_EMAILS] } },
    select: { email: true },
    take: 1,
  })
  if (otherUsers.length > 0) {
    throw new Error(
      `Refusing to seed: this database already has at least one non-seed account (${otherUsers[0].email}), which means it's a real environment, not an empty dev DB.`
    )
  }

  for (const seedUser of SEED_USERS) {
    const passwordHash = await bcrypt.hash(seedUser.password, 10)
    await prisma.user.upsert({
      where: { email: seedUser.email },
      update: {},
      create: {
        email: seedUser.email,
        name: seedUser.name,
        phone: seedUser.phone,
        role: seedUser.role,
        password: passwordHash,
      },
    })
  }

  console.log("Seeded users:")
  for (const u of SEED_USERS) {
    console.log(`  ${u.role.padEnd(20)} ${u.email} / ${u.password}`)
  }
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
