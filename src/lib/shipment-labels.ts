import {
  ContainerStatus,
  DischargePort,
  RwandanDestination,
  ShipmentStatus,
} from "@prisma/client"

export const DISCHARGE_PORT_LABELS: Record<DischargePort, string> = {
  DAR_ES_SALAAM: "Dar es Salaam, Tanzania",
  MOMBASA: "Mombasa, Kenya",
}

export const DESTINATION_WAREHOUSE_LABELS: Record<RwandanDestination, string> = {
  NYANZA_KICUKIRO: "Nyanza, Kicukiro",
  RWAMAGANA_INDUSTRIAL_ZONE: "Rwamagana Industrial Zone",
}

export const SHIPMENT_STATUS_LABELS: Record<ShipmentStatus, string> = {
  SHIPPED_ON_BOARD: "Shipped on Board",
  IN_TRANSIT_SEA: "In-Transit (Ocean)",
  ARRIVED_PORT_OF_DISCHARGE: "Arrived at Port of Discharge",
  CUSTOMS_PROCESSING: "Customs Clearance In-Progress",
  CUSTOMS_CLEARED: "Customs Cleared & Ready for Loading",
  LOADED_ROAD_TRANSIT: "Loaded on Truck / In-Transit (Road)",
  ARRIVED_DESTINATION: "Arrived at Rwandan Destination",
  OFFLOADED: "Offloaded & Unsealed",
  COMPLETED: "Empty Container Returned",
}

// Statuses reached at or after physical discharge at the seaport.
export const ARRIVED_OR_LATER_STATUSES: ShipmentStatus[] = [
  "ARRIVED_PORT_OF_DISCHARGE",
  "CUSTOMS_PROCESSING",
  "CUSTOMS_CLEARED",
  "LOADED_ROAD_TRANSIT",
  "ARRIVED_DESTINATION",
  "OFFLOADED",
  "COMPLETED",
]

// Declaration order matches the SRD's chronological milestone sequence,
// so this doubles as a forward-only progress comparator.
export const SHIPMENT_STATUS_ORDER: ShipmentStatus[] = [
  "SHIPPED_ON_BOARD",
  "IN_TRANSIT_SEA",
  "ARRIVED_PORT_OF_DISCHARGE",
  "CUSTOMS_PROCESSING",
  "CUSTOMS_CLEARED",
  "LOADED_ROAD_TRANSIT",
  "ARRIVED_DESTINATION",
  "OFFLOADED",
  "COMPLETED",
]

export const CONTAINER_STATUS_LABELS: Record<ContainerStatus, string> = {
  ON_VESSEL: "On Vessel",
  DISCHARGED_AT_PORT: "Discharged at Port",
  IN_TRANSIT_TRUCK: "In-Transit (Road)",
  DELIVERED_WAREHOUSE: "Delivered to Warehouse",
  OFFLOADED: "Offloaded",
  EMPTY_RETURNED_TO_DEPOT: "Empty Returned to Depot",
}

// Soft, semantic badge colors grouped by journey phase: at sea (sky),
// at port/customs (amber), inland transit (violet), done (emerald).
export const SHIPMENT_STATUS_BADGE_CLASSES: Record<ShipmentStatus, string> = {
  SHIPPED_ON_BOARD: "border-sky-600/30 bg-sky-500/10 text-sky-700 dark:text-sky-400",
  IN_TRANSIT_SEA: "border-sky-600/30 bg-sky-500/10 text-sky-700 dark:text-sky-400",
  ARRIVED_PORT_OF_DISCHARGE:
    "border-amber-600/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  CUSTOMS_PROCESSING:
    "border-amber-600/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  CUSTOMS_CLEARED:
    "border-violet-600/30 bg-violet-500/10 text-violet-700 dark:text-violet-400",
  LOADED_ROAD_TRANSIT:
    "border-violet-600/30 bg-violet-500/10 text-violet-700 dark:text-violet-400",
  ARRIVED_DESTINATION:
    "border-violet-600/30 bg-violet-500/10 text-violet-700 dark:text-violet-400",
  OFFLOADED:
    "border-emerald-600/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  COMPLETED:
    "border-emerald-600/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
}

export const CONTAINER_STATUS_BADGE_CLASSES: Record<ContainerStatus, string> = {
  ON_VESSEL: "border-sky-600/30 bg-sky-500/10 text-sky-700 dark:text-sky-400",
  DISCHARGED_AT_PORT:
    "border-amber-600/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  IN_TRANSIT_TRUCK:
    "border-violet-600/30 bg-violet-500/10 text-violet-700 dark:text-violet-400",
  DELIVERED_WAREHOUSE:
    "border-violet-600/30 bg-violet-500/10 text-violet-700 dark:text-violet-400",
  OFFLOADED:
    "border-emerald-600/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  EMPTY_RETURNED_TO_DEPOT: "border-border bg-muted text-muted-foreground",
}
