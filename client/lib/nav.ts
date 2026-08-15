// Two route trees, one per platform.
//
// `app/index.tsx` sends the visitor to `/web` or `/mobile` based on Platform.OS,
// and each tree gets its own layout. Build brief §27–29 asks for exactly this:
// desktop and mobile are both first-class and must be *designed*, not the same
// layout stacked vertically. Screen logic is shared in components/screens; only
// the arrangement differs.

import type { Href } from "expo-router";

export type Variant = "web" | "mobile";

export const basePath = (variant: Variant) => `/${variant}` as const;

/** Builds a href inside the current platform's tree. */
export function route(variant: Variant, path: string): Href {
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${basePath(variant)}${suffix === "/" ? "" : suffix}` as Href;
}

/** Desktop gets room for a second column; mobile prioritises one action at a time. */
export const isWide = (variant: Variant) => variant === "web";
