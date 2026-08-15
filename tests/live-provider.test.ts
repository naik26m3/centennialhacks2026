import assert from "node:assert/strict";
import test from "node:test";

import { buildHouseholdProfileFromBills, matchOpportunitiesLive } from "../lib/adapters/live-provider";
import { DEMO_BILL } from "../lib/data/fixtures";

test("returns immediate unconfirmed opportunities when the bill lacks household facts", () => {
  const bill = {
    ...DEMO_BILL,
    serviceAddress: { city: null, provinceState: null, postalCode: null, country: null },
    primaryHeatingHint: "unknown" as const,
  };
  const household = buildHouseholdProfileFromBills([bill]);
  const opportunities = matchOpportunitiesLive([bill], household);

  assert.ok(opportunities.length > 0);
  assert.ok(opportunities.every((opportunity) => opportunity.status !== "ready_to_pursue"));
  assert.ok(
    opportunities.every((opportunity) =>
      opportunity.evidence.some((item) => item.source === "User confirmation required"),
    ),
  );
});
