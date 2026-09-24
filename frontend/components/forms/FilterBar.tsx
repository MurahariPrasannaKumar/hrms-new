import type { ReactNode } from "react";
import { SearchInput } from "./SearchInput";

interface Props {
  search: string;
  onSearchChange: (v: string) => void;
  searchPlaceholder?: string;
  /** Extra filter controls (selects, etc.). */
  children?: ReactNode;
}

export function FilterBar({ search, onSearchChange, searchPlaceholder, children }: Props) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-3">
      <SearchInput value={search} onValueChange={onSearchChange} placeholder={searchPlaceholder} wrapperClassName="w-full sm:w-72" />
      {children}
    </div>
  );
}
