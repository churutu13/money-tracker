import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Badge({
  className,
  tone = "neutral",
  ...props
}: HTMLAttributes<HTMLSpanElement> & {
  tone?: "neutral" | "positive" | "danger" | "warning" | "info";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold",
        tone === "neutral" && "bg-muted text-muted-foreground",
        tone === "positive" && "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
        tone === "danger" && "bg-red-500/10 text-red-700 dark:text-red-400",
        tone === "warning" && "bg-amber-500/12 text-amber-700 dark:text-amber-400",
        tone === "info" && "bg-blue-500/10 text-blue-700 dark:text-blue-400",
        className
      )}
      {...props}
    />
  );
}
