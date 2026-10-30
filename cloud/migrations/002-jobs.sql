-- Manual, additive migration. Preserve version 1 and the existing project/Auth schemas.
-- Apply explicitly to an isolated Neon development branch; no PUBLIC access is granted.
BEGIN;
CREATE SCHEMA IF NOT EXISTS atlas_cloud;
CREATE TABLE atlas_cloud.jobs (
  id uuid PRIMARY KEY,
  owner_id text NOT NULL CHECK (length(owner_id) BETWEEN 1 AND 256),
  project_id uuid,
  kind text NOT NULL CHECK (kind IN ('chat_message','workspace_task','security_scan')),
  status text NOT NULL CHECK (status IN ('queued','running','cancel_requested','succeeded','failed','cancelled','interrupted')),
  idempotency_key text NOT NULL CHECK (length(idempotency_key) BETWEEN 1 AND 256),
  payload_ciphertext bytea NOT NULL,
  payload_nonce bytea NOT NULL CHECK (octet_length(payload_nonce)=12),
  payload_auth_tag bytea NOT NULL CHECK (octet_length(payload_auth_tag)=16),
  payload_key_version integer NOT NULL CHECK (payload_key_version > 0),
  result_ciphertext bytea,
  result_nonce bytea,
  result_auth_tag bytea,
  result_key_version integer,
  error_code text CHECK (error_code IS NULL OR length(error_code) BETWEEN 1 AND 80),
  error_message text CHECK (error_message IS NULL OR length(error_message) <= 500),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  available_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  finished_at timestamptz,
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  lease_owner text CHECK (lease_owner IS NULL OR length(lease_owner) BETWEEN 1 AND 128),
  lease_token uuid,
  lease_expires_at timestamptz,
  heartbeat_at timestamptz,
  UNIQUE(owner_id,id),
  UNIQUE(owner_id,idempotency_key),
  FOREIGN KEY(owner_id,project_id) REFERENCES atlas_cloud.projects(owner_id,id),
  CHECK ((result_ciphertext IS NULL AND result_nonce IS NULL AND result_auth_tag IS NULL AND result_key_version IS NULL) OR
         (result_ciphertext IS NOT NULL AND result_nonce IS NOT NULL AND octet_length(result_nonce)=12 AND result_auth_tag IS NOT NULL AND octet_length(result_auth_tag)=16 AND result_key_version > 0))
);
REVOKE ALL ON SCHEMA atlas_cloud FROM PUBLIC;
REVOKE ALL ON TABLE atlas_cloud.jobs FROM PUBLIC;
CREATE INDEX jobs_claim ON atlas_cloud.jobs(available_at,created_at,id) WHERE status='queued';
CREATE INDEX jobs_owner_history ON atlas_cloud.jobs(owner_id,created_at DESC,id);
CREATE INDEX jobs_expired_leases ON atlas_cloud.jobs(lease_expires_at) WHERE status='running';
INSERT INTO atlas_cloud.schema_versions(version) VALUES(2) ON CONFLICT DO NOTHING;
COMMIT;
