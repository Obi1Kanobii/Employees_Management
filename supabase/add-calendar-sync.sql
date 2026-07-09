-- Google Calendar sync support (run after schema.sql)
-- Maps calendar event titles (e.g. "אלעד", "יובל") to employee profiles.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS calendar_aliases TEXT[] DEFAULT '{}';

ALTER TABLE time_entries
  ADD COLUMN IF NOT EXISTS google_event_id TEXT,
  ADD COLUMN IF NOT EXISTS synced_from_calendar BOOLEAN DEFAULT false;

-- NULL google_event_id allowed (manual entries); non-null IDs must be unique.
CREATE UNIQUE INDEX IF NOT EXISTS time_entries_google_event_id_key
  ON time_entries (google_event_id);

CREATE TABLE IF NOT EXISTS calendar_sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  synced_by UUID REFERENCES profiles(id),
  events_processed INT DEFAULT 0,
  entries_upserted INT DEFAULT 0,
  events_skipped INT DEFAULT 0,
  errors JSONB DEFAULT '[]'::jsonb
);

ALTER TABLE calendar_sync_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "calendar_sync_logs_admin_select" ON calendar_sync_logs
  FOR SELECT TO authenticated USING (is_admin());

CREATE POLICY "calendar_sync_logs_admin_insert" ON calendar_sync_logs
  FOR INSERT TO authenticated WITH CHECK (is_admin());

GRANT ALL ON calendar_sync_logs TO authenticated;

-- Set calendar aliases for your two employees (run after they sign up).
-- Replace emails if needed; aliases match the event title in Google Calendar.
UPDATE profiles p
SET calendar_aliases = ARRAY['יובל', 'Yuval', 'yuval']
FROM auth.users u
WHERE p.id = u.id AND u.email = 'yuval@betterai360.com';

UPDATE profiles p
SET calendar_aliases = ARRAY['אלעד', 'Elad', 'elad']
FROM auth.users u
WHERE p.id = u.id AND u.email = 'elad@betterai360.com';
