-- Greenlight's initial PostgreSQL schema.
-- Program facts are deliberately absent here; load reviewed versions separately.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE case_status AS ENUM (
  'created', 'upload_ready', 'uploaded', 'extracting', 'normalizing',
  'needs_review', 'evaluating', 'retrieving_evidence', 'explaining', 'ready',
  'action_prepared', 'approved', 'failed'
);

CREATE TYPE execution_mode AS ENUM ('live', 'hybrid', 'demo');
CREATE TYPE document_status AS ENUM ('upload_ready', 'uploaded', 'extracting', 'extracted', 'needs_review', 'failed');
CREATE TYPE field_review_status AS ENUM ('pending', 'confirmed', 'corrected', 'needs_review');
CREATE TYPE answer_source AS ENUM ('user', 'ocr', 'derived');
CREATE TYPE program_version_status AS ENUM ('draft', 'reviewed', 'current', 'retired');
CREATE TYPE source_review_status AS ENUM ('pending', 'reviewed', 'rejected');
CREATE TYPE eligibility_status AS ENUM (
  'pass', 'fail', 'unknown', 'manual_review', 'likely_eligible', 'possible_match',
  'ineligible', 'eligible'
);
CREATE TYPE benefit_type AS ENUM (
  'credit', 'grant', 'rebate', 'operating_estimate', 'no_cost_upgrade',
  'financing', 'upfront_cost'
);
CREATE TYPE benefit_cadence AS ENUM ('one_time', 'monthly', 'annual', 'other');
CREATE TYPE value_certainty AS ENUM ('confirmed', 'estimated', 'conditional', 'unknown');
CREATE TYPE route_type AS ENUM (
  'official_portal', 'web_form', 'phone', 'mail', 'intake_agency', 'email',
  'utility_election_form', 'manual_review'
);
CREATE TYPE action_status AS ENUM ('prepared', 'approved', 'cancelled', 'expired');
CREATE TYPE evidence_type AS ENUM ('bill_field', 'source_excerpt');

CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TABLE cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id text NOT NULL CHECK (length(btrim(clerk_user_id)) > 0),
  status case_status NOT NULL DEFAULT 'created',
  execution_mode execution_mode NOT NULL DEFAULT 'live',
  idempotency_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT cases_idempotency_key_not_blank CHECK (idempotency_key IS NULL OR length(btrim(idempotency_key)) > 0),
  CONSTRAINT cases_user_idempotency_key_unique UNIQUE (clerk_user_id, idempotency_key)
);

CREATE TABLE programs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_key text NOT NULL UNIQUE CHECK (canonical_key ~ '^[a-z0-9]+(?:_[a-z0-9]+)*$'),
  display_name text NOT NULL CHECK (length(btrim(display_name)) > 0),
  jurisdiction text NOT NULL DEFAULT 'CA-ON' CHECK (jurisdiction = 'CA-ON'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  object_key text NOT NULL UNIQUE CHECK (length(btrim(object_key)) > 0),
  content_type text NOT NULL CHECK (content_type IN ('image/jpeg', 'image/png', 'application/pdf')),
  byte_size bigint NOT NULL CHECK (byte_size > 0),
  sha256 text NOT NULL CHECK (sha256 ~ '^[a-fA-F0-9]{64}$'),
  status document_status NOT NULL DEFAULT 'upload_ready',
  page_count integer CHECK (page_count IS NULL OR page_count > 0),
  idempotency_key text,
  uploaded_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT documents_idempotency_key_not_blank CHECK (idempotency_key IS NULL OR length(btrim(idempotency_key)) > 0),
  CONSTRAINT documents_expiry_after_creation CHECK (expires_at IS NULL OR expires_at >= created_at),
  CONSTRAINT documents_case_idempotency_key_unique UNIQUE (case_id, idempotency_key),
  CONSTRAINT documents_id_case_unique UNIQUE (id, case_id)
);

