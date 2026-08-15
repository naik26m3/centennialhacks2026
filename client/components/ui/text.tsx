import { Text as RNText, type TextProps } from "react-native";
import { cn } from "@/lib/utils";

type Variant = "display" | "title" | "heading" | "body" | "label" | "caption" | "mono";

const VARIANTS: Record<Variant, string> = {
  // Brief §34: hero numbers must scale — dramatic on desktop, still prominent
  // on a phone without wrapping awkwardly.
  display: "text-5xl font-medium tracking-tight text-ink",
  title: "text-3xl font-medium tracking-tight text-ink",
  heading: "text-lg font-medium text-ink",
  body: "text-[15px] leading-6 text-ink-soft",
  label: "text-[13px] font-medium text-ink",
  caption: "text-[12px] text-ink-muted",
  mono: "text-[13px] text-ink font-mono",
};

export interface GreenlightTextProps extends TextProps {
  variant?: Variant;
  className?: string;
}

export function Text({ variant = "body", className, ...props }: GreenlightTextProps) {
  return <RNText className={cn(VARIANTS[variant], className)} {...props} />;
}
