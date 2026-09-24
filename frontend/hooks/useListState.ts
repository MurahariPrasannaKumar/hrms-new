"use client";

import { useMemo, useState } from "react";
import type { SortState } from "@/components/tables/DataTable";
import type { ListParams } from "@/lib/api/client";
import { useDebouncedValue } from "./useDebouncedValue";

/** Page/search/sort/filter state for server-driven tables. Any filter change resets to page 1. */
export function useListState(initialSort?: SortState, pageSize = 10) {
  const [page, setPage] = useState(1);
  const [search, setSearchRaw] = useState("");
  const [sort, setSortRaw] = useState<SortState | undefined>(initialSort);
  const [filters, setFiltersRaw] = useState<Record<string, string>>({});
  const debounced = useDebouncedValue(search);

  const params = useMemo<ListParams>(
    () => ({ page, pageSize, search: debounced || undefined, sortBy: sort?.by, sortOrder: sort?.order, ...filters }),
    [page, pageSize, debounced, sort, filters],
  );

  return {
    params,
    page,
    pageSize,
    search,
    sort,
    filters,
    setPage,
    setSearch: (v: string) => {
      setSearchRaw(v);
      setPage(1);
    },
    setSort: (s: SortState) => {
      setSortRaw(s);
      setPage(1);
    },
    setFilter: (key: string, value: string) => {
      setFiltersRaw((f) => ({ ...f, [key]: value }));
      setPage(1);
    },
  };
}