CREATE TABLE extracted_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL,
  document_id uuid NOT NULL,
  field_name text NOT NULL CHECK (field_name ~ '^[a-z][a-z0-9_]*$'),
  value jsonb NOT NULL,
  confidence numeric(5, 2) CHECK (confidence IS NULL OR confidence BETWEEN 0 AND 100),
  page_number integer CHECK (page_number IS NULL OR page_number > 0),
  bounding_box jsonb,
  review_status field_review_status NOT NULL DEFAULT 'pending',
  critical boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT extracted_fields_document_case_fk FOREIGN KEY (document_id, case_id)
    REFERENCES documents(id, case_id) ON DELETE CASCADE,
  CONSTRAINT extracted_fields_document_field_unique UNIQUE (document_id, field_name)
);

CREATE TABLE case_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  question_key text NOT NULL CHECK (question_key ~ '^[a-z][a-z0-9_]*$'),
  answer jsonb NOT NULL,
  source answer_source NOT NULL DEFAULT 'user',
  answered_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT case_answers_case_question_unique UNIQUE (case_id, question_key)
);

CREATE TABLE program_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id uuid NOT NULL REFERENCES programs(id) ON DELETE RESTRICT,
  version_key text NOT NULL CHECK (length(btrim(version_key)) > 0),
  status program_version_status NOT NULL DEFAULT 'draft',
  effective_start date,
  effective_end date,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT program_versions_dates_ordered CHECK (effective_end IS NULL OR effective_start IS NULL OR effective_end >= effective_start),
  CONSTRAINT program_versions_program_key_unique UNIQUE (program_id, version_key),
  CONSTRAINT program_versions_id_program_unique UNIQUE (id, program_id)
);

CREATE TABLE eligibility_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_version_id uuid NOT NULL REFERENCES program_versions(id) ON DELETE CASCADE,
  rule_key text NOT NULL CHECK (rule_key ~ '^[a-z][a-z0-9_]*$'),
  rule_kind text NOT NULL CHECK (rule_kind IN ('bill_fact', 'case_answer', 'jurisdiction', 'date', 'manual_review')),
  definition jsonb NOT NULL,
  required boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT eligibility_rules_version_key_unique UNIQUE (program_version_id, rule_key)
);

CREATE TABLE benefit_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_version_id uuid NOT NULL REFERENCES program_versions(id) ON DELETE CASCADE,
  rule_key text NOT NULL CHECK (rule_key ~ '^[a-z][a-z0-9_]*$'),
  benefit_type benefit_type NOT NULL,
  definition jsonb NOT NULL,
  formula_version text NOT NULL CHECK (length(btrim(formula_version)) > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT benefit_rules_version_key_unique UNIQUE (program_version_id, rule_key)
);

CREATE TABLE program_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_version_id uuid NOT NULL,
  authority text NOT NULL CHECK (length(btrim(authority)) > 0),
  source_url text NOT NULL CHECK (source_url ~ '^https://'),
  retrieved_at timestamptz NOT NULL DEFAULT now(),
  content_hash text NOT NULL CHECK (content_hash ~ '^[a-fA-F0-9]{64}$'),
  snapshot_object_key text,
  effective_start date,
  effective_end date,
  review_status source_review_status NOT NULL DEFAULT 'pending',
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT program_sources_version_fk FOREIGN KEY (program_version_id)
    REFERENCES program_versions(id) ON DELETE CASCADE,
  CONSTRAINT program_sources_dates_ordered CHECK (effective_end IS NULL OR effective_start IS NULL OR effective_end >= effective_start),
  CONSTRAINT program_sources_snapshot_key_not_blank CHECK (snapshot_object_key IS NULL OR length(btrim(snapshot_object_key)) > 0),
  CONSTRAINT program_sources_snapshot_unique UNIQUE (program_version_id, source_url, content_hash)
);

CREATE TABLE source_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_source_id uuid NOT NULL REFERENCES program_sources(id) ON DELETE CASCADE,
  ordinal integer NOT NULL CHECK (ordinal >= 0),
  title text,
  excerpt text NOT NULL CHECK (length(btrim(excerpt)) > 0),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT source_chunks_source_ordinal_unique UNIQUE (program_source_id, ordinal)
);

