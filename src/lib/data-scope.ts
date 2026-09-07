import type { Session } from "next-auth"

import { prisma } from "./prisma"

type ScopedSession = { user: Pick<Session["user"], "id" | "restrictToOwnData"> }

/**
 * Merge into a `prisma.shipment.findMany`/`findFirst` `where` clause. Empty
 * object (no-op) for a normal account or no session at all (pages that call
 * this have already had auth enforced one layer up, in the (app) layout --
 * accepting null here just avoids every call site repeating the guard);
 * restricts to shipments the account itself created for one with
 * `restrictToOwnData` set.
 */
export function shipmentScopeWhere(session: ScopedSession | null) {
  return session?.user.restrictToOwnData
    ? { createdById: session.user.id }
    : {}
}

/**
 * Same as shipmentScopeWhere, but for queries that start from Container and
 * filter through its parent shipment (offload scheduling, detention
 * tracking) -- merge into `where.shipment`.
 */
export function shipmentViaContainerScopeWhere(session: ScopedSession | null) {
  return session?.user.restrictToOwnData
    ? { createdById: session.user.id }
    : {}
}

/**
 * Call from a server action after requireRole(), before mutating anything
 * tied to `shipmentId`. No-op for a normal account. Throws the same generic
 * "Forbidden" requireRole() throws (never reveals whether the shipment
 * exists) for a restricted account that doesn't own it.
 */
export async function requireShipmentAccess(session: ScopedSession, shipmentId: string) {
  if (!session.user.restrictToOwnData) return

  const shipment = await prisma.shipment.findUnique({
    where: { id: shipmentId },
    select: { createdById: true },
  })
  if (!shipment || shipment.createdById !== session.user.id) {
    throw new Error("Forbidden")
  }
}

/** Same as requireShipmentAccess, starting from a containerId instead. */
export async function requireContainerAccess(session: ScopedSession, containerId: string) {
  if (!session.user.restrictToOwnData) return

  const container = await prisma.container.findUnique({
    where: { id: containerId },
    select: { shipment: { select: { createdById: true } } },
  })
  if (!container || container.shipment.createdById !== session.user.id) {
    throw new Error("Forbidden")
  }
}
