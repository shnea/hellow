-- Existing synthetic/legacy rows are preserved. Organization assignment is a
-- separate, reviewed data migration, never inferred from a request header.
-- Hibernate update continues to build the development schema; production
-- remains blocked until a full versioned baseline and restore test exist.
ALTER TABLE IF EXISTS consultations ALTER COLUMN customer_code DROP NOT NULL;
ALTER TABLE IF EXISTS timeline_items ALTER COLUMN customer_code DROP NOT NULL;
ALTER TABLE IF EXISTS follow_up_actions ALTER COLUMN customer_code DROP NOT NULL;
