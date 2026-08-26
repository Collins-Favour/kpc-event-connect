CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.is_space_member(_space_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.space_members
    WHERE space_id = _space_id
      AND user_id = _user_id
      AND status = 'ACTIVE'
  );
$$;

CREATE OR REPLACE FUNCTION private.is_space_super_admin(_space_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.space_members
    WHERE space_id = _space_id
      AND user_id = _user_id
      AND status = 'ACTIVE'
      AND role = 'SPACE_SUPER_ADMIN'
  );
$$;

CREATE OR REPLACE FUNCTION private.is_platform_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.platform_admins WHERE user_id = _user_id
  );
$$;

REVOKE ALL ON FUNCTION private.is_space_member(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.is_space_super_admin(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.is_platform_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.is_space_member(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.is_space_super_admin(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.is_platform_admin(uuid) TO authenticated, service_role;

ALTER POLICY space_members_read ON public.space_members
  USING (private.is_space_member(space_id, auth.uid()));
ALTER POLICY spaces_member_read ON public.spaces
  USING (private.is_space_member(id, auth.uid()) OR private.is_platform_admin(auth.uid()));
ALTER POLICY events_member_read ON public.events
  USING (private.is_space_member(space_id, auth.uid()));
ALTER POLICY desks_member_read ON public.registration_desks
  USING (private.is_space_member(space_id, auth.uid()));
ALTER POLICY field_values_member_read ON public.registration_field_values
  USING (private.is_space_member(space_id, auth.uid()));
ALTER POLICY template_fields_member_read ON public.registration_template_fields
  USING (private.is_space_member(space_id, auth.uid()));
ALTER POLICY templates_member_read ON public.registration_templates
  USING (private.is_space_member(space_id, auth.uid()));
ALTER POLICY registrations_member_read ON public.registrations
  USING (private.is_space_member(space_id, auth.uid()));
ALTER POLICY registrations_admin_update ON public.registrations
  USING (private.is_space_member(space_id, auth.uid()))
  WITH CHECK (private.is_space_member(space_id, auth.uid()));
ALTER POLICY sms_member_read ON public.sms_logs
  USING (private.is_space_member(space_id, auth.uid()));
ALTER POLICY invitations_admin_read ON public.space_invitations
  USING (private.is_space_member(space_id, auth.uid()));
ALTER POLICY audit_member_read ON public.audit_logs
  USING (space_id IS NOT NULL AND private.is_space_super_admin(space_id, auth.uid()));

REVOKE ALL ON FUNCTION public.is_space_member(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_space_super_admin(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_platform_admin(uuid) FROM PUBLIC, anon, authenticated;