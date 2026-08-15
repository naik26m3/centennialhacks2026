// All financial arithmetic lives here, deterministic, never delegated to the model.

import { IncentiveProgram } from "@/lib/types";

export interface OpportunityEconomics {
  estimatedIncentive: number;
  estimatedUpfrontCost: number;
  estimatedAnnualSavings: number;
  estimatedPaybackYears: number | null;
  estimatedCo2ReductionKg: number;
}

// Same formula regardless of whether eligibility came from the deterministic
// demo matcher or a live Gemini assessment — money math never varies by mode.
export function estimateOpportunityEconomics(program: IncentiveProgram): OpportunityEconomics {
  const estimatedIncentive = program.amountMax;
  const estimatedUpfrontCost = program.category === "heat_pump" ? program.amountMax * 1.6 : program.amountMax * 0.15;
  const netCost = netUpfrontCost(estimatedUpfrontCost, estimatedIncentive);
  const estimatedAnnualSavings =
    program.category === "heat_pump" ? 480 : program.category === "insulation" ? 210 : program.category === "thermostat" ? 74 : 0;

  return {
    estimatedIncentive,
    estimatedUpfrontCost: Math.round(estimatedUpfrontCost),
    estimatedAnnualSavings,
    estimatedPaybackYears: paybackYears(netCost, estimatedAnnualSavings),
    estimatedCo2ReductionKg: co2ReductionKgForCategory(program.category),
  };
}

export function netUpfrontCost(grossCost: number, incentive: number): number {
  return Math.max(0, Math.round((grossCost - incentive) * 100) / 100);
}

export function paybackYears(netCost: number, annualSavings: number): number | null {
  if (annualSavings <= 0) return null;
  return Math.round((netCost / annualSavings) * 10) / 10;
}

export function firstYearValue(incentive: number, annualSavings: number): number {
  return Math.round((incentive + annualSavings) * 100) / 100;
}

export function co2ReductionKgForCategory(category: string): number {
  // Rough, clearly-labelled directional estimates for the demo — not a certified
  // emissions model. Order of magnitude only, per household/year.
  const table: Record<string, number> = {
    heat_pump: 1450,
    insulation: 380,
    thermostat: 90,
    assessment: 0,
    financing: 0,
    other: 60,
  };
  return table[category] ?? 60;
}
