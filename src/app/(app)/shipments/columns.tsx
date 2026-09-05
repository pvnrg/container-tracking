"use client"

import Link from "next/link"
import type { ColumnDef } from "@tanstack/react-table"
import type {
  DischargePort,
  RwandanDestination,
  ShipmentStatus,
} from "@prisma/client"

import { Badge } from "@/components/ui/badge"
import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header"
import {
  DISCHARGE_PORT_LABELS,
  SHIPMENT_STATUS_BADGE_CLASSES,
  SHIPMENT_STATUS_LABELS,
} from "@/lib/shipment-labels"

import { ShipmentDeleteButton } from "./shipment-delete-button"
import { ShipmentEditDialog } from "./shipment-edit-dialog"

export type ShipmentRow = {
  id: string
  blNumber: string
  shippingLine: string
  dischargePort: DischargePort
  containerCount: number
  status: ShipmentStatus
  currentEta: Date
  actualDischargeDate: Date | null
  transitStartedAt: Date | null
  transitArrivalEta: Date | null
  destinationWarehouse: RwandanDestination | null
}

export function createShipmentColumns(canManage: boolean): ColumnDef<ShipmentRow>[] {
  const columns: ColumnDef<ShipmentRow>[] = [
    {
      accessorKey: "blNumber",
      meta: { label: "BL Number" },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="BL Number" />
      ),
      cell: ({ row }) => (
        <Link
          href={`/shipments/${row.original.id}`}
          className="font-medium hover:underline"
        >
          {row.original.blNumber}
        </Link>
      ),
    },
    {
      accessorKey: "shippingLine",
      meta: { label: "Shipping Line" },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Shipping Line" />
      ),
    },
    {
      accessorKey: "dischargePort",
      meta: { label: "Discharge Port" },
      header: "Discharge Port",
      cell: ({ row }) => DISCHARGE_PORT_LABELS[row.original.dischargePort],
      enableSorting: false,
    },
    {
      accessorKey: "containerCount",
      meta: { label: "Containers" },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Containers" />
      ),
    },
    {
      accessorKey: "status",
      meta: { label: "Status" },
      header: "Status",
      filterFn: "equalsString",
      cell: ({ row }) => (
        <Badge
          variant="outline"
          className={SHIPMENT_STATUS_BADGE_CLASSES[row.original.status]}
        >
          {SHIPMENT_STATUS_LABELS[row.original.status]}
        </Badge>
      ),
      enableSorting: false,
    },
    {
      accessorKey: "currentEta",
      meta: { label: "Current ETA" },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Current ETA" />
      ),
      cell: ({ row }) => row.original.currentEta.toLocaleDateString(),
    },
  ]

  if (canManage) {
    columns.push({
      id: "actions",
      header: () => <div className="text-right">Actions</div>,
      enableHiding: false,
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex justify-end gap-2">
          <ShipmentEditDialog
            shipment={{
              id: row.original.id,
              blNumber: row.original.blNumber,
              status: row.original.status,
              currentEta: row.original.currentEta,
              actualDischargeDate: row.original.actualDischargeDate,
              transitStartedAt: row.original.transitStartedAt,
              transitArrivalEta: row.original.transitArrivalEta,
              destinationWarehouse: row.original.destinationWarehouse,
            }}
          />
          <ShipmentDeleteButton
            shipmentId={row.original.id}
            blNumber={row.original.blNumber}
          />
        </div>
      ),
    })
  }

  return columns
}
