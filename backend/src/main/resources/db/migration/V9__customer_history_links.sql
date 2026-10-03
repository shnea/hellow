ALTER TABLE queue_items ADD COLUMN phone_key varchar(50);
UPDATE queue_items SET phone_key=regexp_replace(phone_number,'[^0-9]','','g');
CREATE INDEX queue_unlinked_phone ON queue_items(organization_id,phone_key,created_at DESC) WHERE customer_code IS NULL AND status='COMPLETED';
CREATE TABLE customer_history_links (
  id varchar(64) PRIMARY KEY, organization_id varchar(64) NOT NULL,
  queue_code varchar(64) NOT NULL, customer_code varchar(64) NOT NULL,
  original_registered boolean NOT NULL,
  actor_issuer varchar(255) NOT NULL, actor_subject varchar(255) NOT NULL, actor_name varchar(100) NOT NULL,
  linked_at timestamptz NOT NULL, undone_at timestamptz
);
CREATE INDEX customer_history_links_customer ON customer_history_links(organization_id,customer_code,linked_at DESC);
