-- Fix RLS recursion on employees table
-- Purpose: avoid "infinite recursion detected in policy for relation \"employees\""
-- by moving role checks into SECURITY DEFINER functions.

BEGIN;

-- 1) Helper functions (bypass RLS for role checks)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.employees
    WHERE auth_user_id = auth.uid()
      AND role = 'ADMIN'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_site_ps()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.employees
    WHERE auth_user_id = auth.uid()
      AND role IN ('SITE_PS', 'ADMIN')
  );
$$;

-- 2) Enable RLS (if not already)
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

-- 3) Drop old policies that cause recursion
DROP POLICY IF EXISTS "Users can view own employee data" ON public.employees;
DROP POLICY IF EXISTS "Users can update own employee data" ON public.employees;
DROP POLICY IF EXISTS "Admins can view all employee data" ON public.employees;
DROP POLICY IF EXISTS "Admins can update all employee data" ON public.employees;
DROP POLICY IF EXISTS "Site PS can view all employee data" ON public.employees;

-- 4) Recreate policies without recursive subqueries
CREATE POLICY "Users can view own employee data"
ON public.employees
FOR SELECT
USING (auth.uid() = auth_user_id OR public.is_site_ps() OR public.is_admin());

CREATE POLICY "Users can update own employee data"
ON public.employees
FOR UPDATE
USING (auth.uid() = auth_user_id OR public.is_site_ps() OR public.is_admin())
WITH CHECK (auth.uid() = auth_user_id OR public.is_site_ps() OR public.is_admin());

CREATE POLICY "Users can insert own employee data"
ON public.employees
FOR INSERT
WITH CHECK (auth.uid() = auth_user_id);

COMMIT;
