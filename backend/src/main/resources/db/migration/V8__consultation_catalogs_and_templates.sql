CREATE TABLE consultation_catalogs (
  owner_id varchar(64) PRIMARY KEY, overridden boolean NOT NULL,
  document text NOT NULL, version bigint NOT NULL DEFAULT 0
);
CREATE TABLE text_templates (
  id varchar(64) PRIMARY KEY, scope varchar(32) NOT NULL CHECK(scope IN ('COMMON','ORGANIZATION','PERSONAL')),
  organization_id varchar(64) NOT NULL, origin_id varchar(64) REFERENCES text_templates(id),
  owner_issuer varchar(255), owner_subject varchar(255), name varchar(150) NOT NULL,
  body text NOT NULL, active boolean NOT NULL, inherited boolean NOT NULL, version bigint NOT NULL DEFAULT 0,
  UNIQUE(organization_id,origin_id),
  CHECK((scope='PERSONAL' AND owner_issuer IS NOT NULL AND owner_subject IS NOT NULL AND origin_id IS NULL)
     OR (scope<>'PERSONAL' AND owner_issuer IS NULL AND owner_subject IS NULL)),
  CHECK(scope='ORGANIZATION' OR origin_id IS NULL)
);
CREATE INDEX text_templates_owner ON text_templates(organization_id,scope,owner_issuer,owner_subject);
ALTER TABLE consultations ADD COLUMN category_id varchar(64), ADD COLUMN category_path text,
  ADD COLUMN result_id varchar(64), ADD COLUMN result_name varchar(100);
-- Preserve every legacy label. Do not guess a classification ID from a mutable name.
-- Existing writers retain the former personal-template action under its own permission.
WITH added AS (INSERT INTO membership_permissions(membership_id,permissions)
  SELECT p.membership_id,'template:personal' FROM membership_permissions p WHERE p.permissions='consultation:write'
    AND NOT EXISTS(SELECT 1 FROM membership_permissions x WHERE x.membership_id=p.membership_id AND x.permissions='template:personal')
  RETURNING membership_id)
UPDATE memberships SET version=version+1 WHERE id IN (SELECT membership_id FROM added);
WITH added AS (INSERT INTO role_grants(role_id,permission,data_scope)
  SELECT role_id,'template:personal','SELF' FROM role_grants WHERE permission='consultation:write'
  ON CONFLICT DO NOTHING RETURNING role_id)
UPDATE organization_roles SET version=version+1 WHERE id IN (SELECT role_id FROM added);
