import { Linking, ScrollView, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SiteHeader } from "@/components/site-header";
import { ConfidenceIndicator } from "@/components/confidence-indicator";
import { EvidenceMatrix } from "@/components/evidence-matrix";
import { Metric } from "@/components/metric";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { DEMO_OPPORTUNITIES } from "@/lib/fixtures";
import { route, type Variant } from "@/lib/nav";
import { money } from "@/lib/utils";

// Brief §28 desktop: evidence/economics main, CTA + status in a side rail.
// Brief §30 mobile: value → eligibility → economics → evidence, sticky CTA.
export function OpportunityDetailScreen({ variant }: { variant: Variant }) {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const wide = variant === "web";
  const opportunity = DEMO_OPPORTUNITIES.find((o) => o.id === id);

  if (!opportunity) {
    return (
      <View className="flex-1 bg-canvas">
        <SiteHeader variant={variant} />
        <View className="px-4 py-10 mx-auto w-full max-w-5xl">
          <Text className="text-xl font-medium text-ink">We couldn&apos;t find that opportunity.</Text>
        </View>
      </View>
    );
  }

  const r = opportunity.actionRoute;

  const economics = (
    <View className="rounded-lg border border-line bg-card p-4 gap-2">
      <Text className="text-[13px] font-medium text-ink mb-1">Economics</Text>
      {[
        ["Potential incentive", money(opportunity.estimatedIncentive)],
        ["Estimated upfront cost", money(opportunity.estimatedUpfrontCost)],
        [
          "Estimated annual savings",
          opportunity.estimatedAnnualSavings > 0 ? money(opportunity.estimatedAnnualSavings) : "—",
        ],
        ["Estimated payback", opportunity.estimatedPaybackYears ? `${opportunity.estimatedPaybackYears} years` : "—"],
      ].map(([label, value]) => (
        <View key={label} className="flex-row justify-between">
          <Text className="text-[13px] text-ink-muted">{label}</Text>
          <Text className="text-[13px] text-ink tabular-nums">{value}</Text>
        </View>
      ))}
    </View>
  );

  const actionRail = (
    <View className="gap-4">
      <Metric label="Potential incentive" value={money(opportunity.estimatedIncentive)} tone="success" />
      <View className="rounded-lg border border-line bg-card p-4 gap-2">
        <Text className="text-[13px] font-medium text-ink">Verified next step</Text>
        <Text className="text-[13px] text-ink-soft">{r.administeringOrganization}</Text>
        <Text className="text-[12px] text-ink-muted">{r.departmentOrProgram}</Text>
        <Text className="text-[12px] text-ink-muted">Last verified {r.lastVerifiedAt}</Text>
        {r.applicationUrl && (
          <Text
            className="text-[12px] text-brand mt-1"
            onPress={() => Linking.openURL(r.applicationUrl!)}
          >
            {r.sourceTitle}
          </Text>
        )}
      </View>
      <Button label="Get it for me" size="large" onPress={() => router.push(route(variant, `/agent/${opportunity.id}`))} />
      <Text className="text-[12px] text-ink-muted text-center">
        Nothing is submitted without your approval.
      </Text>
    </View>
  );

  return (
    <View className="flex-1 bg-canvas">
      <SiteHeader variant={variant} />

      <ScrollView contentContainerClassName={wide ? "px-6 py-10" : "px-4 py-6 pb-28"}>
        <View className="mx-auto w-full max-w-5xl">
          <View className="mb-6 gap-2">
            <Text className="text-xl font-medium text-ink">{opportunity.title}</Text>
            <ConfidenceIndicator confidence={opportunity.eligibilityConfidence} />
          </View>

          <View className={wide ? "flex-row gap-6 items-start" : "gap-6"}>
            <View className={`gap-6 ${wide ? "flex-1" : ""}`}>
              <View className="gap-2">
                <Text className="text-[15px] font-medium text-ink">Why we think this may apply</Text>
                <Text className="text-[14px] leading-6 text-ink-soft">{opportunity.reasoningSummary}</Text>
              </View>

              {!wide && economics}

              <View className="gap-2">
                <Text className="text-[15px] font-medium text-ink">Evidence</Text>
                <View className="rounded-lg border border-line bg-card px-4">
                  <EvidenceMatrix evidence={opportunity.evidence} />
                </View>
              </View>

              {opportunity.unresolvedQuestions.length > 0 && (
                <View className="gap-2">
                  <Text className="text-[15px] font-medium text-ink">Still needed from you</Text>
                  {opportunity.unresolvedQuestions.map((q) => (
                    <Text key={q} className="text-[14px] text-warning">
                      · {q}
                    </Text>
                  ))}
                </View>
              )}
            </View>

            {wide && (
              <View className="w-[320px] gap-4">
                {economics}
                {actionRail}
              </View>
            )}

            {!wide && actionRail}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
