ALTER TABLE consultations ADD COLUMN IF NOT EXISTS request_key varchar(64);
CREATE UNIQUE INDEX IF NOT EXISTS consultations_request_key ON consultations(request_key);
CREATE TABLE consultation_revisions (
  id bigserial PRIMARY KEY,
  organization_id varchar(255) NOT NULL,
  consultation_id bigint NOT NULL,
  actor_subject varchar(255), actor_name varchar(255), changed_at timestamp with time zone,
  before_document text
);
CREATE INDEX consultation_revisions_record ON consultation_revisions(organization_id,consultation_id);