CREATE TABLE action_routes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_version_id uuid NOT NULL REFERENCES program_versions(id) ON DELETE CASCADE,
  route_key text NOT NULL CHECK (route_key ~ '^[a-z][a-z0-9_]*$'),
  route_type route_type NOT NULL,
  destination text,
  instructions jsonb NOT NULL DEFAULT '{}'::jsonb,
  verified boolean NOT NULL DEFAULT false,
  verified_at timestamptz,
  stale_after timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT action_routes_destination_for_non_manual CHECK (route_type = 'manual_review' OR length(btrim(destination)) > 0),
  CONSTRAINT action_routes_staleness_ordered CHECK (stale_after IS NULL OR verified_at IS NULL OR stale_after >= verified_at),
  CONSTRAINT action_routes_version_key_unique UNIQUE (program_version_id, route_key)
);

CREATE TABLE case_program_evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  program_version_id uuid NOT NULL REFERENCES program_versions(id) ON DELETE RESTRICT,
  status eligibility_status NOT NULL,
  confirmed_requirements jsonb NOT NULL DEFAULT '[]'::jsonb,
  missing_requirements jsonb NOT NULL DEFAULT '[]'::jsonb,
  input_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  engine_version text NOT NULL CHECK (length(btrim(engine_version)) > 0),
  evaluated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT case_program_evaluations_case_program_unique UNIQUE (case_id, program_version_id),
  CONSTRAINT case_program_evaluations_id_case_unique UNIQUE (id, case_id)
);

CREATE TABLE value_components (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluation_id uuid NOT NULL REFERENCES case_program_evaluations(id) ON DELETE CASCADE,
  component_key text NOT NULL CHECK (component_key ~ '^[a-z][a-z0-9_]*$'),
  benefit_type benefit_type NOT NULL,
  amount numeric(14, 2),
  currency char(3) NOT NULL DEFAULT 'CAD' CHECK (currency ~ '^[A-Z]{3}$'),
  cadence benefit_cadence,
  minimum_amount numeric(14, 2),
  maximum_amount numeric(14, 2),
  certainty value_certainty NOT NULL,
  contributes_to_savings boolean NOT NULL DEFAULT false,
  formula_version text NOT NULL CHECK (length(btrim(formula_version)) > 0),
  source_version_id uuid REFERENCES program_versions(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT value_components_amounts_nonnegative CHECK (
    (amount IS NULL OR amount >= 0) AND
    (minimum_amount IS NULL OR minimum_amount >= 0) AND
    (maximum_amount IS NULL OR maximum_amount >= 0)
  ),
  CONSTRAINT value_components_range_ordered CHECK (maximum_amount IS NULL OR minimum_amount IS NULL OR maximum_amount >= minimum_amount),
  CONSTRAINT value_components_evaluation_key_unique UNIQUE (evaluation_id, component_key)
);

CREATE TABLE evidence_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  evaluation_id uuid,
  evidence_type evidence_type NOT NULL,
  extracted_field_id uuid REFERENCES extracted_fields(id) ON DELETE SET NULL,
  source_chunk_id uuid REFERENCES source_chunks(id) ON DELETE SET NULL,
  label text NOT NULL CHECK (length(btrim(label)) > 0),
  page_number integer CHECK (page_number IS NULL OR page_number > 0),
  bounding_box jsonb,
  excerpt text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT evidence_items_evaluation_case_fk FOREIGN KEY (evaluation_id, case_id)
    REFERENCES case_program_evaluations(id, case_id) ON DELETE CASCADE,
  CONSTRAINT evidence_items_single_source CHECK (num_nonnulls(extracted_field_id, source_chunk_id) = 1),
  CONSTRAINT evidence_items_type_matches_source CHECK (
    (evidence_type = 'bill_field' AND extracted_field_id IS NOT NULL AND source_chunk_id IS NULL) OR
    (evidence_type = 'source_excerpt' AND source_chunk_id IS NOT NULL AND extracted_field_id IS NULL)
  )
);

