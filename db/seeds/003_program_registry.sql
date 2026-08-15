-- Reviewed Ontario program registry for the hackathon demo.
-- Criteria that depend on household, property, account, arrears, or upgrade
-- details stay manual_review until the official source is checked for the case.

BEGIN;

INSERT INTO program_versions
  (program_id, version_key, status, effective_start, reviewed_at)
SELECT p.id, v.version_key, 'current'::program_version_status, v.effective_start::date,
       '2026-08-15T00:00:00Z'::timestamptz
FROM (
  VALUES
    ('oesp', 'current_2026_08_15', '2024-03-01'),
    ('eap', 'current_2026_08_15', NULL),
    ('leap', 'current_2026_08_15', NULL),
    ('home_renovation_savings', 'current_2026_08_15', NULL),
    ('toronto_help', 'current_2026_08_15', NULL)
) AS v(canonical_key, version_key, effective_start)
JOIN programs p ON p.canonical_key = v.canonical_key
ON CONFLICT (program_id, version_key) DO UPDATE
SET status = EXCLUDED.status,
    effective_start = EXCLUDED.effective_start,
    reviewed_at = EXCLUDED.reviewed_at,
    updated_at = now();

WITH registry_versions AS (
  SELECT p.canonical_key, pv.id
  FROM programs p
  JOIN program_versions pv ON pv.program_id = p.id
  WHERE pv.version_key = 'current_2026_08_15'
)
INSERT INTO eligibility_rules
  (program_version_id, rule_key, rule_kind, definition, required, sort_order)
VALUES
  ((SELECT id FROM registry_versions WHERE canonical_key = 'oesp'), 'ontario_jurisdiction', 'jurisdiction',
    '{"fact":"jurisdiction","operator":"equals","value":"CA-ON"}'::jsonb, true, 10),
  ((SELECT id FROM registry_versions WHERE canonical_key = 'oesp'), 'bill_provider_present', 'bill_fact',
    '{"fact":"provider","operator":"present"}'::jsonb, true, 20),
  ((SELECT id FROM registry_versions WHERE canonical_key = 'oesp'), 'income_household_application_review', 'manual_review',
    '{"reason":"OESP eligibility depends on household size, combined after-tax income, electricity account status, and application details; verify against the current OEB table.","sourceUrl":"https://oeb.ca/consumer-information-and-protection/bill-assistance-programs/ontario-electricity-support-program"}'::jsonb, true, 30),
  ((SELECT id FROM registry_versions WHERE canonical_key = 'eap'), 'ontario_jurisdiction', 'jurisdiction',
    '{"fact":"jurisdiction","operator":"equals","value":"CA-ON"}'::jsonb, true, 10),
  ((SELECT id FROM registry_versions WHERE canonical_key = 'eap'), 'bill_provider_present', 'bill_fact',
    '{"fact":"provider","operator":"present"}'::jsonb, true, 20),
  ((SELECT id FROM registry_versions WHERE canonical_key = 'eap'), 'account_income_property_review', 'manual_review',
    '{"reason":"EAP eligibility varies by support level, household income or qualifying benefit, Ontario residence, utility account responsibility, and grid/service territory; verify the current program page.","sourceUrl":"https://saveonenergy.ca/en/For-Your-Home/Energy-Affordability-Program"}'::jsonb, true, 30),
  ((SELECT id FROM registry_versions WHERE canonical_key = 'leap'), 'ontario_jurisdiction', 'jurisdiction',
    '{"fact":"jurisdiction","operator":"equals","value":"CA-ON"}'::jsonb, true, 10),
  ((SELECT id FROM registry_versions WHERE canonical_key = 'leap'), 'bill_provider_present', 'bill_fact',
    '{"fact":"provider","operator":"present"}'::jsonb, true, 20),
  ((SELECT id FROM registry_versions WHERE canonical_key = 'leap'), 'arrears_income_intake_review', 'manual_review',
    '{"reason":"LEAP requires emergency arrears or disconnection risk, household size, income, and intake-agency review; verify current OEB criteria before deciding.","sourceUrl":"https://www.oeb.ca/consumer-information-and-protection/bill-assistance-programs/low-income-energy-assistance-program"}'::jsonb, true, 30),
  ((SELECT id FROM registry_versions WHERE canonical_key = 'home_renovation_savings'), 'ontario_jurisdiction', 'jurisdiction',
    '{"fact":"jurisdiction","operator":"equals","value":"CA-ON"}'::jsonb, true, 10),
  ((SELECT id FROM registry_versions WHERE canonical_key = 'home_renovation_savings'), 'property_upgrade_review', 'manual_review',
    '{"reason":"Home Renovation Savings rebates depend on property, assessment or single-upgrade path, equipment, contractor, and current terms; verify the official program details.","sourceUrl":"https://saveonenergy.ca/en/For-Your-Home/Home-Renovation-Savings"}'::jsonb, true, 20),
  ((SELECT id FROM registry_versions WHERE canonical_key = 'toronto_help'), 'ontario_jurisdiction', 'jurisdiction',
    '{"fact":"jurisdiction","operator":"equals","value":"CA-ON"}'::jsonb, true, 10),
  ((SELECT id FROM registry_versions WHERE canonical_key = 'toronto_help'), 'toronto_property_financing_review', 'manual_review',
    '{"reason":"Toronto HELP eligibility, eligible work, funding amount, property requirements, and loan terms require current City review; never treat financing as savings.","sourceUrl":"https://www.toronto.ca/services-payments/water-environment/environmental-grants-incentives/home-energy-loan-program-help/"}'::jsonb, true, 20)
