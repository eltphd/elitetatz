-- 013 — Drop PostGIS, which nothing uses (Oct 17 2026).
-- Applied to production (elitetatz, twyrxtzjictiysxqjmhu) on 2026-10-17 via the Supabase MCP.
--
-- The extension put spatial_ref_sys in public with RLS off and write grants to anon and
-- authenticated. The table is owned by supabase_admin, so enabling RLS on it fails with
-- "must be owner of table spatial_ref_sys". No column has a geometry or geography type and
-- no code calls ST_ functions, so the extension goes instead; schema.sql no longer creates it.
drop extension if exists postgis;
