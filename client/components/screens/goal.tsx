import { useMemo, useState } from "react";
import { ScrollView, View } from "react-native";
import {
  AssistantRuntimeProvider,
  ComposerPrimitive,
  ThreadPrimitive,
  useLocalRuntime,
  type ChatModelAdapter,
} from "@assistant-ui/react-native";
import { SiteHeader } from "@/components/site-header";
import { Metric } from "@/components/metric";
import { Text } from "@/components/ui/text";
import { DEMO_OPPORTUNITIES } from "@/lib/fixtures";
import { GOAL_PRESETS, parseGoal, type GoalConstraints } from "@/lib/goal-parser";
import type { Variant } from "@/lib/nav";
import { money } from "@/lib/utils";

// Brief §7: a small conversational command field for goals is allowed — a
// chatbot as the *main* interface is not. This is one step inside the flow, and
// its output is a plan rather than a transcript.
//
// Brief §25: the model interprets the sentence; TypeScript solves the constraints.
function solve(constraints: GoalConstraints) {
  const affordable = DEMO_OPPORTUNITIES.filter(
    (o) => constraints.maxUpfrontCost === null || o.estimatedUpfrontCost <= constraints.maxUpfrontCost
  );

  const ranked = [...affordable].sort((a, b) => {
    switch (constraints.objective) {
      case "minimize_upfront_cost":
        return a.estimatedUpfrontCost - b.estimatedUpfrontCost;
      case "maximize_incentive_capture":
        return b.estimatedIncentive - a.estimatedIncentive;
      case "maximize_lifetime_value":
        return (
          b.estimatedAnnualSavings * 10 - b.estimatedUpfrontCost -
          (a.estimatedAnnualSavings * 10 - a.estimatedUpfrontCost)
        );
      default:
        return b.estimatedAnnualSavings - a.estimatedAnnualSavings;
    }
  });

  const upfront = ranked.reduce((s, o) => s + o.estimatedUpfrontCost, 0);
  const incentives = ranked.reduce((s, o) => s + o.estimatedIncentive, 0);
  const savings = ranked.reduce((s, o) => s + o.estimatedAnnualSavings, 0);
  const meetsTarget =
    constraints.minimumTargetSavings === null || incentives + savings >= constraints.minimumTargetSavings;

  return { ranked, upfront, incentives, savings, meetsTarget };
}

export function GoalScreen({ variant }: { variant: Variant }) {
  const wide = variant === "web";
  const [constraints, setConstraints] = useState<GoalConstraints | null>(null);

  const adapter = useMemo<ChatModelAdapter>(
    () => ({
      async run({ messages }) {
        const last = messages[messages.length - 1];
        const text =
          last?.content?.map((p) => (p.type === "text" ? p.text : "")).join(" ").trim() ?? "";

        const parsed = parseGoal(text);
        setConstraints(parsed);
        const result = solve(parsed);

        return {
          content: [
            {
              type: "text" as const,
              text: `Optimizing for ${parsed.objective.replace(/_/g, " ")}. ${result.ranked.length} of ${DEMO_OPPORTUNITIES.length} opportunities fit.`,
            },
          ],
        };
      },
    }),
    []
  );

  const runtime = useLocalRuntime(adapter);
  const result = constraints ? solve(constraints) : null;

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <View className="flex-1 bg-canvas">
        <SiteHeader variant={variant} />

        <ScrollView contentContainerClassName={wide ? "px-6 py-10" : "px-4 py-6"}>
          <View className="mx-auto w-full max-w-5xl gap-5">
            <Text className="text-xl font-medium text-ink">What do you want Greenlight to optimize?</Text>

            <View className="flex-row flex-wrap gap-2">
              {GOAL_PRESETS.map((preset) => (
                <View key={preset} className="rounded-full border border-line bg-card px-3 py-1.5">
                  <Text className="text-[13px] text-ink-soft">{preset}</Text>
                </View>
              ))}
            </View>

            <View className="rounded-lg border border-line bg-card p-4 gap-3">
              <ThreadPrimitive.Root>
                <ThreadPrimitive.Empty>
                  <Text className="text-[13px] text-ink-muted mb-3">
                    Try: “Save me $1,000 this year without spending more than $500 upfront.”
                  </Text>
                </ThreadPrimitive.Empty>

                {/* The transcript stays hidden — the visible answer is the plan below. */}
                <ThreadPrimitive.Messages
                  components={{ UserMessage: () => null, AssistantMessage: () => null }}
                />

                <ComposerPrimitive.Root>
                  <View className="gap-2">
                    <ComposerPrimitive.Input
                      placeholder="Describe your goal…"
                      className="min-h-[44px] border border-line rounded-lg px-4 py-3 bg-canvas text-ink"
                    />
                    <ComposerPrimitive.Send className="flex-row items-center justify-center rounded-lg min-h-[44px] px-5 bg-ink active:opacity-90">
                      <Text className="text-[14px] font-medium text-white">Negotiate</Text>
                    </ComposerPrimitive.Send>
                  </View>
                </ComposerPrimitive.Root>
              </ThreadPrimitive.Root>
            </View>

            {constraints && result && (
              <View className={wide ? "flex-row gap-6 items-start" : "gap-4"}>
                <View className={`gap-3 ${wide ? "flex-1" : ""}`}>
                  <Text className="text-[15px] font-medium text-ink">Negotiated plan</Text>
                  {result.ranked.map((o) => (
                    <View key={o.id} className="rounded-lg border border-line bg-card p-4">
                      <Text className="text-[15px] font-medium text-ink">{o.title}</Text>
                      <Text className="text-[13px] text-ink-soft tabular-nums">
                        {money(o.estimatedIncentive)} potential · {money(o.estimatedUpfrontCost)} upfront
                      </Text>
                    </View>
                  ))}
                  {!result.meetsTarget && (
                    <Text className="text-[13px] text-warning">
                      Does not reach your stated target. Shown as the closest realistic path.
                    </Text>
                  )}
                </View>

                <View className={wide ? "w-[320px] gap-4" : "gap-4"}>
                  <Metric label="Potential incentives" value={money(result.incentives)} tone="success" />
                  <Metric label="Estimated upfront" value={money(result.upfront)} />
                </View>
              </View>
            )}
          </View>
        </ScrollView>
      </View>
    </AssistantRuntimeProvider>
  );
}
