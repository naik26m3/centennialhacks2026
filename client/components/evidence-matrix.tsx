import { View } from "react-native";
import { Separator } from "@/components/ui/card";
import { Text } from "@/components/ui/text";
import type { EligibilityEvidence, EvidenceStatus } from "@/lib/types";

// Brief §53 / PRD §2.5: judges should be able to inspect *why* the system thinks
// someone may qualify. Show the criterion, what we observed, and what the
// program expects — not a single opaque score.
const MARK: Record<EvidenceStatus, { glyph: string; className: string }> = {
  pass: { glyph: "✓", className: "text-success" },
  fail: { glyph: "!", className: "text-danger" },
  unknown: { glyph: "?", className: "text-warning" },
  manual_review: { glyph: "◦", className: "text-ink-muted" },
};

export function EvidenceMatrix({ evidence }: { evidence: EligibilityEvidence[] }) {
  return (
    <View>
      {evidence.map((item, index) => {
        const mark = MARK[item.status];
        return (
          <View key={item.criterion}>
            {index > 0 && <Separator />}
            <View className="flex-row gap-3 py-3">
              <Text className={`w-4 text-center font-medium ${mark.className}`}>{mark.glyph}</Text>
              <View className="flex-1 gap-0.5">
                <Text variant="label">{item.criterion}</Text>
                <Text variant="caption">
                  Observed: {item.observedValue} · Expected: {item.expectedValue}
                </Text>
                <Text variant="caption" className="text-ink-muted/80">
                  Source: {item.source}
                </Text>
              </View>
            </View>
          </View>
        );
      })}
    </View>
  );
}
