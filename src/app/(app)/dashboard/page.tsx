import { Package, Ship, Anchor, CheckCircle2 } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { prisma } from "@/lib/prisma"
import { cn } from "@/lib/utils"

export default async function DashboardPage() {
  const [total, inTransit, atPort, completed] = await Promise.all([
    prisma.shipment.count(),
    prisma.shipment.count({ where: { status: "IN_TRANSIT_SEA" } }),
    prisma.shipment.count({ where: { status: "ARRIVED_PORT_OF_DISCHARGE" } }),
    prisma.shipment.count({ where: { status: "COMPLETED" } }),
  ])

  const stats = [
    {
      label: "Total Shipments",
      value: total,
      icon: Package,
      classes: "bg-sky-500/10 text-sky-700 dark:text-sky-400",
    },
    {
      label: "In-Transit (Ocean)",
      value: inTransit,
      icon: Ship,
      classes: "bg-violet-500/10 text-violet-700 dark:text-violet-400",
    },
    {
      label: "At Port of Discharge",
      value: atPort,
      icon: Anchor,
      classes: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
    },
    {
      label: "Completed",
      value: completed,
      icon: CheckCircle2,
      classes: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    },
  ]

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {s.label}
              </CardTitle>
              <div
                className={cn(
                  "flex size-9 items-center justify-center rounded-full",
                  s.classes
                )}
              >
                <s.icon className="size-4.5" />
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
