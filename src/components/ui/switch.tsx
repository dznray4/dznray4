import React from "react";
import { cn } from "./utils";

type SwitchProps = {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  className?: string;
};

export const Switch: React.FC<SwitchProps> = ({ checked = false, onCheckedChange, className }) => {
  return (
    <label className={cn("relative inline-flex cursor-pointer items-center", className)}>
      <input
        type="checkbox"
        className="sr-only"
        checked={checked}
        onChange={(e) => onCheckedChange?.(e.target.checked)}
      />
      <div
        className={cn(
          "h-6 w-10 rounded-full bg-zinc-700 transition-colors",
          checked && "bg-emerald-500"
        )}
      >
        <div
          className={cn(
            "absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform",
            checked && "translate-x-4"
          )}
        />
      </div>
    </label>
  );
};
