import React from "react";
import { cn } from "./utils";

type Size = "sm" | "md" | "icon";
type Variant = "primary" | "ghost";

const sizeStyles: Record<Size, string> = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-4 py-2 text-sm",
  icon: "p-2 h-9 w-9 grid place-items-center"
};

const variantStyles: Record<Variant, string> = {
  primary: "bg-amber-500 text-black hover:bg-amber-400",
  ghost: "bg-transparent text-inherit hover:bg-white/10"
};

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  size?: Size;
  variant?: Variant;
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, size = "md", variant = "primary", ...props },
  ref
) {
  return (
    <button
      ref={ref}
      className={cn(
        "rounded-lg border border-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
        sizeStyles[size],
        variantStyles[variant],
        className
      )}
      {...props}
    />
  );
});
