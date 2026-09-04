import Link from "next/link"
import { redirect } from "next/navigation"
import { ArrowLeft } from "lucide-react"

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
      <Link
        href="/shipments"
        className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" />
        Back to Shipments
      </Link>
      <div>
        <h1 className="text-2xl font-semibold">New Shipment</h1>
        <p className="text-sm text-muted-foreground">
          Enter the bill of lading details, then add each container on this
          shipment.
        </p>
      </div>
      <ShipmentForm />
    </div>
  )
}
