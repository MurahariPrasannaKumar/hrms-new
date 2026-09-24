import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/feedback/EmptyState";

export interface ActivityItem {
  id: string;
  title: string;
  description?: string;
  time: string;
}

export function RecentActivity({ items, loading, title = "Recent activity" }: { items?: ActivityItem[]; loading?: boolean; title?: string }) {
  return (
    <section className="rounded-2xl border bg-card p-5 shadow-sm" aria-label={title}>
      <h3 className="mb-4 font-medium">{title}</h3>
      {loading ? (
        <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
      ) : !items?.length ? (
        <EmptyState title="Nothing yet" description="Activity will appear here." compact />
      ) : (
        <ul className="space-y-4">
          {items.map((a) => (
            <li key={a.id} className="flex gap-3">
              <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" aria-hidden />
              <div className="min-w-0">
                <p className="text-sm font-medium">{a.title}</p>
                {a.description && <p className="truncate text-sm text-muted-foreground">{a.description}</p>}
                <time className="text-xs text-muted-foreground">{a.time}</time>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
