"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Controller, useFieldArray, useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { BlType, DischargePort, RwandanDestination } from "@prisma/client"
import { toast } from "sonner"
import { Check, Plus, Trash2 } from "lucide-react"

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
  BL_TYPE_LABELS,
  DESTINATION_WAREHOUSE_LABELS,
  DISCHARGE_PORT_LABELS,
} from "@/lib/shipment-labels"

import { createShipment } from "../actions"
import { uploadDocument } from "../[id]/documents-actions"
import type { ExtractedShipmentData } from "./extract-actions"
import { OblUploadCard } from "./obl-upload-card"

const containerSchema = z.object({
  containerNumber: z.string().min(1, "Required"),
  containerType: z.string().min(1, "Required"),
  sealNumber: z.string().optional(),
  tareWeightKg: z.string().min(1, "Required"),
  grossWeightKg: z.string().min(1, "Required"),
  inventoryReference: z.string().min(1, "Required"),
  itemQuantity: z.string().min(1, "Required"),
})

const shipmentSchema = z.object({
  blNumber: z.string().min(1, "BL number is required"),
  blType: z.nativeEnum(BlType, { message: "Select a BL type" }),
  shippingLine: z.string().min(1, "Shipping line is required"),
  vesselName: z.string().min(1, "Vessel name is required"),
  voyageNumber: z.string().optional(),
  bookingRef: z.string().optional(),
  originCountry: z.string().min(1, "Origin country is required"),
  originPort: z.string().min(1, "Origin port is required"),
  dischargePort: z.nativeEnum(DischargePort, {
    message: "Select a discharge port",
  }),
  destinationWarehouse: z.nativeEnum(RwandanDestination, {
    message: "Select a destination warehouse",
  }),
  shipperName: z.string().min(1, "Shipper is required"),
  consigneeName: z.string().min(1, "Consignee is required"),
  notifyParty: z.string().min(1, "Notify party is required"),
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

  const [oblFile, setOblFile] = useState<File | null>(null)

  const {
    register,
    control,
    handleSubmit,
    getValues,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(shipmentSchema),
    defaultValues: {
      blType: "" as BlType,
      dischargePort: "" as DischargePort,
      destinationWarehouse: "" as RwandanDestination,
      containers: [emptyContainer],
    },
  })

  const { fields, append, remove } = useFieldArray({
    control,
    name: "containers",
  })

  const handleExtracted = (file: File, data: ExtractedShipmentData) => {
    setOblFile(file)

    // reset() re-registers every field (including the container array) in
    // one atomic pass. The container fields are bound via Controller rather
    // than register() specifically so this stays reliable when the array's
    // length changes -- an uncontrolled input doesn't always pick up a new
    // value when a row is added or removed in the same update.
    const current = getValues()
    reset({
      ...current,
      blNumber: data.blNumber || current.blNumber,
      blType: data.blType || current.blType,
      shippingLine: data.shippingLine || current.shippingLine,
      vesselName: data.vesselName || current.vesselName,
      voyageNumber: data.voyageNumber || current.voyageNumber,
      bookingRef: data.bookingRef || current.bookingRef,
      originCountry: data.originCountry || current.originCountry,
      originPort: data.originPort || current.originPort,
      dischargePort: data.dischargePort || current.dischargePort,
      shipperName: data.shipperName || current.shipperName,
      consigneeName: data.consigneeName || current.consigneeName,
      notifyParty: data.notifyParty || current.notifyParty,
      containers:
        data.containers.length > 0
          ? data.containers.map((c) => ({
              containerNumber: c.containerNumber ?? "",
              containerType: c.containerType || emptyContainer.containerType,
              sealNumber: c.sealNumber ?? "",
              tareWeightKg: c.tareWeightKg ?? "",
              grossWeightKg: c.grossWeightKg ?? "",
              inventoryReference: c.inventoryReference ?? "",
              itemQuantity: c.itemQuantity ?? "",
            }))
          : current.containers,
    })
  }

  const onSubmit = async (values: FormValues) => {
    setSubmitError(null)
    try {
      const result = await createShipment({
        ...values,
        containers: values.containers.map((c) => ({
          ...c,
          tareWeightKg: Number(c.tareWeightKg),
          grossWeightKg: Number(c.grossWeightKg),
          itemQuantity: Number(c.itemQuantity),
        })),
      })

      if (oblFile) {
        try {
          const docFormData = new FormData()
          docFormData.set("shipmentId", result.id)
          docFormData.set("stage", "ENTRY_LEVEL")
          docFormData.set("type", "BILL_OF_LADING")
          docFormData.set("file", oblFile)
          await uploadDocument(docFormData)
        } catch {
          toast.warning(
            "Shipment created, but the OBL file couldn't be attached automatically. Upload it from the shipment page."
          )
        }
      }

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
      <OblUploadCard onExtracted={handleExtracted} />

      <Card>
        <CardHeader>
          <CardTitle>Bill of Lading Details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="BL Number" error={errors.blNumber?.message} required>
            <Input {...register("blNumber")} placeholder="MEDUXW419436" />
          </Field>
          <Field label="BL Type" error={errors.blType?.message} required>
            <Controller
              control={control}
              name="blType"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select BL type">
                      {(value: BlType | null) =>
                        value ? BL_TYPE_LABELS[value] : "Select BL type"
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {Object.values(BlType).map((type) => (
                      <SelectItem key={type} value={type}>
                        {BL_TYPE_LABELS[type]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
          <Field label="Shipping Line" error={errors.shippingLine?.message} required>
            <Input {...register("shippingLine")} placeholder="MSC" />
          </Field>
          <Field label="Vessel Name" error={errors.vesselName?.message} required>
            <Input {...register("vesselName")} placeholder="MSC ASYA" />
          </Field>
          <Field label="Voyage Number" error={errors.voyageNumber?.message}>
            <Input {...register("voyageNumber")} placeholder="MA622R" />
          </Field>
          <Field label="Booking Reference" error={errors.bookingRef?.message}>
            <Input {...register("bookingRef")} />
          </Field>
          <Field label="Origin Country" error={errors.originCountry?.message} required>
            <Input {...register("originCountry")} placeholder="India" />
          </Field>
          <Field label="Origin Port" error={errors.originPort?.message} required>
            <Input {...register("originPort")} placeholder="Ennore, India" />
          </Field>
          <Field
            label="Discharge Port"
            error={errors.dischargePort?.message}
            required
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
            required
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
          <Field label="Shipper" error={errors.shipperName?.message} required>
            <Input {...register("shipperName")} />
          </Field>
          <Field label="Consignee" error={errors.consigneeName?.message} required>
            <Input {...register("consigneeName")} />
          </Field>
          <Field label="Notify Party" error={errors.notifyParty?.message} required>
            <Input {...register("notifyParty")} />
          </Field>
          <Field label="Current ETA" error={errors.currentEta?.message} required>
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
            <Plus data-icon="inline-start" />
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
                    variant="destructive"
                    size="sm"
                    onClick={() => remove(index)}
                  >
                    <Trash2 data-icon="inline-start" />
                    Remove
                  </Button>
                )}
              </div>
              <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Field
                  label="Container Number"
                  error={errors.containers?.[index]?.containerNumber?.message}
                  required
                >
                  <Controller
                    control={control}
                    name={`containers.${index}.containerNumber`}
                    render={({ field }) => (
                      <Input {...field} placeholder="MEDU1234567" />
                    )}
                  />
                </Field>
                <Field
                  label="Container Type"
                  error={errors.containers?.[index]?.containerType?.message}
                  required
                >
                  <Controller
                    control={control}
                    name={`containers.${index}.containerType`}
                    render={({ field }) => <Input {...field} />}
                  />
                </Field>
                <Field
                  label="Seal Number"
                  error={errors.containers?.[index]?.sealNumber?.message}
                >
                  <Controller
                    control={control}
                    name={`containers.${index}.sealNumber`}
                    render={({ field }) => <Input {...field} />}
                  />
                </Field>
                <Field
                  label="Tare Weight (kg)"
                  error={errors.containers?.[index]?.tareWeightKg?.message}
                  required
                >
                  <Controller
                    control={control}
                    name={`containers.${index}.tareWeightKg`}
                    render={({ field }) => (
                      <Input type="number" step="0.01" {...field} />
                    )}
                  />
                </Field>
                <Field
                  label="Gross Weight (kg)"
                  error={errors.containers?.[index]?.grossWeightKg?.message}
                  required
                >
                  <Controller
                    control={control}
                    name={`containers.${index}.grossWeightKg`}
                    render={({ field }) => (
                      <Input type="number" step="0.01" {...field} />
                    )}
                  />
                </Field>
                <Field
                  label="Item Quantity"
                  error={errors.containers?.[index]?.itemQuantity?.message}
                  required
                >
                  <Controller
                    control={control}
                    name={`containers.${index}.itemQuantity`}
                    render={({ field }) => (
                      <Input type="number" {...field} />
                    )}
                  />
                </Field>
                <Field
                  label="Inventory Reference"
                  error={
                    errors.containers?.[index]?.inventoryReference?.message
                  }
                  required
                >
                  <Controller
                    control={control}
                    name={`containers.${index}.inventoryReference`}
                    render={({ field }) => (
                      <Input {...field} placeholder="Woodfree Paper in Reels" />
                    )}
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
          <Check data-icon="inline-start" />
          {isSubmitting ? "Creating..." : "Create Shipment"}
        </Button>
      </div>
    </form>
  )
}

function Field({
  label,
  error,
  required,
  children,
}: {
  label: string
  error?: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>
        {label}
        {required && <span className="text-destructive"> *</span>}
      </Label>
      {children}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
