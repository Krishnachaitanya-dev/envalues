-- Fix linter warning: RLS enabled with no policies on rate_limits
-- Keep table service-role only by denying authenticated access explicitly

CREATE POLICY "rate_limits_no_select" ON public.rate_limits
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (false);

CREATE POLICY "rate_limits_no_insert" ON public.rate_limits
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (false);

CREATE POLICY "rate_limits_no_update" ON public.rate_limits
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (false);

CREATE POLICY "rate_limits_no_delete" ON public.rate_limits
  AS PERMISSIVE FOR DELETE TO authenticated
  USING (false);