ON CONFLICT (program_version_id, rule_key) DO UPDATE
SET rule_kind = EXCLUDED.rule_kind,
    definition = EXCLUDED.definition,
    required = EXCLUDED.required,
    sort_order = EXCLUDED.sort_order,
    updated_at = now();

WITH registry_versions AS (
  SELECT p.canonical_key, pv.id
  FROM programs p
  JOIN program_versions pv ON pv.program_id = p.id
  WHERE pv.version_key = 'current_2026_08_15'
)
INSERT INTO benefit_rules
  (program_version_id, rule_key, benefit_type, definition, formula_version)
VALUES
  ((SELECT id FROM registry_versions WHERE canonical_key = 'oesp'), 'monthly_bill_credit', 'credit',
    '{"minimumAmount":35,"maximumAmount":113,"currency":"CAD","cadence":"monthly","certainty":"conditional","contributesToSavings":true,"sourceUrl":"https://oeb.ca/consumer-information-and-protection/bill-assistance-programs/ontario-electricity-support-program"}'::jsonb, 'official_table_2024_03'),
  ((SELECT id FROM registry_versions WHERE canonical_key = 'leap'), 'emergency_assistance_grant', 'grant',
    '{"maximumAmount":780,"currency":"CAD","cadence":"one_time","certainty":"conditional","contributesToSavings":true,"sourceUrl":"https://www.oeb.ca/consumer-information-and-protection/bill-assistance-programs/low-income-energy-assistance-program"}'::jsonb, 'official_cap_current'),
  ((SELECT id FROM registry_versions WHERE canonical_key = 'eap'), 'no_cost_energy_upgrades', 'no_cost_upgrade',
    '{"cadence":"one_time","certainty":"conditional","contributesToSavings":false,"sourceUrl":"https://saveonenergy.ca/en/For-Your-Home/Energy-Affordability-Program"}'::jsonb, 'official_offers_current'),
  ((SELECT id FROM registry_versions WHERE canonical_key = 'home_renovation_savings'), 'eligible_home_rebates', 'rebate',
    '{"cadence":"one_time","certainty":"conditional","contributesToSavings":false,"sourceUrl":"https://saveonenergy.ca/en/For-Your-Home/Home-Renovation-Savings"}'::jsonb, 'official_terms_current'),
  ((SELECT id FROM registry_versions WHERE canonical_key = 'toronto_help'), 'city_loan', 'financing',
    '{"cadence":"one_time","certainty":"conditional","contributesToSavings":false,"sourceUrl":"https://www.toronto.ca/services-payments/water-environment/environmental-grants-incentives/home-energy-loan-program-help/"}'::jsonb, 'official_terms_current')
ON CONFLICT (program_version_id, rule_key) DO UPDATE
SET benefit_type = EXCLUDED.benefit_type,
    definition = EXCLUDED.definition,
    formula_version = EXCLUDED.formula_version,
    updated_at = now();

WITH registry_versions AS (
  SELECT p.canonical_key, pv.id
  FROM programs p
  JOIN program_versions pv ON pv.program_id = p.id
  WHERE pv.version_key = 'current_2026_08_15'
)
INSERT INTO action_routes
  (program_version_id, route_key, route_type, destination, instructions, verified, verified_at, stale_after)
