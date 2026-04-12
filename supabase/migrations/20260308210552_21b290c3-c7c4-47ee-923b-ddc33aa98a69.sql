
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.owners (
    id, email, password_hash, full_name,
    whatsapp_business_number, is_active, onboarding_completed
  )
  VALUES (
    NEW.id, NEW.email, 'auth_managed',
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'New Owner'),
    COALESCE(NEW.raw_user_meta_data->>'whatsapp_business_number', ''),
    true, false
  );

  INSERT INTO public.chatbots (
    owner_id, chatbot_name, greeting_message, farewell_message, is_active
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'My') || '''s Bot',
    E'Welcome! How can I help you today? 😊\n\nPlease select an option below to get started.',
    E'Thank you for contacting us! 🙏\nHave a wonderful day! ✨',
    false
  );

  RETURN NEW;
END;
$$;
