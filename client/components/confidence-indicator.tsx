import { View } from "react-native";
import { Text } from "@/components/ui/text";

// Ported from uxui/components/ConfidenceIndicator.tsx.
// Brief §65 / PRD §2.5: a coarse band plus the number, never fake precision.
export function ConfidenceIndicator({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100);
  const label = pct >= 85 ? "High" : pct >= 55 ? "Medium" : "Low";
  const color = pct >= 85 ? "bg-success" : pct >= 55 ? "bg-warning" : "bg-danger";

  return (
    <View className="flex-row items-center gap-2">
      <View className="w-16 h-1.5 rounded-full bg-line overflow-hidden">
        <View className={`h-full ${color}`} style={{ width: `${pct}%` }} />
      </View>
      <Text className="text-[12px] text-ink-soft">
        {label} · {pct}%
      </Text>
    </View>
  );
}
