"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useGreenlight } from "@/lib/context/greenlight-context";
import { ValueFoundHero } from "@/components/ValueFoundHero";
import { OpportunityRow } from "@/components/OpportunityRow";
import { Metric } from "@/components/Metric";
import { DemoModeBadge } from "@/components/DemoModeBadge";

export default function OpportunitiesPage() {
  const router = useRouter();
  const { bills, household, opportunities, hydrated, isLive } = useGreenlight();

  useEffect(() => {
    if (hydrated && (bills.length === 0 || !household)) router.replace("/");
  }, [hydrated, bills, household, router]);

  if (bills.length === 0 || !household) return null;

  const pursuable = opportunities.filter((o) => o.status !== "not_eligible");
  const total = pursuable.reduce((sum, o) => sum + o.estimatedIncentive, 0);

  return (
    <div className="flex-1 px-4 sm:px-6 py-10">
      <div className="mx-auto max-w-5xl">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-medium">Findings</h1>
          <DemoModeBadge live={isLive} />
        </div>

        <div className="grid lg:grid-cols-[1fr_320px] gap-6">
          <div className="flex flex-col gap-6 order-2 lg:order-1">
            <div className="lg:hidden">
              <ValueFoundHero total={total} opportunityCount={pursuable.length} />
            </div>
            <div className="flex flex-col gap-3">
              {opportunities.map((o) => (
                <OpportunityRow key={o.id} opportunity={o} />
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-4 order-1 lg:order-2">
            <div className="hidden lg:block">
              <ValueFoundHero total={total} opportunityCount={pursuable.length} />
            </div>
            <div className="rounded-lg border border-line bg-card p-4">
              <p className="text-[13px] font-medium mb-3">Household</p>
              <dl className="flex flex-col gap-2 text-[13px]">
                <div className="flex justify-between">
                  <dt className="text-ink-muted">Location</dt>
                  <dd>{household.city}, {household.provinceState}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-ink-muted">Utility</dt>
                  <dd>{household.utilityProvider}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-ink-muted">Heating</dt>
                  <dd className="capitalize">{household.primaryHeating.replace("_", " ")}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-ink-muted">Homeowner status</dt>
                  <dd className="capitalize">{household.tenure === "unknown" ? "Unresolved" : household.tenure}</dd>
                </div>
                {isLive && household.annualNaturalGasM3 !== null && (
                  <div className="flex justify-between">
                    <dt className="text-ink-muted">Annual gas usage</dt>
                    <dd>{household.annualNaturalGasM3.toLocaleString("en-CA")} m³</dd>
                  </div>
                )}
                {isLive && household.annualElectricityKwh !== null && (
                  <div className="flex justify-between">
                    <dt className="text-ink-muted">Annual electricity usage</dt>
                    <dd>{household.annualElectricityKwh.toLocaleString("en-CA")} kWh</dd>
                  </div>
                )}
              </dl>
              {isLive && (household.monthsOfDataUsed.electricity > 0 || household.monthsOfDataUsed.naturalGas > 0) && (
                <p className="text-[11px] text-ink-muted mt-3">
                  Annualized from {Math.max(household.monthsOfDataUsed.electricity, household.monthsOfDataUsed.naturalGas)} month
                  {Math.max(household.monthsOfDataUsed.electricity, household.monthsOfDataUsed.naturalGas) === 1 ? "" : "s"} of
                  uploaded bills.
                </p>
              )}
            </div>
            <Metric label="Programs tracked" value={String(opportunities.length)} />
          </div>
        </div>
      </div>
    </div>
  );
}
