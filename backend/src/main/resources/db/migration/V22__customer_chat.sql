-- Historical single inquiries remain single inquiries; only new public CHAT submissions opt in.
ALTER TABLE queue_items ADD COLUMN chat_enabled BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE queue_items ADD COLUMN chat_sequence BIGINT NOT NULL DEFAULT 0;
ALTER TABLE queue_items ADD COLUMN chat_ended_at TIMESTAMP WITH TIME ZONE;
CREATE TABLE chat_messages (
  id BIGSERIAL PRIMARY KEY,
  queue_id BIGINT NOT NULL REFERENCES queue_items(id) ON DELETE CASCADE,
  sequence BIGINT NOT NULL CHECK (sequence > 0),
  sender_key VARCHAR(600) NOT NULL,
  sender VARCHAR(16) NOT NULL CHECK (sender IN ('CUSTOMER','AGENT')),
  sender_name TEXT NOT NULL,
  client_message_id VARCHAR(36) NOT NULL,
  body TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 10000),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  UNIQUE(queue_id,sequence),
  UNIQUE(queue_id,sender_key,client_message_id)
);
