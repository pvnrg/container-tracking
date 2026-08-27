import { redirect } from "next/navigation"

import { auth } from "@/auth"

import { ShipmentForm } from "./shipment-form"

export default async function NewShipmentPage() {
  const session = await auth()
  const canCreate =
    session?.user.role === "ADMIN" || session?.user.role === "LOGISTICS_OPERATOR"

  if (!canCreate) {
    redirect("/shipments")
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">New Shipment</h1>
      <ShipmentForm />
    </div>
  )
}
