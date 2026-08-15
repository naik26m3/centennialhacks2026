import { View } from "react-native";
import { Text } from "@/components/ui/text";

// Ported from uxui/components/Metric.tsx.
export function Metric({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "success" | "warning";
}) {
  const valueColor = tone === "success" ? "text-success" : tone === "warning" ? "text-warning" : "text-ink";
  return (
    <View className="rounded-lg bg-card border border-line p-4">
      <Text className="text-[13px] text-ink-muted mb-1">{label}</Text>
      <Text className={`text-2xl font-medium tabular-nums ${valueColor}`}>{value}</Text>
    </View>
  );
}
