import React from "react";
import { cn } from "./utils";

type CardProps = React.HTMLAttributes<HTMLDivElement>;

type CardContentProps = React.HTMLAttributes<HTMLDivElement>;

export const Card = React.forwardRef<HTMLDivElement, CardProps>(function Card({ className, ...props }, ref) {
  return <div ref={ref} className={cn("rounded-xl border border-zinc-800 bg-zinc-900/60", className)} {...props} />;
});

export const CardContent = React.forwardRef<HTMLDivElement, CardContentProps>(function CardContent({ className, ...props }, ref) {
  return <div ref={ref} className={cn("p-4", className)} {...props} />;
});
