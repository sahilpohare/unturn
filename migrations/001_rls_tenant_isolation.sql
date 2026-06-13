-- ──────────────────────────────────────────────────────────────────────────
-- Tenant isolation via Row-Level Security on Mastra memory tables
--
-- Strategy:
--   • Add tenant_id to mastra_threads and mastra_messages
--   • Enable RLS; create policies that compare tenant_id against
--     the session variable app.tenant_id (set per-request at the pool level)
--   • The app role (your DB user) must NOT be a superuser — superusers
--     bypass RLS. Create a dedicated app role if needed.
-- ──────────────────────────────────────────────────────────────────────────

-- 1. Add tenant_id columns (nullable for existing rows; backfill as needed)
ALTER TABLE mastra_threads  ADD COLUMN IF NOT EXISTS tenant_id TEXT;
ALTER TABLE mastra_messages ADD COLUMN IF NOT EXISTS tenant_id TEXT;

-- 2. Index for query performance
CREATE INDEX IF NOT EXISTS mastra_threads_tenant_id_idx  ON mastra_threads  (tenant_id);
CREATE INDEX IF NOT EXISTS mastra_messages_tenant_id_idx ON mastra_messages (tenant_id);

-- 3. Enable RLS
ALTER TABLE mastra_threads  ENABLE ROW LEVEL SECURITY;
ALTER TABLE mastra_messages ENABLE ROW LEVEL SECURITY;

-- 4. Drop existing policies if re-running
DROP POLICY IF EXISTS tenant_isolation ON mastra_threads;
DROP POLICY IF EXISTS tenant_isolation ON mastra_messages;

-- 5. Policies — current_setting returns '' when unset; NULL tenant rows are
--    inaccessible unless the setting matches (safe default-deny).
CREATE POLICY tenant_isolation ON mastra_threads
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

CREATE POLICY tenant_isolation ON mastra_messages
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

-- 6. Force RLS even for the table owner (app role)
ALTER TABLE mastra_threads  FORCE ROW LEVEL SECURITY;
ALTER TABLE mastra_messages FORCE ROW LEVEL SECURITY;
