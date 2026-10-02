-- Development database only. Run after stopping the old API and after a verified
-- backup/restore rehearsal. Never add this file to Flyway or use it for production.
-- Required psql variables: org_id, org_name, public_code, admin_issuer, admin_subject.
\set ON_ERROR_STOP on

BEGIN;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM organizations) OR EXISTS (SELECT 1 FROM memberships) THEN
    RAISE EXCEPTION 'Development organization already exists; review before migrating';
  END IF;
  IF EXISTS (SELECT 1 FROM customers WHERE organization_id IS NOT NULL)
      OR EXISTS (SELECT 1 FROM queue_items WHERE organization_id IS NOT NULL)
      OR EXISTS (SELECT 1 FROM consultations WHERE organization_id IS NOT NULL)
      OR EXISTS (SELECT 1 FROM timeline_items WHERE organization_id IS NOT NULL)
      OR EXISTS (SELECT 1 FROM follow_up_actions WHERE organization_id IS NOT NULL) THEN
    RAISE EXCEPTION 'Mixed ownership detected; review before migrating';
  END IF;
END $$;

INSERT INTO organizations (id, name, active, public_code)
VALUES (:'org_id', :'org_name', true, :'public_code');

WITH admin AS (
  INSERT INTO memberships (active, data_scope, issuer, organization_id, subject)
  VALUES (true, 'ORGANIZATION', :'admin_issuer', :'org_id', :'admin_subject')
  RETURNING id
)
INSERT INTO membership_permissions (membership_id, permissions)
SELECT admin.id, permission
FROM admin
CROSS JOIN (VALUES
  ('organization:admin'), ('customer:read'), ('customer:write'),
  ('queue:read'), ('queue:accept'), ('consultation:read'),
  ('consultation:write'), ('followup:write')
) AS p(permission);

UPDATE customers SET organization_id = :'org_id' WHERE organization_id IS NULL;
UPDATE queue_items SET organization_id = :'org_id' WHERE organization_id IS NULL;
UPDATE consultations SET organization_id = :'org_id' WHERE organization_id IS NULL;
UPDATE timeline_items SET organization_id = :'org_id' WHERE organization_id IS NULL;
UPDATE follow_up_actions SET organization_id = :'org_id' WHERE organization_id IS NULL;

COMMIT;
