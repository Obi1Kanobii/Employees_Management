-- Run this in the Supabase SQL Editor on an existing database

CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE time_entries
  ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES clients(id);

GRANT ALL ON clients TO authenticated;

ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clients_select" ON clients
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "clients_insert_admin" ON clients
  FOR INSERT TO authenticated WITH CHECK (is_admin());

CREATE POLICY "clients_update_admin" ON clients
  FOR UPDATE TO authenticated USING (is_admin());

CREATE POLICY "clients_delete_admin" ON clients
  FOR DELETE TO authenticated USING (is_admin());
