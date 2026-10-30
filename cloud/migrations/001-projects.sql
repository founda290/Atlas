-- Manual, additive migration. Run first on an isolated Neon development branch.
-- This schema does not touch neon_auth or the local Atlas metadata tables.
BEGIN;
CREATE SCHEMA IF NOT EXISTS atlas_cloud;
CREATE TABLE IF NOT EXISTS atlas_cloud.schema_versions(version integer PRIMARY KEY, installed_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS atlas_cloud.projects (
 id uuid PRIMARY KEY,
 owner_id text NOT NULL CHECK (length(owner_id) BETWEEN 1 AND 256),
 name text NOT NULL CHECK (length(name) BETWEEN 1 AND 80),
 description text NOT NULL DEFAULT '' CHECK (length(description)<=2000),
 status text NOT NULL CHECK (status IN ('pending','provisioning','ready','stopped','failed','archived')),
 created_at bigint NOT NULL,
 updated_at bigint NOT NULL,
 UNIQUE(owner_id,id)
);
CREATE INDEX IF NOT EXISTS projects_owner_updated ON atlas_cloud.projects(owner_id,updated_at DESC,id);
-- No grants to anonymous/browser roles. Use a dedicated restricted server role.
REVOKE ALL ON SCHEMA atlas_cloud FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA atlas_cloud FROM PUBLIC;
INSERT INTO atlas_cloud.schema_versions(version) VALUES(1) ON CONFLICT DO NOTHING;
COMMIT;
