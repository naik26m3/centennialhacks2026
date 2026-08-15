"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useGreenlight } from "@/lib/context/greenlight-context";
import { ValueFoundHero } from "@/components/ValueFoundHero";
import { OpportunityRow } from "@/components/OpportunityRow";
import { DemoModeBadge } from "@/components/DemoModeBadge";
import { objectiveLabel } from "@/lib/experience";

export default function OpportunitiesPage() {
  const router = useRouter();
  const { bills, household, opportunities, objective, hydrated, isLive } = useGreenlight();

  useEffect(() => {
    if (hydrated && (bills.length === 0 || !household)) router.replace("/");
  }, [hydrated, bills, household, router]);

  if (bills.length === 0 || !household) return null;

  return (
    <div className="flex-1 px-4 sm:px-6 py-10">
      <div className="mx-auto max-w-5xl">
        <div className="flex items-center justify-between mb-6">
          <div><h1 className="text-2xl font-semibold tracking-[-0.035em]">Money your home may be missing</h1><p className="mt-1 text-[12px] text-ink-muted">Ranked for: {objectiveLabel(objective)}</p></div>
          <DemoModeBadge live={isLive} />
        </div>

        <div className="grid lg:grid-cols-[1fr_320px] gap-6">
          <div className="flex flex-col gap-6 order-2 lg:order-1">
            <div className="flex flex-col gap-3">
              {opportunities.map((o, index) => (
                <OpportunityRow key={o.id} opportunity={o} recommended={index === 0 && o.status !== "not_eligible"} />
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-4 order-1 lg:order-2">
            <ValueFoundHero opportunities={opportunities} />
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
            <div className="rounded-xl border border-line bg-brand-soft/55 p-4"><p className="text-[12px] font-semibold text-brand">The trust boundary</p><p className="mt-1 text-[12px] leading-relaxed text-ink-soft">AI interprets the bill and program language. Deterministic TypeScript owns eligibility checks, ranking, and every dollar shown.</p></div>
          </div>
        </div>
      </div>
    </div>
  );
}
