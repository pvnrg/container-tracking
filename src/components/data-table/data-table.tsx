"use client"

import { useCallback, useState, type ReactNode } from "react"
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type FilterFn,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table"
import { Search } from "lucide-react"

import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

import { DataTablePagination } from "./data-table-pagination"
import { DataTableViewOptions } from "./data-table-view-options"

export function DataTable<TData, TValue>({
  columns,
  data,
  searchableColumns,
  searchPlaceholder = "Search...",
  filters,
  emptyMessage = "No results.",
  initialPageSize = 10,
  pageSizeOptions,
}: {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  // Column ids the search box matches against (OR'd together). Omit to
  // disable the search box entirely for tables where it isn't useful.
  searchableColumns?: string[]
  searchPlaceholder?: string
  // Page-specific filter controls (e.g. a Status <Select>), rendered next
  // to the search box.
  filters?: ReactNode
  emptyMessage?: ReactNode
  initialPageSize?: number
  pageSizeOptions?: number[]
}) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [globalFilter, setGlobalFilter] = useState("")

  const searchFilterFn = useCallback<FilterFn<TData>>(
    (row, _columnId, filterValue) => {
      if (!searchableColumns || searchableColumns.length === 0) return true
      const search = String(filterValue).trim().toLowerCase()
      if (!search) return true
      return searchableColumns.some((columnId) => {
        const value = row.getValue(columnId)
        return String(value ?? "")
          .toLowerCase()
          .includes(search)
      })
    },
    [searchableColumns]
  )

  const table = useReactTable({
    data,
    columns,
    state: { sorting, columnVisibility, globalFilter },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: searchFilterFn,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: initialPageSize } },
  })

  const hasToolbar = Boolean(searchableColumns?.length) || Boolean(filters)

  return (
    <div className="flex flex-col gap-3">
      {hasToolbar && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            {searchableColumns && searchableColumns.length > 0 && (
              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={globalFilter}
                  onChange={(e) => setGlobalFilter(e.target.value)}
                  placeholder={searchPlaceholder}
                  className="h-8 w-56 pl-8"
                />
              </div>
            )}
            {filters}
          </div>
          <DataTableViewOptions table={table} />
        </div>
      )}

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-muted-foreground"
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {data.length > 0 && (
        <DataTablePagination table={table} pageSizeOptions={pageSizeOptions} />
      )}
    </div>
  )
}
