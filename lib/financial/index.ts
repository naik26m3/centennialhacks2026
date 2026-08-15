export type FinancialComponentType =
  | "credit"
  | "grant"
  | "rebate"
  | "operating_estimate"
  | "estimated_savings"
  | "no_cost_upgrade"
  | "financing"
  | "upfront_cost"
  | (string & {});

export type FinancialValueComponent = {
  id?: string;
  type: FinancialComponentType;
  min: number;
  max: number;
  cadence: string;
  certainty: string;
  formulaVersion: string;
  sourceVersion: string;
  contributesToSavings: boolean;
};

export type FinancialValueInput = Omit<FinancialValueComponent, "min" | "max"> & {
  min?: number;
  max?: number;
  /** A fixed value is accepted as shorthand for a zero-width range. */
  amount?: number;
};

export type FinancialRange = { min: number; max: number };

export type FinancialSummary = {
  savings: FinancialRange;
  financing: FinancialRange;
  upfrontCosts: FinancialRange;
  netBenefit: FinancialRange;
  components: FinancialValueComponent[];
};

function finiteAmount(value: number, name: string): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new TypeError(`${name} must be a finite non-negative number.`);
  }
  return value;
}

function normalizeComponent(component: FinancialValueInput): FinancialValueComponent {
  const min = component.min ?? component.amount;
  const max = component.max ?? component.amount;
  if (min === undefined || max === undefined) {
    throw new TypeError("Each financial component needs min/max or amount.");
  }
  const normalizedMin = finiteAmount(min, "min");
  const normalizedMax = finiteAmount(max, "max");
  if (normalizedMin > normalizedMax) {
    throw new RangeError("Financial component min cannot exceed max.");
  }

  return {
    id: component.id,
    type: component.type,
    min: normalizedMin,
    max: normalizedMax,
    cadence: component.cadence,
    certainty: component.certainty,
    formulaVersion: component.formulaVersion,
    sourceVersion: component.sourceVersion,
    contributesToSavings: component.contributesToSavings,
  };
}

function addRange(target: FinancialRange, value: FinancialValueComponent): void {
  target.min += value.min;
  target.max += value.max;
}

/** Aggregate verified value components without turning financing into savings. */
export function calculateFinancialSummary(
  input: readonly FinancialValueInput[],
): FinancialSummary {
  const savings: FinancialRange = { min: 0, max: 0 };
  const financing: FinancialRange = { min: 0, max: 0 };
  const upfrontCosts: FinancialRange = { min: 0, max: 0 };
  const components = input.map(normalizeComponent);

  for (const component of components) {
    if (component.type === "financing") {
      addRange(financing, component);
    } else if (component.type === "upfront_cost") {
      addRange(upfrontCosts, component);
    } else if (component.contributesToSavings) {
      addRange(savings, component);
    }
  }

  return {
    savings,
    financing,
    upfrontCosts,
    netBenefit: {
      min: savings.min - upfrontCosts.max,
      max: savings.max - upfrontCosts.min,
    },
    components,
  };
}
