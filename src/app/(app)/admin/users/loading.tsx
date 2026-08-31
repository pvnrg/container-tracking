import { Skeleton } from "@/components/ui/skeleton"
import { TableSkeleton } from "@/components/table-skeleton"

export default function UsersLoading() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-8 w-24" />
      <TableSkeleton columns={5} rows={5} />
    </div>
  )
}
