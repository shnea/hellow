-- Explicit repair for the former opt-in customer registration behavior.
-- Run only against a backed-up, stopped workspace, first against its restored copy.
-- Do not change ownership, content, timestamps or existing customer associations.
CREATE TEMP TABLE saved_contacts AS
SELECT DISTINCT ON (q.organization_id,regexp_replace(q.phone_number,'[^0-9]','','g')) q.*,
       regexp_replace(q.phone_number,'[^0-9]','','g') AS normalized_phone
FROM queue_items q JOIN consultations r ON r.organization_id=q.organization_id AND r.queue_code=q.code
WHERE q.customer_code IS NULL AND q.organization_id IS NOT NULL
  AND q.phone_number ~ '^[+0-9().[:space:]-]+$'
  AND length(regexp_replace(q.phone_number,'[^0-9]','','g')) BETWEEN 7 AND 15
  AND q.customer_name ~ '[[:alpha:]]'
ORDER BY q.organization_id,regexp_replace(q.phone_number,'[^0-9]','','g'),q.created_at DESC,q.id DESC;

INSERT INTO customers(code,customer_type,registered,name,company,tier,phone_number,complainant,total_calls,created_at,updated_at,organization_id,owner_issuer,owner_subject,team_id)
SELECT 'cust-history-'||md5(s.organization_id||':'||s.normalized_phone),s.customer_type,true,s.customer_name,s.company_name,'Standard',s.phone_number,false,1,s.created_at,s.created_at,s.organization_id,s.owner_issuer,s.owner_subject,s.team_id
FROM saved_contacts s WHERE NOT EXISTS(SELECT 1 FROM customers c WHERE c.organization_id=s.organization_id AND regexp_replace(c.phone_number,'[^0-9]','','g')=s.normalized_phone);

CREATE TEMP TABLE contact_links AS
SELECT q.id,q.organization_id,q.code,min(c.code) AS customer_code
FROM queue_items q JOIN customers c ON c.organization_id=q.organization_id
  AND regexp_replace(c.phone_number,'[^0-9]','','g')=regexp_replace(q.phone_number,'[^0-9]','','g')
WHERE q.customer_code IS NULL AND q.phone_number ~ '^[+0-9().[:space:]-]+$'
  AND length(regexp_replace(q.phone_number,'[^0-9]','','g')) BETWEEN 7 AND 15
GROUP BY q.id,q.organization_id,q.code HAVING count(*)=1 OR count(DISTINCT lower(trim(c.name)))=1;

UPDATE queue_items q SET customer_code=l.customer_code,registered=true,version=coalesce(q.version,0)+1 FROM contact_links l WHERE q.id=l.id;
UPDATE consultations r SET customer_code=l.customer_code,version=coalesce(r.version,0)+1 FROM contact_links l WHERE r.organization_id=l.organization_id AND r.queue_code=l.code AND r.customer_code IS NULL;
UPDATE timeline_items t SET customer_code=l.customer_code FROM contact_links l WHERE t.organization_id=l.organization_id AND t.queue_code=l.code AND t.customer_code IS NULL;
UPDATE follow_up_actions f SET customer_code=l.customer_code,version=coalesce(f.version,0)+1 FROM contact_links l WHERE f.organization_id=l.organization_id AND f.queue_code=l.code AND f.customer_code IS NULL;
UPDATE customers c SET registered=true WHERE NOT c.registered AND EXISTS(SELECT 1 FROM consultations r WHERE r.organization_id=c.organization_id AND r.customer_code=c.code);
INSERT INTO audit_events(organization_id,actor_issuer,actor_subject,action,target,details,occurred_at)
SELECT organization_id,'hellow:maintenance','customer-history-repair','customer.history.reconcile',organization_id,'Automatic registration and unique phone association repair; original content and scope retained',CURRENT_TIMESTAMP FROM contact_links GROUP BY organization_id;