VALUES
  ((SELECT id FROM registry_versions WHERE canonical_key = 'oesp'), 'apply_online', 'official_portal',
    'https://oeb.ca/consumer-information-and-protection/bill-assistance-programs/ontario-electricity-support-program',
    '{"sourceUrl":"https://oeb.ca/consumer-information-and-protection/bill-assistance-programs/ontario-electricity-support-program","steps":["Review the OESP eligibility table and follow the official OESP application link."]}'::jsonb,
    true, '2026-08-15T00:00:00Z'::timestamptz, '2027-08-15T00:00:00Z'::timestamptz),
  ((SELECT id FROM registry_versions WHERE canonical_key = 'oesp'), 'apply_by_mail', 'mail',
    'https://oeb.ca/consumer-information-and-protection/bill-assistance-programs/ontario-electricity-support-program',
    '{"sourceUrl":"https://oeb.ca/consumer-information-and-protection/bill-assistance-programs/ontario-electricity-support-program","steps":["Use the official OESP page mailing instructions and forms."]}'::jsonb,
    true, '2026-08-15T00:00:00Z'::timestamptz, '2027-08-15T00:00:00Z'::timestamptz),
  ((SELECT id FROM registry_versions WHERE canonical_key = 'leap'), 'intake_agency', 'intake_agency',
    'https://www.oeb.ca/consumer-information-and-protection/bill-assistance-programs/low-income-energy-assistance-program',
    '{"sourceUrl":"https://www.oeb.ca/consumer-information-and-protection/bill-assistance-programs/low-income-energy-assistance-program","steps":["Use the OEB list of LEAP intake agencies and confirm emergency-assistance requirements."]}'::jsonb,
    true, '2026-08-15T00:00:00Z'::timestamptz, '2027-08-15T00:00:00Z'::timestamptz),
  ((SELECT id FROM registry_versions WHERE canonical_key = 'eap'), 'apply_online', 'web_form',
    'https://saveonenergy.ca/en/For-Your-Home/Energy-Affordability-Program',
    '{"sourceUrl":"https://saveonenergy.ca/en/For-Your-Home/Energy-Affordability-Program","steps":["Use the official EAP Get started form or phone route."]}'::jsonb,
    true, '2026-08-15T00:00:00Z'::timestamptz, '2027-08-15T00:00:00Z'::timestamptz),
  ((SELECT id FROM registry_versions WHERE canonical_key = 'eap'), 'phone', 'phone',
    'tel:+18447703148',
    '{"sourceUrl":"https://saveonenergy.ca/en/For-Your-Home/Energy-Affordability-Program","phone":"1-844-770-3148","steps":["Call the official EAP number shown on the program page."]}'::jsonb,
    true, '2026-08-15T00:00:00Z'::timestamptz, '2027-08-15T00:00:00Z'::timestamptz),
  ((SELECT id FROM registry_versions WHERE canonical_key = 'home_renovation_savings'), 'official_program_page', 'official_portal',
    'https://saveonenergy.ca/en/For-Your-Home/Home-Renovation-Savings',
    '{"sourceUrl":"https://saveonenergy.ca/en/For-Your-Home/Home-Renovation-Savings","steps":["Review current upgrade terms and follow the official Home Renovation Savings link."]}'::jsonb,
    true, '2026-08-15T00:00:00Z'::timestamptz, '2027-08-15T00:00:00Z'::timestamptz),
  ((SELECT id FROM registry_versions WHERE canonical_key = 'toronto_help'), 'official_program_page', 'official_portal',
    'https://www.toronto.ca/services-payments/water-environment/environmental-grants-incentives/home-energy-loan-program-help/',
    '{"sourceUrl":"https://www.toronto.ca/services-payments/water-environment/environmental-grants-incentives/home-energy-loan-program-help/","steps":["Review the City’s current HELP eligibility and funding offer terms."]}'::jsonb,
    true, '2026-08-15T00:00:00Z'::timestamptz, '2027-08-15T00:00:00Z'::timestamptz)
ON CONFLICT (program_version_id, route_key) DO UPDATE
SET route_type = EXCLUDED.route_type,
    destination = EXCLUDED.destination,
    instructions = EXCLUDED.instructions,
    verified = EXCLUDED.verified,
    verified_at = EXCLUDED.verified_at,
    stale_after = EXCLUDED.stale_after,
    updated_at = now();

COMMIT;
