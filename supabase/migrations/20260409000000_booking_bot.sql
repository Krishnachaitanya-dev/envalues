-- Booking Bot feature migration
-- Adds chatbot_type + all booking tables

-- 1. Add type column to chatbots
ALTER TABLE chatbots ADD COLUMN IF NOT EXISTS chatbot_type text NOT NULL DEFAULT 'menu';

-- 2. Booking configuration (one per booking chatbot)
CREATE TABLE IF NOT EXISTS booking_configs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chatbot_id      uuid UNIQUE NOT NULL REFERENCES chatbots(id) ON DELETE CASCADE,
  doctor_name     text NOT NULL DEFAULT '',
  reception_phone text NOT NULL DEFAULT '',
  work_start      time NOT NULL DEFAULT '12:00:00',
  work_end        time NOT NULL DEFAULT '20:00:00',
  slot_duration_mins integer NOT NULL DEFAULT 20,
  buffer_mins     integer NOT NULL DEFAULT 90,
  symptoms        text[] NOT NULL DEFAULT '{}',
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

-- 3. Conversation state (one row per patient per chatbot)
CREATE TABLE IF NOT EXISTS booking_conversation_state (
  chatbot_id    uuid NOT NULL REFERENCES chatbots(id) ON DELETE CASCADE,
  phone         text NOT NULL,
  current_step  text NOT NULL DEFAULT 'start',
  temp_data     jsonb NOT NULL DEFAULT '{}',
  updated_at    timestamptz DEFAULT now(),
  PRIMARY KEY (chatbot_id, phone)
);

-- 4. Patients
CREATE TABLE IF NOT EXISTS booking_patients (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chatbot_id  uuid NOT NULL REFERENCES chatbots(id) ON DELETE CASCADE,
  phone       text NOT NULL,
  name        text,
  age         integer,
  gender      text,
  created_at  timestamptz DEFAULT now(),
  UNIQUE(chatbot_id, phone)
);

-- 5. Appointments
CREATE TABLE IF NOT EXISTS booking_appointments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chatbot_id  uuid NOT NULL REFERENCES chatbots(id) ON DELETE CASCADE,
  patient_id  uuid NOT NULL REFERENCES booking_patients(id),
  slot_date   date NOT NULL,
  slot_time   time NOT NULL,
  symptom     text,
  status      text NOT NULL DEFAULT 'confirmed',
  booked_at   timestamptz DEFAULT now(),
  cancelled_at timestamptz
);

-- Prevent double booking: only one confirmed appointment per slot per chatbot
CREATE UNIQUE INDEX IF NOT EXISTS booking_appointments_no_double_book
  ON booking_appointments(chatbot_id, slot_date, slot_time)
  WHERE status = 'confirmed';

-- 6. Blocked time windows (doctor unavailability)
CREATE TABLE IF NOT EXISTS booking_blocked_slots (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chatbot_id   uuid NOT NULL REFERENCES chatbots(id) ON DELETE CASCADE,
  block_date   date,              -- null when is_recurring = true
  start_time   time NOT NULL,
  end_time     time NOT NULL,
  reason       text,
  is_recurring boolean NOT NULL DEFAULT false,
  created_at   timestamptz DEFAULT now()
);
