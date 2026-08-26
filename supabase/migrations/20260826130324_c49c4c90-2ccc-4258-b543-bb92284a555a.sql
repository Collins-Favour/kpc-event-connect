-- 1) Internal RLS helper functions must not be callable from the API.
REVOKE EXECUTE ON FUNCTION public.is_space_member(uuid, uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.is_space_super_admin(uuid, uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.is_platform_admin(uuid) FROM anon, authenticated, public;

GRANT EXECUTE ON FUNCTION public.is_space_member(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.is_space_super_admin(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.is_platform_admin(uuid) TO service_role;

-- 2) Credential material must never be readable through the Data API.
DROP POLICY IF EXISTS tokens_member_read ON public.desk_tokens;
DROP POLICY IF EXISTS sessions_member_read ON public.registration_sessions;

REVOKE SELECT ON public.desk_tokens FROM anon, authenticated;
REVOKE SELECT ON public.registration_sessions FROM anon, authenticated;

GRANT ALL ON public.desk_tokens TO service_role;
GRANT ALL ON public.registration_sessions TO service_role;