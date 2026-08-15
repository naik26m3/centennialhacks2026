// All financial arithmetic lives here, deterministic, never delegated to the model.

import { HouseholdProfile, IncentiveProgram, UtilityBillExtraction } from "@/lib/types";

export interface OpportunityEconomics {
  estimatedIncentive: number;
  estimatedUpfrontCost: number;
  estimatedAnnualSavings: number;
  savingsBasis: "usage_derived" | "category_estimate";
  estimatedPaybackYears: number | null;
  estimatedCo2ReductionKg: number;
}

// Static, demo-mode economics — same formula every time regardless of the
// household, used by the deterministic demo matcher and as the fallback when
// a live household doesn't have enough real usage data for a given category.
export function estimateOpportunityEconomics(program: IncentiveProgram): OpportunityEconomics {
  const estimatedIncentive = program.amountMax;
  const estimatedUpfrontCost = program.category === "heat_pump" ? program.amountMax * 1.6 : program.amountMax * 0.15;
  const netCost = netUpfrontCost(estimatedUpfrontCost, estimatedIncentive);
  const estimatedAnnualSavings = staticAnnualSavingsForCategory(program.category);

  return {
    estimatedIncentive,
    estimatedUpfrontCost: Math.round(estimatedUpfrontCost),
    estimatedAnnualSavings,
    savingsBasis: "category_estimate",
    estimatedPaybackYears: paybackYears(netCost, estimatedAnnualSavings),
    estimatedCo2ReductionKg: co2ReductionKgForCategory(program.category),
  };
}

// Sourced constants for the usage-derived formulas below. Each is chosen
// conservatively (understating heat-pump/insulation/thermostat benefit
// rather than overstating it) since this app leads with dollar figures and
// getting them wrong in the optimistic direction is the worse failure mode.
const NATURAL_GAS_KWH_PER_M3 = 10.75; // standard natural gas energy-content conversion factor
const ASSUMED_FURNACE_AFUE = 0.9; // typical mid-efficiency gas furnace baseline
// Conservative end of the ~2.0–3.5 seasonal COP range cited for cold-climate
// air-source heat pumps in the Greater Toronto Area's winter climate.
const COLD_CLIMATE_HEAT_PUMP_SEASONAL_COP = 2.5;
// Conservative end of NRCan-attributed modeling showing 15–30% annual heating
// cost reduction from attic insulation upgrades.
const INSULATION_SAVINGS_PCT_OF_HEATING_COST = 0.15;
// NRCan-cited figure: a smart thermostat saves about 8% of yearly heating/cooling costs.
const THERMOSTAT_SAVINGS_PCT_OF_HEATING_COST = 0.08;
// OEB Tier 1 residential supply rate (12.0¢/kWh) plus a margin for delivery
// and regulatory charges that a real bill includes — used ONLY as a fallback
// when no electric bill was uploaded to derive a real rate from.
const FALLBACK_ONTARIO_ELECTRICITY_RATE_PER_KWH = 0.17;

export interface FuelUsageAggregate {
  annualUsage: number;
  annualCost: number;
  monthsOfData: number;
}

// Shared by the household-profile builder (lib/adapters/live-provider.ts) and
// the usage-derived savings math below, so both always agree on the same
// annualized usage/cost figures for a given set of uploaded bills.
export function aggregateNaturalGasUsage(bills: UtilityBillExtraction[]): FuelUsageAggregate | null {
  const withGas = bills.filter((b) => b.naturalGas !== null && b.naturalGas.usageM3 !== null);
  if (withGas.length === 0) return null;
  const totalUsage = withGas.reduce((sum, b) => sum + b.naturalGas!.usageM3!, 0);
  const totalCost = withGas.reduce((sum, b) => sum + (b.naturalGas!.cost ?? 0), 0);
  return { annualUsage: (totalUsage / withGas.length) * 12, annualCost: (totalCost / withGas.length) * 12, monthsOfData: withGas.length };
}

