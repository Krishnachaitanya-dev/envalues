-- Evolution API messages inbox
CREATE TABLE IF NOT EXISTS evolution_messages (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  phone text NOT NULL,
  contact_name text,
  direction text NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  content text NOT NULL,
  msg_type text DEFAULT 'text',
  evolution_msg_id text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS evolution_messages_phone_idx ON evolution_messages(phone);
CREATE INDEX IF NOT EXISTS evolution_messages_created_at_idx ON evolution_messages(created_at DESC);

ALTER TABLE evolution_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role only" ON evolution_messages USING (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE evolution_messages;

-- Evolution API scheduled reminders
CREATE TABLE IF NOT EXISTS evolution_reminders (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  phone text NOT NULL,
  message text NOT NULL,
  scheduled_at timestamptz NOT NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'cancelled')),
  error text,
  sent_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS evolution_reminders_status_idx ON evolution_reminders(status, scheduled_at);
