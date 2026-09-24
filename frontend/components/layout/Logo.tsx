import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={cn("size-9", className)} role="img" aria-label="EduSphere logo">
      <rect width="40" height="40" rx="12" className="fill-primary" />
      <circle cx="20" cy="20" r="7" fill="white" />
      <ellipse cx="20" cy="20" rx="13" ry="5" fill="none" stroke="white" strokeWidth="2" opacity="0.7" transform="rotate(-25 20 20)" />
      <circle cx="31" cy="15" r="2.4" fill="#fbe3d6" />
    </svg>
  );
}

export function Logo({ showText = true, className }: { showText?: boolean; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark />
      {showText && <span className="text-lg font-semibold tracking-tight">EduSphere</span>}
    </span>
  );
}
