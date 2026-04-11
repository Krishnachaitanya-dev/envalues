-- supabase/migrations/20260101000000_initial_schema.sql
-- Foundation schema: all base tables that subsequent migrations expect to exist.
-- Applied first due to timestamp prefix.

-- ── Utility: updated_at trigger function ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- ── owners ────────────────────────────────────────────────────────────────────
-- Maps 1:1 with auth.users. Created by handle_new_user trigger on signup.
CREATE TABLE IF NOT EXISTS public.owners (
  id                    uuid PRIMARY KEY,
  email                 text NOT NULL,
  password_hash         text NOT NULL DEFAULT 'auth_managed',
  full_name             text NOT NULL DEFAULT '',
  whatsapp_business_number text NOT NULL DEFAULT '',
  whatsapp_api_token    text,
  is_active             boolean DEFAULT true,
  onboarding_completed  boolean DEFAULT false,
  plan_type             text DEFAULT 'free',
  enterprise_id         uuid,
  brand_name            text,
  brand_logo_url        text,
  brand_primary_color   text,
  max_clients           integer,
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now()
);

ALTER TABLE public.owners ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER owners_updated_at BEFORE UPDATE ON public.owners
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── chatbots ──────────────────────────────────────────────────────────────────
-- One chatbot per owner (1:1 enforced by unique constraint on owner_id).
CREATE TABLE IF NOT EXISTS public.chatbots (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id          uuid NOT NULL REFERENCES public.owners(id) ON DELETE CASCADE,
  chatbot_name      text NOT NULL DEFAULT 'My Bot',
  greeting_message  text NOT NULL DEFAULT 'Welcome! How can I help you today?',
  farewell_message  text NOT NULL DEFAULT 'Thank you! Goodbye.',
  is_active         boolean DEFAULT false,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now(),
  UNIQUE(owner_id)
);

ALTER TABLE public.chatbots ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER chatbots_updated_at BEFORE UPDATE ON public.chatbots
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── qa_pairs ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.qa_pairs (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chatbot_id          uuid NOT NULL REFERENCES public.chatbots(id) ON DELETE CASCADE,
  question_text       text NOT NULL,
  answer_text         text NOT NULL DEFAULT '',
  is_main_question    boolean DEFAULT false,
  parent_question_id  uuid REFERENCES public.qa_pairs(id) ON DELETE SET NULL,
  display_order       integer NOT NULL DEFAULT 1,
  is_active           boolean DEFAULT true,
  media_url           text,
  media_type          text,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);

ALTER TABLE public.qa_pairs ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_qa_pairs_chatbot ON public.qa_pairs(chatbot_id);
CREATE INDEX IF NOT EXISTS idx_qa_pairs_parent ON public.qa_pairs(parent_question_id);

CREATE TRIGGER qa_pairs_updated_at BEFORE UPDATE ON public.qa_pairs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── customer_sessions ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.customer_sessions (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chatbot_id            uuid NOT NULL REFERENCES public.chatbots(id) ON DELETE CASCADE,
  customer_phone_number text NOT NULL,
  current_question_id   uuid REFERENCES public.qa_pairs(id) ON DELETE SET NULL,
  session_state         text DEFAULT 'active',
  last_activity_at      timestamptz DEFAULT now(),
  created_at            timestamptz DEFAULT now()
);

ALTER TABLE public.customer_sessions ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_customer_sessions_chatbot ON public.customer_sessions(chatbot_id);
CREATE INDEX IF NOT EXISTS idx_customer_sessions_phone ON public.customer_sessions(chatbot_id, customer_phone_number);

-- ── subscriptions ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id                  uuid NOT NULL REFERENCES public.owners(id) ON DELETE CASCADE,
  chatbot_id                uuid NOT NULL REFERENCES public.chatbots(id) ON DELETE CASCADE,
  amount                    integer NOT NULL DEFAULT 0,
  status                    text NOT NULL DEFAULT 'inactive',
  razorpay_payment_id       text,
  razorpay_subscription_id  text,
  current_period_start      timestamptz,
  current_period_end        timestamptz,
  created_at                timestamptz DEFAULT now(),
  updated_at                timestamptz DEFAULT now(),
  UNIQUE(chatbot_id)
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER subscriptions_updated_at BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── Auth trigger: create owner + chatbot on signup ───────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.owners (id, email, full_name, whatsapp_business_number, is_active, onboarding_completed)
  VALUES (
    NEW.id, NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'New Owner'),
    COALESCE(NEW.raw_user_meta_data->>'whatsapp_business_number', ''),
    true, false
  );
  INSERT INTO public.chatbots (owner_id, chatbot_name, greeting_message, farewell_message, is_active)
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

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
