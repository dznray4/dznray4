import React from "react";
import { cn } from "./utils";

type ProgressProps = React.HTMLAttributes<HTMLDivElement> & {
  value?: number;
};

export const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(function Progress({ className, value = 0, ...props }, ref) {
  const pct = Math.min(100, Math.max(0, value));
  return (
    <div ref={ref} className={cn("relative h-2 w-full overflow-hidden rounded-full bg-zinc-800", className)} {...props}>
      <div className="absolute inset-y-0 left-0 bg-amber-500" style={{ width: `${pct}%` }} />
    </div>
  );
});
