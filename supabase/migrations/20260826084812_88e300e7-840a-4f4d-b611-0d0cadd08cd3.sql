-- Enums
CREATE TYPE public.app_role AS ENUM ('REGISTRAR', 'ADMIN', 'SUPER_ADMIN');
CREATE TYPE public.account_status AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED', 'DISABLED');
CREATE TYPE public.entity_status AS ENUM ('ACTIVE', 'INACTIVE');
CREATE TYPE public.event_status AS ENUM ('DRAFT', 'ACTIVE', 'COMPLETED', 'CANCELLED');
CREATE TYPE public.assignment_status AS ENUM ('ACTIVE', 'ENDED');
CREATE TYPE public.attendance_type AS ENUM ('HOME', 'GUEST');
CREATE TYPE public.gender_type AS ENUM ('male', 'female');

-- Shared updated_at trigger fn
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  email TEXT,
  phone TEXT,
  status public.account_status NOT NULL DEFAULT 'PENDING',
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- User roles
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.is_staff(_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('ADMIN','SUPER_ADMIN'));
$$;

CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "user_roles_select" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_staff(auth.uid()));

-- Auto profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, phone)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', ''), NEW.email, NEW.raw_user_meta_data->>'phone')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Ministries
CREATE TABLE public.ministries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  is_home BOOLEAN NOT NULL DEFAULT false,
  status public.entity_status NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.ministries TO authenticated;
GRANT ALL ON public.ministries TO service_role;
ALTER TABLE public.ministries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ministries_read" ON public.ministries FOR SELECT TO authenticated USING (true);
CREATE POLICY "ministries_write" ON public.ministries FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "ministries_update" ON public.ministries FOR UPDATE TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE TRIGGER ministries_updated_at BEFORE UPDATE ON public.ministries FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Events
CREATE TABLE public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  start_date DATE,
  end_date DATE,
  venue TEXT,
  status public.event_status NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.events TO authenticated;
GRANT ALL ON public.events TO service_role;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "events_read" ON public.events FOR SELECT TO authenticated USING (true);
CREATE POLICY "events_insert" ON public.events FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "events_update" ON public.events FOR UPDATE TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE TRIGGER events_updated_at BEFORE UPDATE ON public.events FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Registration desks
CREATE TABLE public.registration_desks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  location TEXT,
  description TEXT,
  status public.entity_status NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.registration_desks TO authenticated;
GRANT ALL ON public.registration_desks TO service_role;
ALTER TABLE public.registration_desks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "desks_read" ON public.registration_desks FOR SELECT TO authenticated USING (true);
CREATE POLICY "desks_insert" ON public.registration_desks FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "desks_update" ON public.registration_desks FOR UPDATE TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE TRIGGER desks_updated_at BEFORE UPDATE ON public.registration_desks FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Registrar assignments
CREATE TABLE public.registrar_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  registration_desk_id UUID NOT NULL REFERENCES public.registration_desks(id),
  event_id UUID NOT NULL REFERENCES public.events(id),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  status public.assignment_status NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX registrar_one_active ON public.registrar_assignments (user_id) WHERE status = 'ACTIVE';
CREATE INDEX registrar_assignments_desk_idx ON public.registrar_assignments (registration_desk_id);
GRANT SELECT, INSERT, UPDATE ON public.registrar_assignments TO authenticated;
GRANT ALL ON public.registrar_assignments TO service_role;
ALTER TABLE public.registrar_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "assignments_read" ON public.registrar_assignments FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY "assignments_insert" ON public.registrar_assignments FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "assignments_update" ON public.registrar_assignments FOR UPDATE TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE TRIGGER assignments_updated_at BEFORE UPDATE ON public.registrar_assignments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Registration number sequence
CREATE SEQUENCE public.registration_number_seq START 1;
GRANT USAGE ON SEQUENCE public.registration_number_seq TO service_role;

-- Attendees
CREATE TABLE public.attendees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_number TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  location TEXT NOT NULL,
  attendance_type public.attendance_type NOT NULL,
  ministry_id UUID REFERENCES public.ministries(id),
  gender public.gender_type NOT NULL,
  is_youth BOOLEAN NOT NULL DEFAULT false,
  event_id UUID NOT NULL REFERENCES public.events(id),
  registration_desk_id UUID NOT NULL REFERENCES public.registration_desks(id),
  registered_by UUID NOT NULL REFERENCES auth.users(id),
  registrar_assignment_id UUID REFERENCES public.registrar_assignments(id),
  registered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX attendees_event_idx ON public.attendees (event_id);
CREATE INDEX attendees_desk_idx ON public.attendees (registration_desk_id);
CREATE INDEX attendees_registered_by_idx ON public.attendees (registered_by);
CREATE INDEX attendees_registered_at_idx ON public.attendees (registered_at);
CREATE INDEX attendees_phone_idx ON public.attendees (phone);
GRANT SELECT, INSERT, UPDATE ON public.attendees TO authenticated;
GRANT ALL ON public.attendees TO service_role;
ALTER TABLE public.attendees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "attendees_staff_read" ON public.attendees FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "attendees_staff_update" ON public.attendees FOR UPDATE TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE TRIGGER attendees_updated_at BEFORE UPDATE ON public.attendees FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.assign_registration_number()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.registration_number IS NULL OR NEW.registration_number = '' THEN
    NEW.registration_number := 'KPC-' || lpad(nextval('public.registration_number_seq')::text, 6, '0');
  END IF;
  RETURN NEW;
END; $$;
ALTER TABLE public.attendees ALTER COLUMN registration_number DROP NOT NULL;
CREATE TRIGGER attendees_regnum BEFORE INSERT ON public.attendees FOR EACH ROW EXECUTE FUNCTION public.assign_registration_number();

-- Audit logs
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  description TEXT,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_staff_read" ON public.audit_logs FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

-- SMS logs
CREATE TABLE public.sms_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  sent_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  sent_at TIMESTAMPTZ,
  event_id UUID REFERENCES public.events(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.sms_logs TO authenticated;
GRANT ALL ON public.sms_logs TO service_role;
ALTER TABLE public.sms_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sms_staff_read" ON public.sms_logs FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

-- Seed data
INSERT INTO public.ministries (name, is_home) VALUES ('Kagumo People''s Church', true);
INSERT INTO public.ministries (name) VALUES ('Visiting Ministry');
INSERT INTO public.events (name, description, venue, start_date, end_date, status)
VALUES ('Manifest Conference 2026', 'Annual church conference', 'KPC Main Sanctuary', CURRENT_DATE, CURRENT_DATE + 3, 'ACTIVE');
INSERT INTO public.registration_desks (name, code, location) VALUES
  ('Main Entrance', 'DESK-01', 'Main Gate'),
  ('Hall Entrance', 'DESK-02', 'Main Hall'),
  ('Youth Desk', 'DESK-03', 'Youth Wing'),
  ('VIP Desk', 'DESK-04', 'VIP Lounge');