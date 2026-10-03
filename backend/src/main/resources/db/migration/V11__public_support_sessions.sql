ALTER TABLE queue_items ADD COLUMN support_expires_at timestamp with time zone;
ALTER TABLE queue_items ADD COLUMN request_fingerprint varchar(64);
-- Early Hibernate-created databases predate the customer cancellation state.
ALTER TABLE queue_items DROP CONSTRAINT IF EXISTS queue_items_status_check;
ALTER TABLE queue_items ADD CONSTRAINT queue_items_status_check
CHECK (status IN ('WAITING','PROCESSING','COMPLETED','CANCELLED'));
-- Existing opaque customer sessions keep a transition window; staff records are unchanged.
UPDATE queue_items SET support_expires_at=CURRENT_TIMESTAMP + INTERVAL '24 hours'
WHERE session_id IS NOT NULL;
CREATE INDEX queue_support_expiry ON queue_items(support_expires_at)
WHERE support_expires_at IS NOT NULL AND status IN ('WAITING','PROCESSING');
