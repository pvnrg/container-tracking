import { ContainerStatus, ShipmentStatus } from "@prisma/client"

import { prisma } from "./prisma"

// Maps a shipment status to the container status its containers should
// reach once the shipment gets there, so Container.status doesn't go stale
// once the shipment has actually moved past it (e.g. a container still
// showing "Discharged at Port" after its shipment says "Loaded on Truck").
// `from` scopes the update to containers still at the expected prior
// status, so one that's already further along (e.g. manually offloaded
// early) is never regressed by this.
const CONTAINER_STATUS_SYNC: Partial<
  Record<ShipmentStatus, { from: ContainerStatus; to: ContainerStatus }>
> = {
  LOADED_ROAD_TRANSIT: { from: "DISCHARGED_AT_PORT", to: "IN_TRANSIT_TRUCK" },
  ARRIVED_DESTINATION: { from: "IN_TRANSIT_TRUCK", to: "DELIVERED_WAREHOUSE" },
}

export async function syncContainerStatusToShipment(
  shipmentId: string,
  shipmentStatus: ShipmentStatus
) {
  const sync = CONTAINER_STATUS_SYNC[shipmentStatus]
  if (!sync) return

  await prisma.container.updateMany({
    where: { shipmentId, status: sync.from },
    data: { status: sync.to },
  })
}
