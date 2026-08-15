import { View } from "react-native";
import { Text } from "@/components/ui/text";

// Ported from uxui/components/DemoModeBadge.tsx.
// Brief §58: anything not sourced from real official data is marked as sample data.
export function DemoModeBadge({ live = false }: { live?: boolean }) {
  if (live) {
    return (
      <View className="self-start rounded-full border border-brand/40 bg-brand-soft px-2.5 py-1">
        <Text className="text-[11px] uppercase tracking-wide text-brand">Live · analyzed</Text>
      </View>
    );
  }
  return (
    <View className="self-start rounded-full border border-line px-2.5 py-1">
      <Text className="text-[11px] uppercase tracking-wide text-ink-muted">Demo mode · sample household</Text>
    </View>
  );
}
