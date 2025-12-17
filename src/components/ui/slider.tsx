import React from "react";
import { cn } from "./utils";

type SliderProps = {
  value: number[];
  max?: number;
  min?: number;
  step?: number;
  onValueChange?: (value: number[]) => void;
  className?: string;
};

export const Slider: React.FC<SliderProps> = ({ value, max = 100, min = 0, step = 1, onValueChange, className }) => {
  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const next = Number(event.target.value);
    onValueChange?.([next]);
  };

  return (
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value[0]}
      onChange={handleChange}
      className={cn("w-full accent-amber-400", className)}
    />
  );
};
