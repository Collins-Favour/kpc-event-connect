CREATE TYPE public.ticket_scope AS ENUM ('SPACE','PLATFORM');
CREATE TYPE public.ticket_status AS ENUM ('OPEN','IN_PROGRESS','RESOLVED');

CREATE TABLE public.saved_segments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id uuid NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  definition jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX saved_segments_space_idx ON public.saved_segments(space_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.saved_segments TO authenticated;
GRANT ALL ON public.saved_segments TO service_role;
ALTER TABLE public.saved_segments ENABLE ROW LEVEL SECURITY;
CREATE POLICY segments_member_read ON public.saved_segments FOR SELECT TO authenticated USING (private.is_space_member(space_id, auth.uid()));
CREATE POLICY segments_member_insert ON public.saved_segments FOR INSERT TO authenticated WITH CHECK (private.is_space_member(space_id, auth.uid()));
CREATE POLICY segments_member_update ON public.saved_segments FOR UPDATE TO authenticated USING (private.is_space_member(space_id, auth.uid())) WITH CHECK (private.is_space_member(space_id, auth.uid()));
CREATE POLICY segments_member_delete ON public.saved_segments FOR DELETE TO authenticated USING (private.is_space_member(space_id, auth.uid()));
CREATE TRIGGER saved_segments_updated_at BEFORE UPDATE ON public.saved_segments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.template_presets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id uuid NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX template_presets_space_idx ON public.template_presets(space_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.template_presets TO authenticated;
GRANT ALL ON public.template_presets TO service_role;
ALTER TABLE public.template_presets ENABLE ROW LEVEL SECURITY;
CREATE POLICY presets_member_read ON public.template_presets FOR SELECT TO authenticated USING (private.is_space_member(space_id, auth.uid()));
CREATE POLICY presets_member_insert ON public.template_presets FOR INSERT TO authenticated WITH CHECK (private.is_space_member(space_id, auth.uid()));
CREATE POLICY presets_member_update ON public.template_presets FOR UPDATE TO authenticated USING (private.is_space_member(space_id, auth.uid())) WITH CHECK (private.is_space_member(space_id, auth.uid()));
CREATE POLICY presets_member_delete ON public.template_presets FOR DELETE TO authenticated USING (private.is_space_member(space_id, auth.uid()));
CREATE TRIGGER template_presets_updated_at BEFORE UPDATE ON public.template_presets FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id uuid NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  event_id uuid REFERENCES public.events(id) ON DELETE SET NULL,
  desk_id uuid REFERENCES public.registration_desks(id) ON DELETE SET NULL,
  scope public.ticket_scope NOT NULL DEFAULT 'SPACE',
  subject text NOT NULL,
  body text NOT NULL,
  status public.ticket_status NOT NULL DEFAULT 'OPEN',
  created_by uuid REFERENCES auth.users(id),
  created_by_label text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX support_tickets_space_idx ON public.support_tickets(space_id, scope, created_at DESC);
GRANT SELECT, INSERT, UPDATE ON public.support_tickets TO authenticated;
GRANT ALL ON public.support_tickets TO service_role;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY tickets_read ON public.support_tickets FOR SELECT TO authenticated
  USING (private.is_space_member(space_id, auth.uid()) OR (scope = 'PLATFORM' AND private.is_platform_admin(auth.uid())));
CREATE POLICY tickets_insert ON public.support_tickets FOR INSERT TO authenticated
  WITH CHECK (private.is_space_member(space_id, auth.uid()) AND created_by = auth.uid());
CREATE POLICY tickets_update ON public.support_tickets FOR UPDATE TO authenticated
  USING (private.is_space_member(space_id, auth.uid()) OR (scope = 'PLATFORM' AND private.is_platform_admin(auth.uid())))
  WITH CHECK (private.is_space_member(space_id, auth.uid()) OR (scope = 'PLATFORM' AND private.is_platform_admin(auth.uid())));
CREATE TRIGGER support_tickets_updated_at BEFORE UPDATE ON public.support_tickets FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.support_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  space_id uuid NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  author_id uuid REFERENCES auth.users(id),
  author_label text,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX support_messages_ticket_idx ON public.support_messages(ticket_id, created_at);
GRANT SELECT, INSERT ON public.support_messages TO authenticated;
GRANT ALL ON public.support_messages TO service_role;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY messages_read ON public.support_messages FOR SELECT TO authenticated
  USING (private.is_space_member(space_id, auth.uid()) OR private.is_platform_admin(auth.uid()));
CREATE POLICY messages_insert ON public.support_messages FOR INSERT TO authenticated
  WITH CHECK ((private.is_space_member(space_id, auth.uid()) OR private.is_platform_admin(auth.uid())) AND author_id = auth.uid());