import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/** Styled native select taking <option> children; used by admin filters and forms. */
export function SelectField({ className, ...props }: ComponentProps<"select">) {
  return (
    <select
      className={cn(
        "h-10 rounded-xl border border-input bg-background px-3 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}
