import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toApiError } from "@/lib/api/client";

export function ErrorState({ error, onRetry, title = "Something went wrong" }: { error?: unknown; onRetry?: () => void; title?: string }) {
  const message = error ? toApiError(error).message : "Please try again.";
  return (
    <div role="alert" className="flex flex-col items-center justify-center py-12 text-center">
      <span className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-700">
        <AlertTriangle className="size-6" aria-hidden />
      </span>
      <p className="font-medium">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{message}</p>
      {onRetry && (
        <Button variant="outline" className="mt-4" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}
