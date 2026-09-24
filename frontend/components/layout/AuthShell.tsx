import type { ReactNode } from "react";
import { Logo } from "./Logo";

export function AuthShell({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-center"><Logo /></div>
        <div className="rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
          <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
          {description && <p className="mt-1 mb-6 text-sm text-muted-foreground">{description}</p>}
          {!description && <div className="mb-6" />}
          {children}
        </div>
      </div>
    </main>
  );
}
