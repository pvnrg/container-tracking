import { Skeleton } from "@/components/ui/skeleton"
import { TableSkeleton } from "@/components/table-skeleton"

export default function ShipmentsLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-8 w-36" />
      </div>
      <TableSkeleton columns={6} rows={5} />
    </div>
  )
}
