-- Post-install hardening for roles Supabase grants by default.
--
-- Runs last (after every object exists). Safe to re-run.

-- publish_schedule rewrites the whole lessons table; only the publish-schedule
-- Edge Function (service_role) may execute it. Supabase grants EXECUTE to
-- anon/authenticated explicitly, so PUBLIC alone is not enough.
REVOKE ALL ON FUNCTION publish_schedule(jsonb, text, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION publish_schedule(jsonb, text, timestamptz) TO service_role;

-- admin_config holds the PIN hash: never reachable by anon/authenticated,
-- even if a policy is later misconfigured.
REVOKE ALL ON public.admin_config FROM anon, authenticated;

-- app_visits is append/refresh-only from clients; no client ever deletes rows.
REVOKE DELETE ON public.app_visits FROM anon, authenticated;