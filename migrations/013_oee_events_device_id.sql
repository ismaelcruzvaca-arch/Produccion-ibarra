-- Migration 013: Add device_id to oee_events
ALTER TABLE oee_events ADD COLUMN IF NOT EXISTS device_id text;
