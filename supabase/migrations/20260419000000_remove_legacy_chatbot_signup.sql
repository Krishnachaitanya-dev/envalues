-- Keep auth signup aligned with the V1 flow-builder data model.
-- The legacy chatbots table was removed; new users only need an owner row.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.owners (
    id,
    email,
    password_hash,
    full_name,
    whatsapp_business_number,
    is_active,
    onboarding_completed
  )
  VALUES (
    NEW.id,
    NEW.email,
    'auth_managed',
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'New Owner'),
    COALESCE(NEW.raw_user_meta_data->>'whatsapp_business_number', ''),
    true,
    false
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, public.owners.full_name),
    is_active = true;

  RETURN NEW;
END;
$$;
