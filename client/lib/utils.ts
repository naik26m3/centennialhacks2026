import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** shadcn's `cn` helper — merges conditional classes, last-wins on conflicts. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Money, no cents. Brief §39: numbers should feel premium, tabular. */
export function money(value: number, currency = "CAD"): string {
  return value.toLocaleString("en-CA", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  });
}

export function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}
