import { ScrollView, View } from "react-native";
import { useRouter } from "expo-router";
import { SiteHeader } from "@/components/site-header";
import { ValueFoundHero } from "@/components/value-found-hero";
import { OpportunityRow } from "@/components/opportunity-row";
import { Metric } from "@/components/metric";
import { DemoModeBadge } from "@/components/demo-mode-badge";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { DEMO_HOUSEHOLD, DEMO_OPPORTUNITIES } from "@/lib/fixtures";
import { route, type Variant } from "@/lib/nav";

// Ported from uxui/app/opportunities/page.tsx.
//
// Desktop is the `lg:grid-cols-[1fr_320px]` split — list left, summary rail
// right (brief §28). Mobile stacks the hero above the list and keeps one
// dominant action at the bottom (§29, §69).
function HouseholdCard() {
  const rows = [
    ["Location", `${DEMO_HOUSEHOLD.city}, ${DEMO_HOUSEHOLD.provinceState}`],
    ["Utility", DEMO_HOUSEHOLD.utilityProvider ?? "—"],
    ["Heating", DEMO_HOUSEHOLD.primaryHeating.replace("_", " ")],
    ["Homeowner status", DEMO_HOUSEHOLD.tenure === "unknown" ? "Unresolved" : DEMO_HOUSEHOLD.tenure],
  ] as const;

  return (
    <View className="rounded-lg border border-line bg-card p-4">
      <Text className="text-[13px] font-medium text-ink mb-3">Household</Text>
      <View className="gap-2">
        {rows.map(([label, value]) => (
          <View key={label} className="flex-row justify-between">
            <Text className="text-[13px] text-ink-muted">{label}</Text>
            <Text className="text-[13px] text-ink capitalize">{value}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export function OpportunitiesScreen({ variant }: { variant: Variant }) {
  const router = useRouter();
  const wide = variant === "web";
  const pursuable = DEMO_OPPORTUNITIES.filter((o) => o.status !== "not_eligible");
  const total = pursuable.reduce((sum, o) => sum + o.estimatedIncentive, 0);

  return (
    <View className="flex-1 bg-canvas">
      <SiteHeader variant={variant} />

      <ScrollView contentContainerClassName={wide ? "px-6 py-10" : "px-4 py-6 pb-28"}>
        <View className="mx-auto w-full max-w-5xl">
          <View className="flex-row items-center justify-between mb-6">
            <Text className="text-xl font-medium text-ink">Findings</Text>
            <DemoModeBadge />
          </View>

          <View className={wide ? "flex-row gap-6 items-start" : "gap-6"}>
            {/* On mobile the hero comes first; on desktop it sits in the rail. */}
            {!wide && (
              <ValueFoundHero opportunities={DEMO_OPPORTUNITIES} variant={variant} />
            )}

            <View className={`gap-3 ${wide ? "flex-1" : ""}`}>
              {DEMO_OPPORTUNITIES.map((o) => (
                <OpportunityRow key={o.id} opportunity={o} variant={variant} />
              ))}
            </View>

            {wide && (
              <View className="w-[320px] gap-4">
                <ValueFoundHero opportunities={DEMO_OPPORTUNITIES} variant={variant} />
                <HouseholdCard />
                <Metric label="Programs tracked" value={String(DEMO_OPPORTUNITIES.length)} />
              </View>
            )}

            {!wide && <HouseholdCard />}
          </View>
        </View>
      </ScrollView>

      {!wide && (
        <View className="absolute bottom-0 left-0 right-0 border-t border-line bg-canvas px-4 py-3">
          <Button label="Negotiate a plan" size="large" onPress={() => router.push(route(variant, "/plan"))} />
        </View>
      )}
    </View>
  );
}
