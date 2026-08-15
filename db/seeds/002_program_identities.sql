-- Canonical Ontario program identities only. Load reviewed versions, sources,
-- rules, benefits, and routes through a separate content-review workflow.
INSERT INTO programs (canonical_key, display_name, jurisdiction)
VALUES
  ('oesp', 'Ontario Electricity Support Program', 'CA-ON'),
  ('eap', 'Energy Affordability Program', 'CA-ON'),
  ('leap', 'Low-income Energy Assistance Program', 'CA-ON'),
  ('home_renovation_savings', 'Home Renovation Savings', 'CA-ON'),
  ('toronto_help', 'Home Energy Loan Program (HELP)', 'CA-ON')
ON CONFLICT (canonical_key) DO NOTHING;
