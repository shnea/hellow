-- Independent organization workspaces; existing records and grants stay unchanged.
CREATE TABLE knowledge_documents (
  id VARCHAR(255) PRIMARY KEY, version BIGINT NOT NULL,
  organization_id VARCHAR(64) NOT NULL REFERENCES organizations(id),
  owner_issuer VARCHAR(255) NOT NULL, owner_subject VARCHAR(255) NOT NULL, team_id VARCHAR(64),
  title VARCHAR(200) NOT NULL, category VARCHAR(100) NOT NULL,
  kind VARCHAR(16) NOT NULL CHECK (kind IN ('DOCUMENT','FAQ')),
  visibility VARCHAR(16) NOT NULL CHECK (visibility IN ('SELF','TEAM','ORGANIZATION')),
  state VARCHAR(16) NOT NULL CHECK (state IN ('DRAFT','PUBLISHED','ARCHIVED')),
  document TEXT NOT NULL, body_text TEXT NOT NULL, attachment_ids TEXT NOT NULL,
  draft_revision BIGINT NOT NULL CHECK (draft_revision > 0), published_revision BIGINT,
  published_title VARCHAR(200), published_category VARCHAR(100), published_body_text TEXT,
  published_kind VARCHAR(16), published_visibility VARCHAR(16),
  author_name VARCHAR(255) NOT NULL, created_at TIMESTAMPTZ NOT NULL, updated_at TIMESTAMPTZ NOT NULL,
  CHECK (state <> 'PUBLISHED' OR published_revision IS NOT NULL)
);
CREATE INDEX knowledge_org_updated ON knowledge_documents(organization_id, updated_at DESC, id);
CREATE TABLE knowledge_revisions (
  id BIGSERIAL PRIMARY KEY, document_id VARCHAR(64) NOT NULL REFERENCES knowledge_documents(id),
  revision BIGINT NOT NULL CHECK (revision > 0), title VARCHAR(200) NOT NULL, category VARCHAR(100) NOT NULL,
  kind VARCHAR(16) NOT NULL, visibility VARCHAR(16) NOT NULL,
  document TEXT NOT NULL, attachment_ids TEXT NOT NULL,
  editor_issuer VARCHAR(255) NOT NULL, editor_subject VARCHAR(255) NOT NULL, editor_name VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL, UNIQUE(document_id,revision)
);
CREATE TABLE internal_rooms (
  id VARCHAR(255) PRIMARY KEY, version BIGINT NOT NULL,
  organization_id VARCHAR(64) NOT NULL REFERENCES organizations(id),
  owner_issuer VARCHAR(255) NOT NULL, owner_subject VARCHAR(255) NOT NULL, team_id VARCHAR(64),
  kind VARCHAR(16) NOT NULL CHECK (kind IN ('DIRECT','GROUP')), name VARCHAR(150) NOT NULL,
  creation_key VARCHAR(64) NOT NULL, creator_member_id BIGINT NOT NULL REFERENCES memberships(id),
  sequence BIGINT NOT NULL CHECK (sequence >= 0), created_at TIMESTAMPTZ NOT NULL, updated_at TIMESTAMPTZ NOT NULL,
  UNIQUE(organization_id,creation_key)
);
CREATE TABLE internal_room_members (
  id VARCHAR(255) PRIMARY KEY, room_id VARCHAR(64) NOT NULL REFERENCES internal_rooms(id),
  membership_id BIGINT NOT NULL REFERENCES memberships(id), active BOOLEAN NOT NULL,
  read_sequence BIGINT NOT NULL CHECK (read_sequence >= 0), joined_at TIMESTAMPTZ NOT NULL, left_at TIMESTAMPTZ,
  UNIQUE(room_id,membership_id)
);
CREATE INDEX internal_members_active ON internal_room_members(membership_id,active,room_id);
CREATE TABLE internal_messages (
  id BIGSERIAL PRIMARY KEY, room_id VARCHAR(64) NOT NULL REFERENCES internal_rooms(id),
  sequence BIGINT NOT NULL CHECK (sequence > 0), sender_issuer VARCHAR(255) NOT NULL,
  sender_subject VARCHAR(255) NOT NULL, sender_name VARCHAR(255) NOT NULL,
  client_message_id VARCHAR(36) NOT NULL, body TEXT NOT NULL CHECK (length(body) <= 10000),
  attachment_ids TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL,
  UNIQUE(room_id,sequence), UNIQUE(room_id,sender_issuer,sender_subject,client_message_id)
);
CREATE TABLE work_files (
  id VARCHAR(255) PRIMARY KEY, organization_id VARCHAR(64) NOT NULL REFERENCES organizations(id),
  owner_kind VARCHAR(16) NOT NULL CHECK (owner_kind IN ('KNOWLEDGE','ROOM')), owner_id VARCHAR(64) NOT NULL,
  uploader_issuer VARCHAR(255) NOT NULL, uploader_subject VARCHAR(255) NOT NULL, request_id VARCHAR(36) NOT NULL,
  platform_file_id VARCHAR(255) NOT NULL, name VARCHAR(255) NOT NULL, mime VARCHAR(120) NOT NULL,
  size BIGINT NOT NULL CHECK (size BETWEEN 1 AND 52428800), sha256 VARCHAR(64) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL, message_sequence BIGINT CHECK (message_sequence > 0),
  UNIQUE(organization_id,owner_kind,owner_id,uploader_issuer,uploader_subject,request_id),
  CHECK (owner_kind = 'ROOM' OR message_sequence IS NULL)
);
