-- Old API rows predate call and optimistic-lock state. Backfill before Hibernate
-- tries to add a non-null column to a populated queue table.
ALTER TABLE IF EXISTS queue_items ADD COLUMN IF NOT EXISTS call_ended boolean DEFAULT false;
UPDATE queue_items SET call_ended = false WHERE call_ended IS NULL;
ALTER TABLE IF EXISTS queue_items ALTER COLUMN call_ended SET DEFAULT false;
ALTER TABLE IF EXISTS queue_items ALTER COLUMN call_ended SET NOT NULL;

ALTER TABLE IF EXISTS queue_items ADD COLUMN IF NOT EXISTS version bigint DEFAULT 0;
UPDATE queue_items SET version = 0 WHERE version IS NULL;
ALTER TABLE IF EXISTS queue_items ALTER COLUMN version SET DEFAULT 0;

ALTER TABLE IF EXISTS consultations ADD COLUMN IF NOT EXISTS version bigint DEFAULT 0;
UPDATE consultations SET version = 0 WHERE version IS NULL;
ALTER TABLE IF EXISTS consultations ALTER COLUMN version SET DEFAULT 0;
