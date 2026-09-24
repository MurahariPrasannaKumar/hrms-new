"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { SearchInput } from "@/components/forms/SearchInput";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { searchApi } from "@/lib/api/resources";
import { useAuth } from "@/lib/auth";

export function GlobalSearch() {
  const { role } = useAuth();
  const [q, setQ] = useState("");
  const [focused, setFocused] = useState(false);
  const term = useDebouncedValue(q.trim(), 300);
  const { data, isFetching, isError } = useQuery({
    queryKey: ["global-search", term, role],
    queryFn: () => searchApi.search(term, role!),
    enabled: term.length >= 2 && !!role,
    retry: false,
  });

  const open = focused && term.length >= 2;
  const close = () => { setFocused(false); setQ(""); };
  return (
    <div className="relative w-full max-w-md" onFocus={() => setFocused(true)} onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setFocused(false); }}>
      <SearchInput value={q} onValueChange={setQ} placeholder="Search students, teachers, notices..." aria-label="Global search" />
      {open && (
        <div aria-label="Search results" className="absolute z-40 mt-2 max-h-96 w-full overflow-y-auto rounded-2xl border bg-popover p-2 shadow-lg">
          {isFetching && <p className="p-3 text-sm text-muted-foreground">Searching...</p>}
          {isError && <p className="p-3 text-sm text-muted-foreground">Search is unavailable right now.</p>}
          {!isFetching && !isError && !data?.length && <p className="p-3 text-sm text-muted-foreground">No results for “{term}”.</p>}
          {data?.map((g) => (
            <div key={g.key} className="py-1">
              <p className="px-3 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{g.label}</p>
              <ul>
                {g.items.map((it) => (
                  <li key={it.id}>
                    <Link href={it.href} onClick={close} className="flex flex-col rounded-lg px-3 py-2 text-sm hover:bg-muted focus-visible:bg-muted focus-visible:outline-none">
                      <span className="font-medium">{it.label}</span>
                      {it.sub && <span className="text-xs text-muted-foreground">{it.sub}</span>}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
