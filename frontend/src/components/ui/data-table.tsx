"use client"

import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"

interface Column<T> {
  key: string
  label: string
  render: (item: T) => React.ReactNode
  className?: string
  hide?: "sm" | "md" | "lg"
}

interface DataTableProps<T> {
  columns: Column<T>[]
  data: T[]
  loading?: boolean
  emptyState?: React.ReactNode
  skeletonRows?: number
  onRowClick?: (item: T) => void
}

export function DataTable<T extends { id: string }>({
  columns,
  data,
  loading,
  emptyState,
  skeletonRows = 5,
  onRowClick,
}: DataTableProps<T>) {
  if (loading) {
    return (
      <div className="p-4 space-y-3">
        {Array.from({ length: skeletonRows }).map((_, i) => (
          <div key={i} className="flex items-center gap-4">
            {columns.map((col) => (
              <Skeleton key={col.key} className="h-4 flex-1" />
            ))}
          </div>
        ))}
      </div>
    )
  }

  if (data.length === 0) {
    return emptyState || null
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((col) => (
              <TableHead
                key={col.key}
                className={`${col.className || ""} ${
                  col.hide ? `hidden ${col.hide === "sm" ? "sm:table-cell" : col.hide === "md" ? "md:table-cell" : "lg:table-cell"}` : ""
                }`}
              >
                {col.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((item) => (
            <TableRow
              key={item.id}
              onClick={() => onRowClick?.(item)}
              className={onRowClick ? "cursor-pointer" : ""}
            >
              {columns.map((col) => (
                <TableCell
                  key={col.key}
                  className={`${col.className || ""} ${
                    col.hide ? `hidden ${col.hide === "sm" ? "sm:table-cell" : col.hide === "md" ? "md:table-cell" : "lg:table-cell"}` : ""
                  }`}
                >
                  {col.render(item)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
