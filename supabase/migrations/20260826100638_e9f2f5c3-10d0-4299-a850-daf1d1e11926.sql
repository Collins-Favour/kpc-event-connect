-- ============ CLEAN REBUILD: drop legacy single-tenant model ============
DROP TABLE IF EXISTS public.attendees CASCADE;
DROP TABLE IF EXISTS public.registrar_assignments CASCADE;
DROP TABLE IF EXISTS public.registration_desks CASCADE;
DROP TABLE IF EXISTS public.ministries CASCADE;
DROP TABLE IF EXISTS public.sms_logs CASCADE;
DROP TABLE IF EXISTS public.audit_logs CASCADE;
DROP TABLE IF EXISTS public.user_roles CASCADE;
DROP TABLE IF EXISTS public.events CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role) CASCADE;
DROP FUNCTION IF EXISTS public.is_staff(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.assign_registration_number() CASCADE;
DROP SEQUENCE IF EXISTS public.registration_number_seq CASCADE;
DROP TYPE IF EXISTS public.app_role CASCADE;
DROP TYPE IF EXISTS public.attendance_type CASCADE;
DROP TYPE IF EXISTS public.gender_type CASCADE;
DROP TYPE IF EXISTS public.assignment_status CASCADE;
DROP TYPE IF EXISTS public.account_status CASCADE;

-- ============ ENUMS ============
DO $$ BEGIN CREATE TYPE public.space_type AS ENUM ('INDIVIDUAL','ORGANIZATION','TEAM'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.space_status AS ENUM ('ACTIVE','SUSPENDED','ARCHIVED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.space_role AS ENUM ('SPACE_ADMIN','SPACE_SUPER_ADMIN'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.member_status AS ENUM ('ACTIVE','SUSPENDED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.invitation_status AS ENUM ('PENDING','ACCEPTED','EXPIRED','REVOKED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.field_type AS ENUM ('TEXT','NUMBER','EMAIL','PHONE','DATE','SELECT','MULTISELECT','CHECKBOX','RADIO'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.token_status AS ENUM ('ACTIVE','REVOKED','EXPIRED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.session_status AS ENUM ('ACTIVE','ENDED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
-- event_status and entity_status already exist from the previous schema

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  email text,
  phone text,
  avatar_url text,
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    NEW.email,
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ PLATFORM ADMINS ============
CREATE TABLE public.platform_admins (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.platform_admins TO authenticated;
GRANT ALL ON public.platform_admins TO service_role;
ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_platform_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = _user_id);
$$;

CREATE POLICY platform_admins_self ON public.platform_admins FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- ============ SPACES ============
CREATE TABLE public.spaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  space_type public.space_type NOT NULL DEFAULT 'ORGANIZATION',
  category text,
  contact_email text,
  contact_phone text,
  timezone text NOT NULL DEFAULT 'UTC',
  status public.space_status NOT NULL DEFAULT 'ACTIVE',
  logo_url text,
  primary_color text,
  accent_color text,
  description text,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.spaces TO authenticated;
GRANT ALL ON public.spaces TO service_role;
ALTER TABLE public.spaces ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.space_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id uuid NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.space_role NOT NULL DEFAULT 'SPACE_ADMIN',
  status public.member_status NOT NULL DEFAULT 'ACTIVE',
  joined_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (space_id, user_id)
);
GRANT SELECT ON public.space_members TO authenticated;
GRANT ALL ON public.space_members TO service_role;
ALTER TABLE public.space_members ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_space_members_user ON public.space_members(user_id);

-- Tenant isolation helpers
CREATE OR REPLACE FUNCTION public.is_space_member(_space_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.space_members
    WHERE space_id = _space_id AND user_id = _user_id AND status = 'ACTIVE'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_space_super_admin(_space_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.space_members
    WHERE space_id = _space_id AND user_id = _user_id
      AND status = 'ACTIVE' AND role = 'SPACE_SUPER_ADMIN'
  );
$$;

CREATE POLICY spaces_member_read ON public.spaces FOR SELECT TO authenticated
  USING (public.is_space_member(id, auth.uid()) OR public.is_platform_admin(auth.uid()));

CREATE POLICY space_members_read ON public.space_members FOR SELECT TO authenticated
  USING (public.is_space_member(space_id, auth.uid()));

CREATE TABLE public.space_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id uuid NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  email text NOT NULL,
  role public.space_role NOT NULL DEFAULT 'SPACE_ADMIN',
  token_hash text NOT NULL UNIQUE,
  status public.invitation_status NOT NULL DEFAULT 'PENDING',
  invited_by uuid NOT NULL REFERENCES auth.users(id),
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.space_invitations TO authenticated;
GRANT ALL ON public.space_invitations TO service_role;
ALTER TABLE public.space_invitations ENABLE ROW LEVEL SECURITY;
CREATE POLICY invitations_admin_read ON public.space_invitations FOR SELECT TO authenticated
  USING (public.is_space_member(space_id, auth.uid()));
CREATE INDEX idx_invitations_space ON public.space_invitations(space_id, status);

-- ============ EVENTS ============
CREATE TABLE public.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id uuid NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  start_date date,
  end_date date,
  venue text,
  status public.event_status NOT NULL DEFAULT 'ACTIVE',
  registration_prefix text NOT NULL DEFAULT 'EVT',
  registration_counter bigint NOT NULL DEFAULT 0,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.events TO authenticated;
GRANT ALL ON public.events TO service_role;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
CREATE POLICY events_member_read ON public.events FOR SELECT TO authenticated
  USING (public.is_space_member(space_id, auth.uid()));
CREATE INDEX idx_events_space ON public.events(space_id, status);

-- ============ REGISTRATION TEMPLATES ============
CREATE TABLE public.registration_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id uuid NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE UNIQUE,
  name text NOT NULL DEFAULT 'Registration form',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.registration_templates TO authenticated;
GRANT ALL ON public.registration_templates TO service_role;
ALTER TABLE public.registration_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY templates_member_read ON public.registration_templates FOR SELECT TO authenticated
  USING (public.is_space_member(space_id, auth.uid()));

CREATE TABLE public.registration_template_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.registration_templates(id) ON DELETE CASCADE,
  space_id uuid NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  label text NOT NULL,
  field_key text NOT NULL,
  field_type public.field_type NOT NULL DEFAULT 'TEXT',
  required boolean NOT NULL DEFAULT false,
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  help_text text,
  display_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (template_id, field_key)
);
GRANT SELECT ON public.registration_template_fields TO authenticated;
GRANT ALL ON public.registration_template_fields TO service_role;
ALTER TABLE public.registration_template_fields ENABLE ROW LEVEL SECURITY;
CREATE POLICY template_fields_member_read ON public.registration_template_fields FOR SELECT TO authenticated
  USING (public.is_space_member(space_id, auth.uid()));
CREATE INDEX idx_template_fields_template ON public.registration_template_fields(template_id, display_order);

-- ============ DESKS + TOKENS + SESSIONS ============
CREATE TABLE public.registration_desks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id uuid NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text NOT NULL,
  location text,
  status public.entity_status NOT NULL DEFAULT 'ACTIVE',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, code)
);
GRANT SELECT ON public.registration_desks TO authenticated;
GRANT ALL ON public.registration_desks TO service_role;
ALTER TABLE public.registration_desks ENABLE ROW LEVEL SECURITY;
CREATE POLICY desks_member_read ON public.registration_desks FOR SELECT TO authenticated
  USING (public.is_space_member(space_id, auth.uid()));
CREATE INDEX idx_desks_event ON public.registration_desks(event_id, status);

CREATE TABLE public.desk_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id uuid NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  desk_id uuid NOT NULL REFERENCES public.registration_desks(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  token_hint text NOT NULL,
  status public.token_status NOT NULL DEFAULT 'ACTIVE',
  expires_at timestamptz NOT NULL,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.desk_tokens TO authenticated;
GRANT ALL ON public.desk_tokens TO service_role;
ALTER TABLE public.desk_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY tokens_member_read ON public.desk_tokens FOR SELECT TO authenticated
  USING (public.is_space_member(space_id, auth.uid()));
CREATE INDEX idx_tokens_desk ON public.desk_tokens(desk_id, status);

CREATE TABLE public.registration_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id uuid NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  desk_id uuid NOT NULL REFERENCES public.registration_desks(id) ON DELETE CASCADE,
  token_id uuid NOT NULL REFERENCES public.desk_tokens(id) ON DELETE CASCADE,
  secret_hash text NOT NULL UNIQUE,
  status public.session_status NOT NULL DEFAULT 'ACTIVE',
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.registration_sessions TO authenticated;
GRANT ALL ON public.registration_sessions TO service_role;
ALTER TABLE public.registration_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY sessions_member_read ON public.registration_sessions FOR SELECT TO authenticated
  USING (public.is_space_member(space_id, auth.uid()));
CREATE INDEX idx_sessions_event ON public.registration_sessions(event_id, status);

-- ============ REGISTRATIONS ============
CREATE TABLE public.registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_number text NOT NULL,
  space_id uuid NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  desk_id uuid REFERENCES public.registration_desks(id),
  session_id uuid REFERENCES public.registration_sessions(id),
  full_name text NOT NULL,
  phone text,
  email text,
  location text,
  registered_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, registration_number)
);
GRANT SELECT, UPDATE ON public.registrations TO authenticated;
GRANT ALL ON public.registrations TO service_role;
ALTER TABLE public.registrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY registrations_member_read ON public.registrations FOR SELECT TO authenticated
  USING (public.is_space_member(space_id, auth.uid()));
CREATE POLICY registrations_admin_update ON public.registrations FOR UPDATE TO authenticated
  USING (public.is_space_member(space_id, auth.uid()))
  WITH CHECK (public.is_space_member(space_id, auth.uid()));
CREATE INDEX idx_registrations_event_time ON public.registrations(event_id, registered_at DESC);
CREATE INDEX idx_registrations_space ON public.registrations(space_id);
CREATE INDEX idx_registrations_desk ON public.registrations(desk_id);
CREATE INDEX idx_registrations_session ON public.registrations(session_id);
CREATE INDEX idx_registrations_phone ON public.registrations(event_id, phone);

CREATE TABLE public.registration_field_values (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id uuid NOT NULL REFERENCES public.registrations(id) ON DELETE CASCADE,
  field_id uuid NOT NULL REFERENCES public.registration_template_fields(id) ON DELETE CASCADE,
  space_id uuid NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  field_key text NOT NULL,
  value text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (registration_id, field_id)
);
GRANT SELECT ON public.registration_field_values TO authenticated;
GRANT ALL ON public.registration_field_values TO service_role;
ALTER TABLE public.registration_field_values ENABLE ROW LEVEL SECURITY;
CREATE POLICY field_values_member_read ON public.registration_field_values FOR SELECT TO authenticated
  USING (public.is_space_member(space_id, auth.uid()));
CREATE INDEX idx_field_values_registration ON public.registration_field_values(registration_id);

-- Atomic per-event registration number
CREATE OR REPLACE FUNCTION public.assign_registration_number()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  next_val bigint;
  prefix text;
BEGIN
  IF NEW.registration_number IS NULL OR NEW.registration_number = '' THEN
    UPDATE public.events
      SET registration_counter = registration_counter + 1
      WHERE id = NEW.event_id
      RETURNING registration_counter, registration_prefix INTO next_val, prefix;
    NEW.registration_number := COALESCE(prefix,'EVT') || '-' || lpad(next_val::text, 7, '0');
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER registrations_number BEFORE INSERT ON public.registrations
  FOR EACH ROW EXECUTE FUNCTION public.assign_registration_number();

-- ============ AUDIT + SMS LOGS ============
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id uuid REFERENCES public.spaces(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES auth.users(id),
  action text NOT NULL,
  entity_type text,
  entity_id uuid,
  description text,
  ip_address text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY audit_member_read ON public.audit_logs FOR SELECT TO authenticated
  USING (space_id IS NOT NULL AND public.is_space_super_admin(space_id, auth.uid()));
CREATE INDEX idx_audit_space_time ON public.audit_logs(space_id, created_at DESC);

CREATE TABLE public.sms_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id uuid NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  event_id uuid REFERENCES public.events(id) ON DELETE SET NULL,
  recipient text NOT NULL,
  message text NOT NULL,
  provider text NOT NULL DEFAULT 'NONE',
  status text NOT NULL DEFAULT 'PENDING',
  sent_by uuid REFERENCES auth.users(id),
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.sms_logs TO authenticated;
GRANT ALL ON public.sms_logs TO service_role;
ALTER TABLE public.sms_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY sms_member_read ON public.sms_logs FOR SELECT TO authenticated
  USING (public.is_space_member(space_id, auth.uid()));

-- ============ PROFILE POLICIES ============
CREATE POLICY profiles_read ON public.profiles FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.space_members m1
      JOIN public.space_members m2 ON m1.space_id = m2.space_id
      WHERE m1.user_id = auth.uid() AND m2.user_id = public.profiles.id
    )
  );
CREATE POLICY profiles_update_own ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- ============ UPDATED_AT TRIGGERS ============
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER spaces_updated_at BEFORE UPDATE ON public.spaces FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER space_members_updated_at BEFORE UPDATE ON public.space_members FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER invitations_updated_at BEFORE UPDATE ON public.space_invitations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER events_updated_at BEFORE UPDATE ON public.events FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER templates_updated_at BEFORE UPDATE ON public.registration_templates FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER template_fields_updated_at BEFORE UPDATE ON public.registration_template_fields FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER desks_updated_at BEFORE UPDATE ON public.registration_desks FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER tokens_updated_at BEFORE UPDATE ON public.desk_tokens FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER sessions_updated_at BEFORE UPDATE ON public.registration_sessions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER registrations_updated_at BEFORE UPDATE ON public.registrations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();