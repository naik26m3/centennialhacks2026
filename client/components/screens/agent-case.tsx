import { useState } from "react";
import { ScrollView, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { DEMO_AGENT_EVENTS, DEMO_OPPORTUNITIES } from "@/lib/fixtures";
import type { Variant } from "@/lib/nav";
import type { AgentEventStatus } from "@/lib/types";

// Brief §13: show observable actions and results, never chain-of-thought.
// Brief §28 desktop: execution timeline left, application state / human input right.
const MARK: Record<AgentEventStatus, { glyph: string; className: string }> = {
  complete: { glyph: "✓", className: "text-success" },
  in_progress: { glyph: "◦", className: "text-ink-muted" },
  needs_human: { glyph: "?", className: "text-warning" },
  blocked: { glyph: "!", className: "text-danger" },
};

export function AgentCaseScreen({ variant }: { variant: Variant }) {
  const { caseId } = useLocalSearchParams<{ caseId: string }>();
  const wide = variant === "web";
  const opportunity = DEMO_OPPORTUNITIES.find((o) => o.id === caseId);
  const [tenure, setTenure] = useState<"owner" | "renter" | null>(null);

  // Brief §23: answering a human question visibly raises confidence, proving the
  // agent does not invent missing context.
  const base = opportunity?.eligibilityConfidence ?? 0.78;
  const confidence = tenure === "owner" ? Math.min(0.99, base + 0.13) : base;

  const groups = DEMO_AGENT_EVENTS.reduce<Record<string, typeof DEMO_AGENT_EVENTS>>((acc, event) => {
    (acc[event.group] ??= []).push(event);
    return acc;
  }, {});

  const humanPanel = (
    <View className="gap-4">
      {tenure === null ? (
        <View className="rounded-lg border border-line bg-card p-4 gap-3">
          <Text className="text-[15px] font-medium text-ink">Do you own or rent this property?</Text>
          <Text className="text-[13px] text-ink-muted">
            This program requires homeowner status. We won&apos;t assume it.
          </Text>
          <View className="flex-row gap-3">
            <Button label="Own" className="flex-1" onPress={() => setTenure("owner")} />
            <Button label="Rent" variant="secondary" className="flex-1" onPress={() => setTenure("renter")} />
          </View>
        </View>
      ) : (
        <View className="rounded-lg border border-line bg-card p-4 gap-1">
          <Text className="text-[13px] font-medium text-success">One requirement resolved</Text>
          <Text className="text-[13px] text-ink-soft tabular-nums">
            Eligibility confidence {Math.round(base * 100)}% → {Math.round(confidence * 100)}%
          </Text>
        </View>
      )}

      <Button label="Review application" size="large" disabled={tenure === null} />
      <Text className="text-[12px] text-ink-muted text-center">
        Nothing is submitted without your approval.
      </Text>
    </View>
  );

  return (
    <View className="flex-1 bg-canvas">
      <SiteHeader variant={variant} />

      <ScrollView contentContainerClassName={wide ? "px-6 py-10" : "px-4 py-6"}>
        <View className="mx-auto w-full max-w-5xl">
          <View className="mb-6 gap-1">
            <Text className="text-xl font-medium text-ink">Preparing your next step</Text>
            <Text className="text-[13px] text-ink-muted">{opportunity?.title ?? "Selected opportunity"}</Text>
          </View>

          <View className={wide ? "flex-row gap-6 items-start" : "gap-6"}>
            <View className={`gap-5 ${wide ? "flex-1" : ""}`}>
              {Object.entries(groups).map(([group, events]) => (
                <View key={group} className="gap-1">
                  <Text className="text-[11px] uppercase tracking-wide text-ink-muted mb-1">{group}</Text>
                  {events.map((event) => {
                    const mark = MARK[event.status];
                    return (
                      <View key={event.id} className="flex-row gap-3 py-1.5">
                        <Text className={`w-4 text-center ${mark.className}`}>{mark.glyph}</Text>
                        <View className="flex-1">
                          <Text className="text-[14px] text-ink">{event.title}</Text>
                          {event.detail && <Text className="text-[12px] text-ink-muted">{event.detail}</Text>}
                        </View>
                      </View>
                    );
                  })}
                </View>
              ))}
            </View>

            <View className={wide ? "w-[320px]" : ""}>{humanPanel}</View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
