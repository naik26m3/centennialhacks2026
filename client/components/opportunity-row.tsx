import { useState } from "react";
import { Linking, Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  FileSearch,
  HelpCircle,
} from "lucide-react-native";
import { CinematicReveal } from "@/components/motion/cinematic-reveal";
import { ConfidenceIndicator } from "@/components/confidence-indicator";
import { Text } from "@/components/ui/text";
import { route, type Variant } from "@/lib/nav";
import type { Opportunity } from "@/lib/types";

// Ported from uxui/components/OpportunityRow.tsx (final design).
//
// The card can be interrogated three ways — "Why me?", "Could block?",
// "Evidence" — which is the brief's §64 source transparency made tappable:
// every claim can be traced without leaving the list.
type Interrogation = "why" | "block" | "evidence" | null;

const statusLabel: Record<Opportunity["status"], string> = {
  ready_to_pursue: "Ready to pursue",
  needs_answers: "Needs one answer",
  not_eligible: "Blocked by known facts",
};

const statusTone: Record<Opportunity["status"], { bg: string; text: string }> = {
  ready_to_pursue: { bg: "bg-success-soft", text: "text-success" },
  needs_answers: { bg: "bg-warning-soft", text: "text-warning" },
  not_eligible: { bg: "bg-danger-soft", text: "text-danger" },
};

function TabButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      className={`flex-1 rounded-lg px-2 py-2 items-center ${active ? "bg-brand" : "bg-canvas"}`}
    >
      <Text className={`text-[11px] font-semibold ${active ? "text-white" : "text-ink-soft"}`}>
        {label}
      </Text>
    </Pressable>
  );
}

export function OpportunityRow({
  opportunity,
  variant,
  recommended = false,
}: {
  opportunity: Opportunity;
  variant: Variant;
  recommended?: boolean;
}) {
  const router = useRouter();
  const [active, setActive] = useState<Interrogation>(null);

  const passed = opportunity.evidence.filter((e) => e.status === "pass");
  const unresolved = opportunity.evidence.filter((e) => e.status === "unknown" || e.status === "manual_review");
  const failed = opportunity.evidence.filter((e) => e.status === "fail");
  const tone = statusTone[opportunity.status];
  const r = opportunity.actionRoute;

  const toggle = (next: Exclude<Interrogation, null>) =>
    setActive((current) => (current === next ? null : next));

  return (
    <View
      className={`overflow-hidden rounded-2xl border bg-card ${
        recommended ? "border-brand/45" : "border-line"
      }`}
    >
      <View className="p-4 sm:p-5">
        {recommended && (
          <Text className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-brand">
            Recommended for your objective
          </Text>
        )}

        <Pressable
          accessibilityRole="link"
          onPress={() => router.push(route(variant, `/opportunity/${opportunity.id}`))}
          className="flex-row items-center gap-2"
        >
          <Text className="text-[16px] font-semibold text-ink">{opportunity.title}</Text>
          <ArrowRight size={15} color="#17171a" />
        </Pressable>

        <View className="mt-2 flex-row flex-wrap items-center gap-2.5">
          <Text className="text-[13px] font-semibold text-success tabular-nums">
            Up to ${opportunity.estimatedIncentive.toLocaleString("en-CA")}
          </Text>
          <View className={`rounded-md px-2 py-1 ${tone.bg}`}>
            <Text className={`text-[10px] font-semibold ${tone.text}`}>
              {statusLabel[opportunity.status]}
            </Text>
          </View>
        </View>

        <View className="mt-2">
          <ConfidenceIndicator confidence={opportunity.eligibilityConfidence} />
        </View>

        <View className="mt-4 flex-row gap-1.5 border-t border-line pt-3">
          <TabButton label="Why me?" active={active === "why"} onPress={() => toggle("why")} />
          <TabButton label="Could block?" active={active === "block"} onPress={() => toggle("block")} />
          <TabButton label="Evidence" active={active === "evidence"} onPress={() => toggle("evidence")} />
        </View>
      </View>

      {active && (
        <CinematicReveal className="border-t border-line bg-canvas/60">
          <View className="p-4 sm:p-5">
            {active === "why" && (
              <View>
                <Text className="text-[13px] font-semibold text-ink">Why this matched you</Text>
                <View className="mt-3 gap-2">
                  {passed.map((item) => (
                    <View key={item.criterion} className="flex-row gap-2">
                      <CheckCircle2 size={15} color="#1f7a4d" />
                      <View className="flex-1">
                        <Text className="text-[12px] font-semibold text-ink">{item.criterion}</Text>
                        <Text className="text-[12px] text-ink-muted">Observed: {item.observedValue}</Text>
                      </View>
                    </View>
                  ))}
                  {passed.length === 0 && (
                    <Text className="text-[12px] text-ink-muted">No criteria are confirmed yet.</Text>
                  )}
                </View>
              </View>
            )}

            {active === "block" && (
              <View>
                <Text className="text-[13px] font-semibold text-ink">What could stop this</Text>
                <View className="mt-3 gap-2">
                  {unresolved.map((item) => (
                    <View key={item.criterion} className="flex-row gap-2">
                      <HelpCircle size={15} color="#9c6b0b" />
                      <View className="flex-1">
                        <Text className="text-[12px] font-semibold text-ink">{item.criterion}</Text>
                        <Text className="text-[12px] text-ink-muted">
                          Still unresolved. Required: {item.expectedValue}
                        </Text>
                      </View>
                    </View>
                  ))}
                  {failed.map((item) => (
                    <View key={item.criterion} className="flex-row gap-2">
                      <AlertTriangle size={15} color="#b23a34" />
                      <View className="flex-1">
                        <Text className="text-[12px] font-semibold text-ink">{item.criterion}</Text>
                        <Text className="text-[12px] text-ink-muted">
                          Known mismatch: {item.observedValue}
                        </Text>
                      </View>
                    </View>
                  ))}
                  {unresolved.length === 0 && failed.length === 0 && (
                    <View className="flex-row gap-2">
                      <CheckCircle2 size={15} color="#1f7a4d" />
                      <Text className="text-[12px] text-ink-soft">
                        No known blockers in the available facts.
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            )}

            {active === "evidence" && (
              <View>
                <View className="flex-row items-center gap-2">
                  <FileSearch size={16} color="#1f5c3f" />
                  <Text className="text-[13px] font-semibold text-ink">
                    AI interprets. Evidence decides.
                  </Text>
                </View>
                <Text className="mt-2 text-[12px] leading-relaxed text-ink-soft">
                  {r.sourceTitle ?? "Official program requirements"}
                </Text>
                <Text className="mt-1 text-[11px] text-ink-muted">Verified {r.lastVerifiedAt}</Text>
                {r.applicationUrl && (
                  <Pressable
                    accessibilityRole="link"
                    onPress={() => Linking.openURL(r.applicationUrl!)}
                    className="mt-3 flex-row items-center gap-1.5"
                  >
                    <Text className="text-[12px] font-semibold text-brand">View official source</Text>
                    <ExternalLink size={13} color="#1f5c3f" />
                  </Pressable>
                )}
              </View>
            )}
          </View>
        </CinematicReveal>
      )}
    </View>
  );
}
