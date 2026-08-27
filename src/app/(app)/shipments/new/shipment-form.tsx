"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Controller, useFieldArray, useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { DischargePort, RwandanDestination } from "@prisma/client"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import {
  DESTINATION_WAREHOUSE_LABELS,
  DISCHARGE_PORT_LABELS,
} from "@/lib/shipment-labels"

import { createShipment } from "../actions"

const containerSchema = z.object({
  containerNumber: z.string().min(1, "Required"),
  containerType: z.string().min(1, "Required"),
  sealNumber: z.string().optional(),
  tareWeightKg: z.string().optional(),
  grossWeightKg: z.string().optional(),
  inventoryReference: z.string().min(1, "Required"),
  itemQuantity: z.string().optional(),
})

const shipmentSchema = z.object({
  blNumber: z.string().min(1, "BL number is required"),
  shippingLine: z.string().min(1, "Shipping line is required"),
  vesselName: z.string().optional(),
  voyageNumber: z.string().optional(),
  bookingRef: z.string().optional(),
  originCountry: z.string().min(1, "Origin country is required"),
  originPort: z.string().optional(),
  dischargePort: z.nativeEnum(DischargePort, {
    message: "Select a discharge port",
  }),
  destinationWarehouse: z.nativeEnum(RwandanDestination).optional(),
  shipperName: z.string().optional(),
  consigneeName: z.string().optional(),
  notifyParty: z.string().optional(),
  currentEta: z.string().min(1, "Current ETA is required"),
  containers: z.array(containerSchema).min(1, "Add at least one container"),
})

type FormValues = z.infer<typeof shipmentSchema>

const emptyContainer: FormValues["containers"][number] = {
  containerNumber: "",
  containerType: "40_HIGH_CUBE",
  sealNumber: "",
  tareWeightKg: "",
  grossWeightKg: "",
  inventoryReference: "",
  itemQuantity: "",
}

