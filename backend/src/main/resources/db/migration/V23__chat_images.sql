ALTER TABLE chat_messages ADD COLUMN image_file_id VARCHAR(255);
ALTER TABLE chat_messages ADD COLUMN image_name VARCHAR(255);
ALTER TABLE chat_messages ADD COLUMN image_mime VARCHAR(32);
ALTER TABLE chat_messages ADD COLUMN image_size BIGINT;
ALTER TABLE chat_messages ADD COLUMN image_sha256 VARCHAR(64);
ALTER TABLE chat_messages DROP CONSTRAINT chat_messages_body_check;
ALTER TABLE chat_messages ADD CONSTRAINT chat_message_content CHECK (
  length(body) BETWEEN 0 AND 10000 AND (length(body)>0 OR image_file_id IS NOT NULL)
);
ALTER TABLE chat_messages ADD CONSTRAINT chat_message_image CHECK (
  (image_file_id IS NULL AND image_name IS NULL AND image_mime IS NULL AND image_size IS NULL AND image_sha256 IS NULL)
  OR (sender='CUSTOMER' AND image_file_id IS NOT NULL AND image_name IS NOT NULL
      AND image_mime IS NOT NULL AND image_mime IN ('image/jpeg','image/png')
      AND image_size IS NOT NULL AND image_size BETWEEN 1 AND 5242880 AND image_sha256 IS NOT NULL)
);
