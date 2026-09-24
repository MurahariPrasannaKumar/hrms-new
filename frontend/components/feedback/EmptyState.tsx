import { Inbox } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function EmptyState({ title, description, action, compact }: { title: string; description?: string; action?: ReactNode; compact?: boolean }) {
  return (
    <div role="status" className={cn("flex flex-col items-center justify-center text-center", compact ? "py-6" : "py-16")}>
      <span className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
        <Inbox className="size-6" aria-hidden />
      </span>
      <p className="font-medium">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
