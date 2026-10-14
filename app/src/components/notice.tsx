import type { ReactNode } from "react";
import { CircleAlert, CircleCheck, Info, TriangleAlert } from "lucide-react";

const TONES = {
  info: { box: "bg-muted text-foreground", icon: Info },
  success: { box: "bg-success-soft text-success", icon: CircleCheck },
  warning: { box: "bg-warning-soft text-warning", icon: TriangleAlert },
  error: { box: "bg-destructive-soft text-destructive", icon: CircleAlert },
} as const;

/** One status message style for the whole app; errors are announced to screen readers. */
export function Notice({ tone = "info", children, className = "" }: { tone?: keyof typeof TONES; children: ReactNode; className?: string }) {
  const { box, icon: Icon } = TONES[tone];
  return (
    <div role={tone === "error" ? "alert" : undefined} className={`flex gap-2.5 rounded-xl px-3.5 py-3 text-sm ${box} ${className}`}>
      <Icon className="mt-px size-4 shrink-0" aria-hidden />
      <div className="flex min-w-0 flex-1 flex-col gap-1">{children}</div>
    </div>
  );
}
