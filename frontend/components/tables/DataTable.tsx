"use client";

import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { EmptyState } from "@/components/feedback/EmptyState";
import { ErrorState } from "@/components/feedback/ErrorState";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export interface Column<T> {
  key: string;
  header: string;
  cell?: (row: T) => ReactNode;
  sortable?: boolean;
  className?: string;
}

export interface SortState {
  by: string;
  order: "asc" | "desc";
}

interface Props<T> {
  columns: Column<T>[];
  data?: T[];
  getRowId: (row: T) => string;
  isLoading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  page?: number;
  pageSize?: number;
  total?: number;
  onPageChange?: (page: number) => void;
  sort?: SortState;
  onSortChange?: (s: SortState) => void;
  rowActions?: (row: T) => ReactNode;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
  skeletonRows?: number;
}

export function DataTable<T>({
  columns, data, getRowId, isLoading, error, onRetry, page = 1, pageSize = 20, total = 0, onPageChange,
  sort, onSortChange, rowActions, emptyTitle = "No records found", emptyDescription, emptyAction, skeletonRows = 5,
}: Props<T>) {
  if (error) return <ErrorState error={error} onRetry={onRetry} />;

  const colCount = columns.length + (rowActions ? 1 : 0);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const toggleSort = (key: string) =>
    onSortChange?.({ by: key, order: sort?.by === key && sort.order === "asc" ? "desc" : "asc" });

  return (
    <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((c) => (
                <TableHead key={c.key} className={c.className} aria-sort={sort?.by === c.key ? (sort.order === "asc" ? "ascending" : "descending") : undefined}>
                  {c.sortable && onSortChange ? (
                    <button type="button" onClick={() => toggleSort(c.key)} className="inline-flex items-center gap-1 rounded font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                      {c.header}
                      {sort?.by === c.key && (sort.order === "asc" ? <ArrowUp className="size-3" aria-hidden /> : <ArrowDown className="size-3" aria-hidden />)}
                    </button>
                  ) : (
                    c.header
                  )}
                </TableHead>
              ))}
              {rowActions && <TableHead className="w-12 text-right"><span className="sr-only">Actions</span></TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading &&
              Array.from({ length: skeletonRows }, (_, i) => (
                <TableRow key={`s${i}`} data-testid="skeleton-row">
                  {Array.from({ length: colCount }, (_, j) => (
                    <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>
                  ))}
                </TableRow>
              ))}
            {!isLoading &&
              data?.map((row) => (
                <TableRow key={getRowId(row)}>
                  {columns.map((c) => (
                    <TableCell key={c.key} className={c.className}>
                      {c.cell ? c.cell(row) : String((row as Record<string, unknown>)[c.key] ?? "—")}
                    </TableCell>
                  ))}
                  {rowActions && <TableCell className="text-right">{rowActions(row)}</TableCell>}
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>
      {!isLoading && !data?.length && <EmptyState title={emptyTitle} description={emptyDescription} action={emptyAction} />}
      {onPageChange && total > 0 && (
        <div className="flex items-center justify-between border-t px-4 py-3 text-sm">
          <span className="text-muted-foreground">
            Page {page} of {totalPages} · {total} total
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)} aria-label="Previous page">
              <ChevronLeft className="size-4" />
            </Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)} aria-label="Next page">
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
