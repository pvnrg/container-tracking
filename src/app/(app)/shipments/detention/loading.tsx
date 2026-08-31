import { Skeleton } from "@/components/ui/skeleton"
import { TableSkeleton } from "@/components/table-skeleton"

export default function DetentionLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-96" />
      </div>
      <TableSkeleton columns={6} rows={5} />
    </div>
  )
}
