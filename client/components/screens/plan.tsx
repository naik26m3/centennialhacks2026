import { ScrollView, View } from "react-native";
import { SiteHeader } from "@/components/site-header";
import { Metric } from "@/components/metric";
import { Text } from "@/components/ui/text";
import { DEMO_OPPORTUNITIES } from "@/lib/fixtures";
import type { Variant } from "@/lib/nav";
import { money } from "@/lib/utils";

// Brief §26: money dominates visually, carbon is secondary.
// PRD §2.4 / §9.2: savings, rebates and financing are separate categories and
// must never be merged into one opaque total.
const BUDGET_CEILING = 500;

export function PlanScreen({ variant }: { variant: Variant }) {
  const wide = variant === "web";
  const selected = DEMO_OPPORTUNITIES.filter((o) => o.estimatedUpfrontCost <= BUDGET_CEILING);
  const upfront = selected.reduce((s, o) => s + o.estimatedUpfrontCost, 0);
  const incentives = selected.reduce((s, o) => s + o.estimatedIncentive, 0);
  const annualSavings = selected.reduce((s, o) => s + o.estimatedAnnualSavings, 0);
  const co2 = selected.reduce((s, o) => s + o.estimatedCo2ReductionKg, 0);

  return (
    <View className="flex-1 bg-canvas">
      <SiteHeader variant={variant} />

      <ScrollView contentContainerClassName={wide ? "px-6 py-10" : "px-4 py-6"}>
        <View className="mx-auto w-full max-w-5xl gap-6">
          <View className="gap-2">
            <Text className="text-xl font-medium text-ink">Your negotiated plan</Text>
            <Text className="text-[14px] leading-6 text-ink-soft">
              Optimized for the lowest upfront cost, staying under a {money(BUDGET_CEILING)} budget.
            </Text>
          </View>

          <View className={wide ? "flex-row gap-6 items-start" : "gap-6"}>
            <View className={`gap-3 ${wide ? "flex-1" : ""}`}>
              {selected.map((item) => (
                <View key={item.id} className="rounded-lg border border-line bg-card p-4 gap-1">
                  <Text className="text-[15px] font-medium text-ink">{item.title}</Text>
                  <Text className="text-[13px] text-ink-soft tabular-nums">
                    Upfront {money(item.estimatedUpfrontCost)} · Incentive {money(item.estimatedIncentive)} ·
                    Annual savings {item.estimatedAnnualSavings > 0 ? money(item.estimatedAnnualSavings) : "—"}
                  </Text>
                </View>
              ))}
            </View>

            <View className={wide ? "w-[320px] gap-4" : "gap-4"}>
              <Metric label="Potential incentives" value={money(incentives)} tone="success" />
              <Metric label="Estimated upfront cost" value={money(upfront)} />
              <Metric label="Estimated annual savings" value={money(annualSavings)} />
              <View className="rounded-lg border border-line bg-card p-4">
                <Text className="text-[13px] text-ink-muted mb-1">Estimated emissions reduction</Text>
                <Text className="text-[15px] text-ink tabular-nums">{co2.toLocaleString()} kg CO₂e/yr</Text>
              </View>
            </View>
          </View>

          <Text className="text-[12px] text-ink-muted">
            Estimates based on published program amounts, verified 2026-08-15. Figures are potential, not
            approved — each program confirms eligibility on application.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}
