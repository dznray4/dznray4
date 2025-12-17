import React from "react";
import { cn } from "./utils";

type BadgeProps = React.HTMLAttributes<HTMLSpanElement>;

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(function Badge({ className, ...props }, ref) {
  return (
    <span
      ref={ref}
      className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold bg-zinc-800 text-white", className)}
      {...props}
    />
  );
});
