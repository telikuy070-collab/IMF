-- Pin function search_path (Supabase security advisor: function_search_path_mutable).
-- Idempotent: safe to re-run.

ALTER FUNCTION public.update_updated_at_column() SET search_path = pg_catalog;
ALTER FUNCTION public.publish_schedule(jsonb, text, timestamptz) SET search_path = public, pg_catalog;