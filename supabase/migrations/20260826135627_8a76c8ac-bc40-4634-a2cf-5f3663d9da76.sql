ALTER TYPE public.field_type ADD VALUE IF NOT EXISTS 'BOOLEAN';

CREATE OR REPLACE FUNCTION public.grant_platform_admin_for_seed_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email_confirmed_at IS NOT NULL
     AND lower(NEW.email) = 'otictechnologieshq@gmail.com' THEN
    INSERT INTO public.platform_admins (user_id)
    VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_grant_platform_admin ON auth.users;
CREATE TRIGGER on_auth_user_created_grant_platform_admin
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.grant_platform_admin_for_seed_email();

DROP TRIGGER IF EXISTS on_auth_user_confirmed_grant_platform_admin ON auth.users;
CREATE TRIGGER on_auth_user_confirmed_grant_platform_admin
AFTER UPDATE OF email_confirmed_at ON auth.users
FOR EACH ROW
WHEN (old.email_confirmed_at IS NULL AND new.email_confirmed_at IS NOT NULL)
EXECUTE FUNCTION public.grant_platform_admin_for_seed_email();

INSERT INTO public.platform_admins (user_id)
SELECT id FROM auth.users
WHERE lower(email) = 'otictechnologieshq@gmail.com' AND email_confirmed_at IS NOT NULL
ON CONFLICT (user_id) DO NOTHING;