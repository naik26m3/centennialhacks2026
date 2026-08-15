"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw, SlidersHorizontal } from "lucide-react";
import { useGreenlight } from "@/lib/context/greenlight-context";
import { parseGoalPrompt, buildNegotiatedPlan } from "@/lib/calculations/constraint-solver";
import { applyTenureScenario, objectiveLabel, rankOpportunities, scenarioDescription } from "@/lib/experience";
import { NegotiatedPlanView } from "@/components/NegotiatedPlanView";
import { OptimizationObjective, ScenarioOverride } from "@/lib/types";

const CHIPS = ["Save me money", "Find every rebate", "Lowest upfront cost", "Reduce energy use"];
const SCENARIOS: Array<{ label: string; value: ScenarioOverride }> = [
  { label: "What if I rent?", value: { tenure: "renter" } },
  { label: "Only $300 upfront", value: { maxUpfrontCost: 300 } },
  { label: "Lowest upfront", value: { objective: "min_upfront" } },
  { label: "Maximum long-term savings", value: { objective: "long_term_savings" } },
];

export default function PlanPage() {
  const router = useRouter();
  const { household, opportunities, goal, objective, scenario, setGoal, setObjective, setScenario, clearScenario, hydrated } = useGreenlight();
  const [input, setInput] = useState(goal?.rawPrompt ?? "");

  useEffect(() => {
    if (hydrated && !household) router.replace("/");
  }, [hydrated, household, router]);

  if (!household) return null;

  const submit = (raw: string) => {
    const parsed = parseGoalPrompt(raw);
    setInput(raw);
    setGoal(parsed);
    setObjective(parsed.objective);
    clearScenario();
  };

  const scenarioObjective: OptimizationObjective = scenario.objective ?? goal?.objective ?? objective ?? "max_value";
  const tenureAdjusted = scenario.tenure ? applyTenureScenario(opportunities, scenario.tenure) : opportunities;
  const scenarioOpportunities = rankOpportunities(tenureAdjusted, scenarioObjective);
  const scenarioGoal = {
    ...(goal ?? parseGoalPrompt("Find the most money")),
    objective: scenarioObjective,
    maxUpfrontCost: scenario.maxUpfrontCost ?? goal?.maxUpfrontCost ?? null,
  };
  const plan = buildNegotiatedPlan(scenarioOpportunities, scenarioGoal);
  const baseline = buildNegotiatedPlan(opportunities, goal);
  const valueDelta = plan.potentialFirstYearValue - baseline.potentialFirstYearValue;
  const readyCount = scenarioOpportunities.filter((item) => item.status === "ready_to_pursue").length;

  return (
    <div className="flex-1 px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-4xl">
        <h1 className="text-3xl font-semibold tracking-[-0.045em]">Make the programs negotiate with your reality.</h1>
        <p className="mb-6 mt-2 max-w-2xl text-[14px] leading-relaxed text-ink-soft">
          Set a constraint or test a different household fact. Greenlight recalculates a separate scenario while preserving the verified record.
        </p>

        <div className="mb-4 flex flex-wrap gap-2">
          {CHIPS.map((chip) => <button key={chip} onClick={() => submit(chip)} className="rounded-full border border-line px-3 py-1.5 text-[13px] hover:border-line-strong hover:bg-card">{chip}</button>)}
        </div>

        <form onSubmit={(event) => { event.preventDefault(); submit(input); }} className="mb-8 flex flex-col gap-2 sm:flex-row">
          <input value={input} onChange={(event) => setInput(event.target.value)} placeholder="Save me $1,000 this year without spending more than $500 upfront." className="min-w-0 flex-1 rounded-lg border border-line bg-card px-3 py-2.5 text-[14px] focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30" />
          <button type="submit" className="rounded-lg bg-ink px-4 py-2.5 text-[14px] font-medium text-white hover:bg-ink/90">Negotiate my plan</button>
        </form>

        <section className="mb-6 rounded-2xl border border-brand/20 bg-brand-soft/45 p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <div><p className="flex items-center gap-2 text-[13px] font-semibold"><SlidersHorizontal size={15} aria-hidden="true" />What-if sandbox</p><p className="mt-1 text-[12px] text-ink-muted">These controls never overwrite your household evidence.</p></div>
            {Object.keys(scenario).length > 0 && <button type="button" onClick={clearScenario} className="flex items-center gap-1.5 rounded-lg border border-line bg-card px-3 py-2 text-[12px] font-medium"><RotateCcw size={13} aria-hidden="true" />Reset</button>}
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {SCENARIOS.map((preset) => {
              const active = JSON.stringify(scenario) === JSON.stringify(preset.value);
              return <button key={preset.label} type="button" aria-pressed={active} onClick={() => setScenario(preset.value)} className={`rounded-xl border px-3 py-3 text-left text-[13px] font-medium transition-colors ${active ? "border-brand bg-brand text-white" : "border-line bg-card hover:border-brand/40"}`}>{preset.label}</button>;
            })}
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-card p-3"><p className="text-[11px] text-ink-muted">Scenario</p><p className="mt-1 text-[13px] font-semibold">{scenarioDescription(scenario)}</p></div>
            <div className="rounded-xl bg-card p-3"><p className="text-[11px] text-ink-muted">Ready to pursue</p><p className="mt-1 text-[13px] font-semibold tabular-nums">{readyCount} program{readyCount === 1 ? "" : "s"}</p></div>
            <div className="rounded-xl bg-card p-3"><p className="text-[11px] text-ink-muted">First-year value change</p><p className={`mt-1 text-[13px] font-semibold tabular-nums ${valueDelta < 0 ? "text-danger" : "text-success"}`}>{valueDelta === 0 ? "No change" : `${valueDelta > 0 ? "+" : "−"}$${Math.abs(valueDelta).toLocaleString("en-CA")}`}</p></div>
          </div>
          <p className="mt-3 text-[12px] leading-relaxed text-ink-soft">Ranking now prioritizes <strong>{objectiveLabel(scenarioObjective).toLowerCase()}</strong>{scenario.tenure ? `. Tenure evidence is temporarily evaluated as ${scenario.tenure}.` : "."}</p>
        </section>

        <p className="mb-3 text-[13px] font-medium">Your negotiated plan</p>
        <NegotiatedPlanView plan={plan} />
      </div>
    </div>
  );
}
