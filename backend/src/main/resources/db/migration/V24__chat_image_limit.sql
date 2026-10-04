ALTER TABLE chat_messages DROP CONSTRAINT chat_message_image;
ALTER TABLE chat_messages ADD CONSTRAINT chat_message_image CHECK (
  (image_file_id IS NULL AND image_name IS NULL AND image_mime IS NULL AND image_size IS NULL AND image_sha256 IS NULL)
  OR (sender='CUSTOMER' AND image_file_id IS NOT NULL AND image_name IS NOT NULL
      AND image_mime IS NOT NULL AND image_mime IN ('image/jpeg','image/png')
      AND image_size IS NOT NULL AND image_size BETWEEN 1 AND 52428800 AND image_sha256 IS NOT NULL)
);
