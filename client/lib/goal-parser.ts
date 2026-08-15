// Brief §25: the user states a goal in natural language, and it is converted to
// structured constraints. "Gemini interprets. TypeScript calculates."
//
// This is the deterministic demo implementation. In live mode the *interpretation*
// moves to a server-side Gemini call with structured output, but the solving below
// stays here — a model must never be the authority on arithmetic (PRD §11).

export interface GoalConstraints {
  objective:
    | "maximize_annual_savings"
    | "maximize_incentive_capture"
    | "minimize_upfront_cost"
    | "maximize_lifetime_value";
  minimumTargetSavings: number | null;
  maxUpfrontCost: number | null;
  comfortReductionAllowed: boolean;
  jurisdiction: string;
  country: string;
}

export const DEFAULT_CONSTRAINTS: GoalConstraints = {
  objective: "maximize_annual_savings",
  minimumTargetSavings: null,
  maxUpfrontCost: null,
  comfortReductionAllowed: false,
  jurisdiction: "ON",
  country: "CA",
};

/** Pulls every dollar figure out of the sentence, in order of appearance. */
function dollarAmounts(text: string): number[] {
  const matches = text.matchAll(/\$\s?([\d,]+(?:\.\d{2})?)/g);
  return [...matches].map((m) => Number(m[1].replace(/,/g, ""))).filter((n) => Number.isFinite(n));
}

export function parseGoal(input: string): GoalConstraints {
  const text = input.toLowerCase();
  const amounts = dollarAmounts(text);

  let objective: GoalConstraints["objective"] = "maximize_annual_savings";
  if (/lowest upfront|least upfront|cheapest|minimal cost|no upfront/.test(text)) {
    objective = "minimize_upfront_cost";
  } else if (/every rebate|all rebates|every incentive|find everything/.test(text)) {
    objective = "maximize_incentive_capture";
  } else if (/long.?term|lifetime|over time|biggest return/.test(text)) {
    objective = "maximize_lifetime_value";
  }

  // "save me $1,000 without spending more than $500 upfront" — the figure tied to
  // spending/upfront is the ceiling, the other is the savings target.
  let maxUpfrontCost: number | null = null;
  let minimumTargetSavings: number | null = null;

  const upfrontMatch = text.match(/(?:spend(?:ing)?|upfront|budget|pay)[^$]{0,24}\$\s?([\d,]+)/);
  if (upfrontMatch) maxUpfrontCost = Number(upfrontMatch[1].replace(/,/g, ""));

  const saveMatch = text.match(/(?:save|saving|savings)[^$]{0,24}\$\s?([\d,]+)/);
  if (saveMatch) minimumTargetSavings = Number(saveMatch[1].replace(/,/g, ""));

  // Fall back to positional reading when the phrasing isn't recognised.
  if (minimumTargetSavings === null && maxUpfrontCost === null && amounts.length > 0) {
    if (objective === "minimize_upfront_cost") maxUpfrontCost = amounts[0];
    else minimumTargetSavings = amounts[0];
  }

  return {
    ...DEFAULT_CONSTRAINTS,
    objective,
    minimumTargetSavings,
    maxUpfrontCost,
    comfortReductionAllowed: !/without (?:losing|reducing) comfort|keep.*comfort/.test(text),
  };
}

export const GOAL_PRESETS = [
  "Save me money",
  "Find every rebate",
  "Lowest upfront cost",
  "Biggest long-term savings",
  "Reduce energy use",
] as const;
