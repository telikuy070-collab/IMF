-- Admin publishing policies (from scripts/fix-rls.sql).
--
-- IMPORTANT / security note:
--   The current admin UI publishes by writing straight to PostgREST with the
--   browser anon key; the only gate is the PIN check in the `verify-pin` Edge
--   Function (client-side state). These policies/grants are therefore required
--   for the app to work as shipped. They let anyone holding the anon key write
--   the schedule, so the anon key must be treated as public.
--
--   Hardening path (needs code changes in
--   src/infrastructure/supabase/repository.ts to call the `publish-schedule`
--   Edge Function instead of PostgREST): drop these policies and keep only the
--   anon SELECT grants from the base migration.

DROP POLICY IF EXISTS "Allow anon write lessons" ON public.lessons;
CREATE POLICY "Allow anon write lessons"
  ON public.lessons FOR INSERT TO anon WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon update lessons" ON public.lessons;
CREATE POLICY "Allow anon update lessons"
  ON public.lessons FOR UPDATE TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon delete lessons" ON public.lessons;
CREATE POLICY "Allow anon delete lessons"
  ON public.lessons FOR DELETE TO anon USING (true);

DROP POLICY IF EXISTS "Allow anon write schedule_version" ON public.schedule_version;
CREATE POLICY "Allow anon write schedule_version"
  ON public.schedule_version FOR ALL TO anon USING (true) WITH CHECK (true);

GRANT INSERT, UPDATE, DELETE ON public.lessons TO anon;
GRANT ALL ON public.schedule_version TO anon;