CREATE TABLE prepared_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  evaluation_id uuid NOT NULL,
  action_route_id uuid NOT NULL REFERENCES action_routes(id) ON DELETE RESTRICT,
  status action_status NOT NULL DEFAULT 'prepared',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  idempotency_key text,
  approved_at timestamptz,
  approved_by_clerk_user_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT prepared_actions_evaluation_case_fk FOREIGN KEY (evaluation_id, case_id)
    REFERENCES case_program_evaluations(id, case_id) ON DELETE RESTRICT,
  CONSTRAINT prepared_actions_idempotency_key_not_blank CHECK (idempotency_key IS NULL OR length(btrim(idempotency_key)) > 0),
  CONSTRAINT prepared_actions_approval_metadata CHECK (
    (status = 'approved' AND approved_at IS NOT NULL AND approved_by_clerk_user_id IS NOT NULL AND length(btrim(approved_by_clerk_user_id)) > 0) OR
    (status <> 'approved' AND approved_at IS NULL AND approved_by_clerk_user_id IS NULL)
  ),
  CONSTRAINT prepared_actions_case_idempotency_key_unique UNIQUE (case_id, idempotency_key)
);

CREATE TABLE audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid REFERENCES cases(id) ON DELETE SET NULL,
  clerk_user_id text,
  event_type text NOT NULL CHECK (event_type ~ '^[a-z][a-z0-9_.-]*$'),
  entity_type text NOT NULL CHECK (entity_type ~ '^[a-z][a-z0-9_.-]*$'),
  entity_id uuid,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  idempotency_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT audit_events_actor_not_blank CHECK (clerk_user_id IS NULL OR length(btrim(clerk_user_id)) > 0),
  CONSTRAINT audit_events_idempotency_key_not_blank CHECK (idempotency_key IS NULL OR length(btrim(idempotency_key)) > 0),
  CONSTRAINT audit_events_case_actor_required CHECK (case_id IS NULL OR clerk_user_id IS NOT NULL),
  CONSTRAINT audit_events_idempotency_unique UNIQUE (case_id, idempotency_key)
);

CREATE INDEX cases_clerk_user_id_idx ON cases (clerk_user_id);
CREATE INDEX documents_case_id_idx ON documents (case_id);
CREATE INDEX extracted_fields_case_id_idx ON extracted_fields (case_id);
CREATE INDEX case_answers_case_id_idx ON case_answers (case_id);
CREATE INDEX program_versions_current_idx ON program_versions (program_id, effective_start, effective_end)
  WHERE status = 'current';
CREATE INDEX program_sources_version_idx ON program_sources (program_version_id, review_status);
CREATE INDEX source_chunks_search_idx ON source_chunks USING gin (
  to_tsvector('simple', coalesce(title, '') || ' ' || excerpt)
);
CREATE INDEX action_routes_version_verified_idx ON action_routes (program_version_id, verified, stale_after);
CREATE INDEX evaluations_case_id_idx ON case_program_evaluations (case_id);
CREATE INDEX value_components_evaluation_idx ON value_components (evaluation_id);
CREATE INDEX evidence_items_case_id_idx ON evidence_items (case_id);
CREATE INDEX prepared_actions_case_id_idx ON prepared_actions (case_id);
CREATE INDEX audit_events_case_id_created_at_idx ON audit_events (case_id, created_at DESC);

CREATE TRIGGER cases_touch_updated_at BEFORE UPDATE ON cases
FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER programs_touch_updated_at BEFORE UPDATE ON programs
FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER documents_touch_updated_at BEFORE UPDATE ON documents
FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER extracted_fields_touch_updated_at BEFORE UPDATE ON extracted_fields
FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER case_answers_touch_updated_at BEFORE UPDATE ON case_answers
FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER program_versions_touch_updated_at BEFORE UPDATE ON program_versions
FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER eligibility_rules_touch_updated_at BEFORE UPDATE ON eligibility_rules
FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER benefit_rules_touch_updated_at BEFORE UPDATE ON benefit_rules
FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER program_sources_touch_updated_at BEFORE UPDATE ON program_sources
FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER source_chunks_touch_updated_at BEFORE UPDATE ON source_chunks
FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER action_routes_touch_updated_at BEFORE UPDATE ON action_routes
FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER case_program_evaluations_touch_updated_at BEFORE UPDATE ON case_program_evaluations
FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER value_components_touch_updated_at BEFORE UPDATE ON value_components
FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER evidence_items_touch_updated_at BEFORE UPDATE ON evidence_items
FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER prepared_actions_touch_updated_at BEFORE UPDATE ON prepared_actions
FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
