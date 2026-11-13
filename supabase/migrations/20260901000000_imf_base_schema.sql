-- IMF base schema (tracked as a migration).
--
-- Mirrors the historical supabase-schema.sql so the whole public schema is
-- reproducible from supabase/migrations. Idempotent: safe to re-run on a clean
-- or partially provisioned database.

-- UUID generation: gen_random_uuid() is built into PostgreSQL 13+ (pg_catalog),
-- so it resolves regardless of search_path; pgcrypto is kept as a fallback.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

-- Schedule version table (single row for version tracking)
CREATE TABLE IF NOT EXISTS schedule_version (
  id INTEGER PRIMARY KEY DEFAULT 1,
  version TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  file_name TEXT,
  file_size BIGINT
);

-- Insert initial version row
INSERT INTO schedule_version (id, version, updated_at)
VALUES (1, 'initial', NOW())
ON CONFLICT (id) DO NOTHING;

-- Lessons table - core schedule data
CREATE TABLE IF NOT EXISTS lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sheet_id TEXT NOT NULL,           -- Department/sheet name (e.g., "Лечебное дело")
  day TEXT NOT NULL,                -- Day name in Russian
  day_order INTEGER NOT NULL,       -- 0-6 for sorting (Mon=0)
  time TEXT NOT NULL,               -- Time range "08:30-10:05"
  para TEXT NOT NULL,               -- Pair number "1", "2", etc.
  group_code TEXT NOT NULL,         -- Group code (e.g., "ЛД-11")
  subgroup TEXT,                    -- Subgroup "1", "2", or NULL
  subject TEXT NOT NULL,            -- Subject name
  type TEXT NOT NULL,               -- lecture, practice, lab, exam, consultation
  teacher TEXT,                     -- Teacher name
  room TEXT,                        -- Room number
  is_exam BOOLEAN DEFAULT FALSE,    -- Is this an exam
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_lessons_sheet_day ON lessons(sheet_id, day_order);
CREATE INDEX IF NOT EXISTS idx_lessons_group ON lessons(group_code);
CREATE INDEX IF NOT EXISTS idx_lessons_sheet_group ON lessons(sheet_id, group_code);

-- Admin config table (for PIN hash storage)
CREATE TABLE IF NOT EXISTS admin_config (
  key TEXT PRIMARY KEY,
  pin_hash TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert default admin PIN (6138) - CHANGE THIS IN PRODUCTION!
-- Hash is SHA256('6138' + 'IMF-salt-2026')
INSERT INTO admin_config (key, pin_hash)
VALUES ('admin_pin', '23c35b05b9bb6091daf45d189f3c0ea21aab8c75e086412e0d431e92d7f08a6b')
ON CONFLICT (key) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Role grants
-- ---------------------------------------------------------------------------

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- Students read the schedule; admin_config is never exposed to anon.
GRANT SELECT ON public.lessons TO anon, authenticated;
GRANT SELECT ON public.schedule_version TO anon, authenticated;

GRANT ALL ON public.lessons TO service_role;
GRANT ALL ON public.schedule_version TO service_role;
GRANT ALL ON public.admin_config TO service_role;

-- Defense in depth: Supabase's default privileges grant ALL on new public
-- tables to anon/authenticated. RLS already hides admin_config from them, but
-- removing the table privilege means a future policy mistake cannot expose it.
REVOKE ALL ON public.admin_config FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

ALTER TABLE schedule_version ENABLE ROW LEVEL SECURITY;
ALTER TABLE lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_config ENABLE ROW LEVEL SECURITY;

-- Policies: Allow anon read access to schedule
DROP POLICY IF EXISTS "Allow anon read schedule_version" ON schedule_version;
CREATE POLICY "Allow anon read schedule_version" ON schedule_version
  FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "Allow anon read lessons" ON lessons;
CREATE POLICY "Allow anon read lessons" ON lessons
  FOR SELECT TO anon USING (true);

-- Admin policies (using service role for writes)
DROP POLICY IF EXISTS "Allow service_role all schedule_version" ON schedule_version;
CREATE POLICY "Allow service_role all schedule_version" ON schedule_version
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow service_role all lessons" ON lessons;
CREATE POLICY "Allow service_role all lessons" ON lessons
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow service_role all admin_config" ON admin_config;
CREATE POLICY "Allow service_role all admin_config" ON admin_config
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- Realtime (idempotent: ALTER PUBLICATION has no IF NOT EXISTS)
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'lessons'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE lessons;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'schedule_version'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE schedule_version;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_lessons_updated_at ON lessons;
CREATE TRIGGER update_lessons_updated_at
  BEFORE UPDATE ON lessons
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_schedule_version_updated_at ON schedule_version;
CREATE TRIGGER update_schedule_version_updated_at
  BEFORE UPDATE ON schedule_version
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_admin_config_updated_at ON admin_config;
CREATE TRIGGER update_admin_config_updated_at
  BEFORE UPDATE ON admin_config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Pin search_path: the trigger function touches no tables, so pg_catalog is
-- enough and removes the "mutable search_path" security advisory.
ALTER FUNCTION update_updated_at_column() SET search_path = pg_catalog;