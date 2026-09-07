import { ContainerStatus, ShipmentStatus } from "@prisma/client"

import { prisma } from "./prisma"

// Container lifecycle order (matches the enum's own declaration order in
// schema.prisma) -- lets a sync target advance any container that's behind
// it, not just one sitting at a single specific prior status, without ever
// regressing a container that's already further along (e.g. manually
// offloaded early).
const CONTAINER_STATUS_ORDER: ContainerStatus[] = [
  "ON_VESSEL",
  "DISCHARGED_AT_PORT",
  "IN_TRANSIT_TRUCK",
  "DELIVERED_WAREHOUSE",
  "OFFLOADED",
  "EMPTY_RETURNED_TO_DEPOT",
]

// Maps a shipment status to the container status its containers should have
// reached by then, so Container.status doesn't go stale once the shipment
// has actually moved past it -- e.g. a container still showing "Discharged
// at Port" after its shipment says "Loaded on Truck", or still "In-Transit
// (Road)" after the shipment is marked Completed (OFFLOADED and COMPLETED
// were missing here before, which is exactly how that second case
// happened: reachable both via a manual status edit straight to Completed
// and via Stage 4 documents auto-advancing a shipment to OFFLOADED).
const CONTAINER_STATUS_SYNC: Partial<Record<ShipmentStatus, ContainerStatus>> = {
  LOADED_ROAD_TRANSIT: "IN_TRANSIT_TRUCK",
  ARRIVED_DESTINATION: "DELIVERED_WAREHOUSE",
  OFFLOADED: "OFFLOADED",
  COMPLETED: "EMPTY_RETURNED_TO_DEPOT",
}

export async function syncContainerStatusToShipment(
  shipmentId: string,
  shipmentStatus: ShipmentStatus
) {
  const target = CONTAINER_STATUS_SYNC[shipmentStatus]
  if (!target) return

  const behindStatuses = CONTAINER_STATUS_ORDER.slice(
    0,
    CONTAINER_STATUS_ORDER.indexOf(target)
  )
  if (behindStatuses.length === 0) return

  await prisma.container.updateMany({
    where: { shipmentId, status: { in: behindStatuses } },
    data: { status: target },
  })
}