export function aggregateElectricityUsage(bills: UtilityBillExtraction[]): FuelUsageAggregate | null {
  const withElectricity = bills.filter((b) => b.electricity !== null && b.electricity.usageKwh !== null);
  if (withElectricity.length === 0) return null;
  const totalUsage = withElectricity.reduce((sum, b) => sum + b.electricity!.usageKwh!, 0);
  const totalCost = withElectricity.reduce((sum, b) => sum + (b.electricity!.cost ?? 0), 0);
  return {
    annualUsage: (totalUsage / withElectricity.length) * 12,
    annualCost: (totalCost / withElectricity.length) * 12,
    monthsOfData: withElectricity.length,
  };
}

// Real math when the household's uploaded bills support it; falls back to the
// static per-category estimate otherwise (electric/oil/propane heating, or
// categories with no usage-derived model at all).
export function estimateOpportunityEconomicsFromUsage(
  program: IncentiveProgram,
  household: HouseholdProfile,
  bills: UtilityBillExtraction[]
): OpportunityEconomics {
  const estimatedIncentive = program.amountMax;
  const estimatedUpfrontCost = program.category === "heat_pump" ? program.amountMax * 1.6 : program.amountMax * 0.15;
  const netCost = netUpfrontCost(estimatedUpfrontCost, estimatedIncentive);

  const usageSavings = estimateUsageDerivedAnnualSavings(program, household, bills);
  const estimatedAnnualSavings = Math.round(usageSavings ?? staticAnnualSavingsForCategory(program.category));

  return {
    estimatedIncentive,
    estimatedUpfrontCost: Math.round(estimatedUpfrontCost),
    estimatedAnnualSavings,
    savingsBasis: usageSavings !== null ? "usage_derived" : "category_estimate",
    estimatedPaybackYears: paybackYears(netCost, estimatedAnnualSavings),
    estimatedCo2ReductionKg: co2ReductionKgForCategory(program.category),
  };
}

function staticAnnualSavingsForCategory(category: IncentiveProgram["category"]): number {
  return category === "heat_pump" ? 480 : category === "insulation" ? 210 : category === "thermostat" ? 74 : 0;
}

function estimateUsageDerivedAnnualSavings(
  program: IncentiveProgram,
  household: HouseholdProfile,
  bills: UtilityBillExtraction[]
): number | null {
  const gas = aggregateNaturalGasUsage(bills);
  const electricity = aggregateElectricityUsage(bills);

  if (program.category === "heat_pump") {
    if (household.primaryHeating !== "natural_gas" || !gas || gas.annualUsage <= 0) return null;
    const annualGasCost = gas.annualCost;
    const gasEnergyKwh = gas.annualUsage * NATURAL_GAS_KWH_PER_M3;
    const heatPumpElectricityKwh = (gasEnergyKwh * ASSUMED_FURNACE_AFUE) / COLD_CLIMATE_HEAT_PUMP_SEASONAL_COP;
    const electricityRatePerKwh =
      electricity && electricity.annualUsage > 0 ? electricity.annualCost / electricity.annualUsage : FALLBACK_ONTARIO_ELECTRICITY_RATE_PER_KWH;
    return Math.max(0, annualGasCost - heatPumpElectricityKwh * electricityRatePerKwh);
  }

  if (program.category === "insulation" || program.category === "thermostat") {
    const pct = program.category === "insulation" ? INSULATION_SAVINGS_PCT_OF_HEATING_COST : THERMOSTAT_SAVINGS_PCT_OF_HEATING_COST;
    const annualHeatingCost =
      household.primaryHeating === "natural_gas" && gas ? gas.annualCost : household.primaryHeating === "electric" && electricity ? electricity.annualCost : null;
    if (annualHeatingCost === null || annualHeatingCost <= 0) return null;
    return annualHeatingCost * pct;
  }

  return null;
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
