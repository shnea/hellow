CREATE TABLE teams (
  id varchar(64) PRIMARY KEY, organization_id varchar(64) NOT NULL REFERENCES organizations(id),
  name varchar(100) NOT NULL, parent_id varchar(64), active boolean NOT NULL, version bigint NOT NULL DEFAULT 0,
  UNIQUE(organization_id,name), UNIQUE(organization_id,id),
  FOREIGN KEY(organization_id,parent_id) REFERENCES teams(organization_id,id)
);
CREATE TABLE organization_roles (
  id varchar(64) PRIMARY KEY, organization_id varchar(64) NOT NULL REFERENCES organizations(id),
  name varchar(100) NOT NULL, active boolean NOT NULL, version bigint NOT NULL DEFAULT 0,
  UNIQUE(organization_id,name)
);
CREATE TABLE role_grants (
  role_id varchar(64) NOT NULL REFERENCES organization_roles(id), permission varchar(100) NOT NULL,
  data_scope varchar(32) NOT NULL CHECK(data_scope IN ('SELF','TEAM','ORGANIZATION')), PRIMARY KEY(role_id,permission)
);
ALTER TABLE memberships ADD COLUMN team_id varchar(64);
ALTER TABLE memberships ADD CONSTRAINT membership_team_org FOREIGN KEY(organization_id,team_id) REFERENCES teams(organization_id,id);
CREATE TABLE membership_roles (
  membership_id bigint NOT NULL REFERENCES memberships(id), role_id varchar(64) NOT NULL REFERENCES organization_roles(id),
  PRIMARY KEY(membership_id,role_id)
);

-- Unknown legacy ownership remains visible only under an ORGANIZATION grant.
DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['customers','queue_items','consultations','timeline_items','follow_up_actions','attachments','consultation_revisions'] LOOP
    EXECUTE format('ALTER TABLE %I ADD COLUMN owner_issuer varchar(255), ADD COLUMN owner_subject varchar(255), ADD COLUMN team_id varchar(64)',table_name);
    EXECUTE format('CREATE INDEX %I ON %I (organization_id,owner_issuer,owner_subject)',table_name||'_owner_scope',table_name);
    EXECUTE format('CREATE INDEX %I ON %I (organization_id,team_id)',table_name||'_team_scope',table_name);
  END LOOP;
END $$;
-- Only an unambiguous identity match is backfilled, never a human display name.
UPDATE queue_items q SET owner_subject=q.assigned_subject,owner_issuer=m.issuer
FROM memberships m WHERE m.organization_id=q.organization_id AND m.subject=q.assigned_subject
  AND (SELECT count(*) FROM memberships x WHERE x.organization_id=m.organization_id AND x.subject=m.subject)=1;
UPDATE consultations c SET owner_subject=c.agent_subject,owner_issuer=m.issuer
FROM memberships m WHERE m.organization_id=c.organization_id AND m.subject=c.agent_subject
  AND (SELECT count(*) FROM memberships x WHERE x.organization_id=m.organization_id AND x.subject=m.subject)=1;
UPDATE timeline_items t SET owner_subject=q.owner_subject,owner_issuer=q.owner_issuer FROM queue_items q WHERE t.organization_id=q.organization_id AND t.queue_code=q.code;
UPDATE follow_up_actions f SET owner_subject=q.owner_subject,owner_issuer=q.owner_issuer FROM queue_items q WHERE f.organization_id=q.organization_id AND f.queue_code=q.code;
UPDATE attachments a SET owner_subject=q.owner_subject,owner_issuer=q.owner_issuer FROM queue_items q WHERE a.organization_id=q.organization_id AND a.queue_code=q.code;
UPDATE attachments a SET owner_subject=c.owner_subject,owner_issuer=c.owner_issuer FROM consultations c WHERE a.organization_id=c.organization_id AND a.queue_code='record-'||c.id;
UPDATE consultation_revisions r SET owner_subject=c.owner_subject,owner_issuer=c.owner_issuer FROM consultations c WHERE r.organization_id=c.organization_id AND r.consultation_id=c.id;
