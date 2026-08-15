import { Text, View } from "react-native";
import { cn } from "@/lib/utils";

type Tone = "neutral" | "brand" | "success" | "warning" | "danger";

const TONES: Record<Tone, { view: string; label: string }> = {
  neutral: { view: "bg-card border-line", label: "text-ink-soft" },
  brand: { view: "bg-brand-soft border-brand-soft", label: "text-brand" },
  success: { view: "bg-success-soft border-success-soft", label: "text-success" },
  warning: { view: "bg-warning-soft border-warning-soft", label: "text-warning" },
  danger: { view: "bg-danger-soft border-danger-soft", label: "text-danger" },
};

export function Badge({
  label,
  tone = "neutral",
  className,
}: {
  label: string;
  tone?: Tone;
  className?: string;
}) {
  const styles = TONES[tone];
  return (
    <View className={cn("px-2.5 py-1 rounded-full border self-start", styles.view, className)}>
      <Text className={cn("text-[11px] font-medium tracking-wide", styles.label)}>{label}</Text>
    </View>
  );
}
