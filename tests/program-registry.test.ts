import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const seedPath = new URL("../db/seeds/003_program_registry.sql", import.meta.url);
const programs = ["eap", "home_renovation_savings", "leap", "oesp", "toronto_help"];

test("program registry seed covers five current official programs safely", async () => {
  const sql = await readFile(seedPath, "utf8");

  const versionKeys = [...sql.matchAll(/\('([a-z][a-z0-9_]*)',\s*'current_2026_08_15'/g)]
    .map((match) => match[1])
    .sort();
  assert.deepEqual(versionKeys, programs);
  assert.match(sql, /status\s*=\s*EXCLUDED\.status/);

  const routeDestinations = [...sql.matchAll(/,\s*'(official_portal|web_form|mail|intake_agency|phone)',\s*\n\s*'([^']+)'/g)]
    .map((match) => ({ type: match[1], destination: match[2] }));
  assert.equal(routeDestinations.length, 7);
  for (const route of routeDestinations) {
    if (route.type === "phone") {
      assert.match(route.destination, /^tel:\+1\d{10}$/);
      continue;
    }
    const parsed = new URL(route.destination);
    assert.equal(parsed.protocol, "https:");
    assert.ok(["oeb.ca", "www.oeb.ca", "saveonenergy.ca", "www.toronto.ca"].includes(parsed.hostname));
  }

  const urls = [...sql.matchAll(/https:\/\/[^\s'"\\,)]+/g)].map((match) => match[0]);
  assert.ok(urls.length > 0);
  for (const url of urls) {
    const parsed = new URL(url);
    assert.equal(parsed.protocol, "https:");
    assert.ok(["oeb.ca", "www.oeb.ca", "saveonenergy.ca", "www.toronto.ca"].includes(parsed.hostname));
  }

  assert.match(sql, /verified,\s*verified_at,\s*stale_after/);
  assert.match(sql, /true,\s*'2026-08-15T00:00:00Z'::timestamptz/);

  const financing = sql.match(/'financing',[\s\S]*?'\{([^']*)\}'::jsonb/);
  assert.ok(financing);
  assert.match(financing[1], /"contributesToSavings":false/);

  assert.match(sql, /BEGIN;/);
  assert.match(sql, /COMMIT;/);
  assert.ok((sql.match(/ON CONFLICT \(/g) ?? []).length >= 4);
});