export function ShipmentForm() {
  const router = useRouter()
  const [submitError, setSubmitError] = useState<string | null>(null)

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(shipmentSchema),
    defaultValues: {
      dischargePort: "" as DischargePort,
      destinationWarehouse: "" as RwandanDestination,
      containers: [emptyContainer],
    },
  })

  const { fields, append, remove } = useFieldArray({
    control,
    name: "containers",
  })

  const onSubmit = async (values: FormValues) => {
    setSubmitError(null)
    try {
      const result = await createShipment({
        ...values,
        containers: values.containers.map((c) => ({
          ...c,
          tareWeightKg: c.tareWeightKg ? Number(c.tareWeightKg) : undefined,
          grossWeightKg: c.grossWeightKg
            ? Number(c.grossWeightKg)
            : undefined,
          itemQuantity: c.itemQuantity ? Number(c.itemQuantity) : undefined,
        })),
      })
      toast.success("Shipment created")
      router.push(`/shipments/${result.id}`)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to create shipment."
      setSubmitError(message)
      toast.error(message)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Bill of Lading Details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="BL Number" error={errors.blNumber?.message}>
            <Input {...register("blNumber")} placeholder="MEDUXW419436" />
          </Field>
          <Field label="Shipping Line" error={errors.shippingLine?.message}>
            <Input {...register("shippingLine")} placeholder="MSC" />
          </Field>
          <Field label="Vessel Name" error={errors.vesselName?.message}>
            <Input {...register("vesselName")} placeholder="MSC ASYA" />
          </Field>
          <Field label="Voyage Number" error={errors.voyageNumber?.message}>
            <Input {...register("voyageNumber")} placeholder="MA622R" />
          </Field>
          <Field label="Booking Reference" error={errors.bookingRef?.message}>
            <Input {...register("bookingRef")} />
          </Field>
          <Field label="Origin Country" error={errors.originCountry?.message}>
            <Input {...register("originCountry")} placeholder="India" />
          </Field>
          <Field label="Origin Port" error={errors.originPort?.message}>
            <Input {...register("originPort")} placeholder="Ennore, India" />
          </Field>
          <Field
            label="Discharge Port"
            error={errors.dischargePort?.message}
          >
            <Controller
              control={control}
              name="dischargePort"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select discharge port">
                      {(value: DischargePort | null) =>
                        value ? DISCHARGE_PORT_LABELS[value] : "Select discharge port"
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {Object.values(DischargePort).map((port) => (
                      <SelectItem key={port} value={port}>
                        {DISCHARGE_PORT_LABELS[port]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
          <Field
            label="Destination Warehouse"
            error={errors.destinationWarehouse?.message}
          >
            <Controller
              control={control}
              name="destinationWarehouse"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select destination warehouse">
                      {(value: RwandanDestination | null) =>
                        value
                          ? DESTINATION_WAREHOUSE_LABELS[value]
                          : "Select destination warehouse"
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {Object.values(RwandanDestination).map((dest) => (
                      <SelectItem key={dest} value={dest}>
                        {DESTINATION_WAREHOUSE_LABELS[dest]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
          <Field label="Shipper" error={errors.shipperName?.message}>
            <Input {...register("shipperName")} />
          </Field>
          <Field label="Consignee" error={errors.consigneeName?.message}>
            <Input {...register("consigneeName")} />
          </Field>
          <Field label="Notify Party" error={errors.notifyParty?.message}>
            <Input {...register("notifyParty")} />
          </Field>
          <Field label="Current ETA" error={errors.currentEta?.message}>
            <Input type="date" {...register("currentEta")} />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Containers</CardTitle>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => append(emptyContainer)}
          >
            Add Container
          </Button>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {errors.containers?.root?.message && (
            <p className="text-sm text-destructive">
              {errors.containers.root.message}
            </p>
          )}
          {fields.map((field, index) => (
            <div key={field.id}>
              {index > 0 && <Separator className="mb-4" />}
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium">
                  Container {index + 1}
                </h3>
                {fields.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => remove(index)}
                  >
                    Remove
                  </Button>
                )}
              </div>
              <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Field
                  label="Container Number"
                  error={errors.containers?.[index]?.containerNumber?.message}
                >
                  <Input
                    {...register(`containers.${index}.containerNumber`)}
                    placeholder="MEDU1234567"
                  />
                </Field>
                <Field
                  label="Container Type"
                  error={errors.containers?.[index]?.containerType?.message}
                >
                  <Input
                    {...register(`containers.${index}.containerType`)}
                  />
                </Field>
                <Field
                  label="Seal Number"
                  error={errors.containers?.[index]?.sealNumber?.message}
                >
                  <Input {...register(`containers.${index}.sealNumber`)} />
                </Field>
                <Field
                  label="Tare Weight (kg)"
                  error={errors.containers?.[index]?.tareWeightKg?.message}
                >
                  <Input
                    type="number"
                    step="0.01"
                    {...register(`containers.${index}.tareWeightKg`)}
                  />
                </Field>
                <Field
                  label="Gross Weight (kg)"
                  error={errors.containers?.[index]?.grossWeightKg?.message}
                >
                  <Input
                    type="number"
                    step="0.01"
                    {...register(`containers.${index}.grossWeightKg`)}
                  />
                </Field>
                <Field
                  label="Item Quantity"
                  error={errors.containers?.[index]?.itemQuantity?.message}
                >
                  <Input
                    type="number"
                    {...register(`containers.${index}.itemQuantity`)}
                  />
                </Field>
                <Field
                  label="Inventory Reference"
                  error={
                    errors.containers?.[index]?.inventoryReference?.message
                  }
                >
                  <Input
                    {...register(`containers.${index}.inventoryReference`)}
                    placeholder="Woodfree Paper in Reels"
                  />
                </Field>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {submitError && <p className="text-sm text-destructive">{submitError}</p>}

      <div className="flex justify-end gap-3">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Creating..." : "Create Shipment"}
        </Button>
      </div>
    </form>
  )
}

function Field({
  label,
  error,
  children,
}: {
  label: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      {children}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
