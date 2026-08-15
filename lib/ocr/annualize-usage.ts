// Deterministic arithmetic on top of the extraction. Gemini never calculates
// (brief §62: "Gemini never invents arithmetic") — it only reports what is
// printed, and this file scales it to a year.

import { AnnualizedUsage, UtilityBillExtraction } from "./schema";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Inclusive day count of a billing period, or null if the dates are unusable. */
export function billingPeriodDays(start: string | null, end: string | null): number | null {
  if (!start || !end) return null;
  const startMs = Date.parse(start);
  const endMs = Date.parse(end);
  if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs < startMs) return null;

  const days = Math.round((endMs - startMs) / DAY_MS) + 1;
  // A residential bill covers a month or a quarter. Anything outside this range
  // means a misread date, and scaling by it would produce a wild annual figure.
  if (days < 7 || days > 200) return null;
  return days;
}

function scale(value: number | null | undefined, days: number): number | null {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  return Math.round((value / days) * 365);
}

// PRD §9.1: dailyUsageKwh = totalUsageKwh / billingDays, then × 365.
export function annualizeUsage(bill: UtilityBillExtraction): AnnualizedUsage {
  const days = billingPeriodDays(bill.billingPeriod.start, bill.billingPeriod.end);
  if (days === null) {
    return {
      billingDays: null,
      dailyElectricityKwh: null,
      annualElectricityKwh: null,
      annualNaturalGasM3: null,
      annualCost: null,
      basis: "insufficient_data",
    };
  }

  const kwh = bill.electricity?.usageKwh;
  return {
    billingDays: days,
    dailyElectricityKwh:
      kwh === null || kwh === undefined ? null : Math.round((kwh / days) * 100) / 100,
    annualElectricityKwh: scale(kwh, days),
    annualNaturalGasM3: scale(bill.naturalGas?.usageM3, days),
    // Current charges would be the truer basis, but bills don't reliably split
    // them out — so this annualizes the total and the UI labels it as such.
    annualCost: scale(bill.currentCharges ?? bill.totalAmount, days),
    basis: "billing_period",
  };
}
