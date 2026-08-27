import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { prisma } from "@/lib/prisma"

export default async function DashboardPage() {
  const [total, inTransit, atPort, completed] = await Promise.all([
    prisma.shipment.count(),
    prisma.shipment.count({ where: { status: "IN_TRANSIT_SEA" } }),
    prisma.shipment.count({ where: { status: "ARRIVED_PORT_OF_DISCHARGE" } }),
    prisma.shipment.count({ where: { status: "COMPLETED" } }),
  ])

  const stats = [
    { label: "Total Shipments", value: total },
    { label: "In-Transit (Ocean)", value: inTransit },
    { label: "At Port of Discharge", value: atPort },
    { label: "Completed", value: completed },
  ]

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {s.label}
              </CardTitle>
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
