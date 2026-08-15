import { ActivityIndicator, Pressable, Text, type PressableProps } from "react-native";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost";
type Size = "default" | "large";

const BASE =
  // Brief §33: ~44px minimum touch target, and nothing may depend on hover.
  "flex-row items-center justify-center rounded-xl min-h-[44px] px-5 active:opacity-80";

const VARIANTS: Record<Variant, { view: string; label: string }> = {
  primary: { view: "bg-ink", label: "text-white" },
  secondary: { view: "bg-card border border-line", label: "text-ink" },
  ghost: { view: "bg-transparent", label: "text-ink-soft" },
};

const SIZES: Record<Size, string> = {
  default: "min-h-[44px]",
  large: "min-h-[52px] px-6",
};

export interface ButtonProps extends Omit<PressableProps, "children"> {
  label: string;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  className?: string;
}

export function Button({
  label,
  variant = "primary",
  size = "default",
  loading = false,
  disabled,
  className,
  ...props
}: ButtonProps) {
  const styles = VARIANTS[variant];
  const isDisabled = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!isDisabled, busy: loading }}
      disabled={isDisabled}
      className={cn(BASE, SIZES[size], styles.view, isDisabled && "opacity-50", className)}
      {...props}
    >
      {loading ? (
        <ActivityIndicator size="small" color={variant === "primary" ? "#ffffff" : "#17171a"} />
      ) : (
        <Text className={cn("text-[15px] font-medium", styles.label)}>{label}</Text>
      )}
    </Pressable>
  );
}
