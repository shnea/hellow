CREATE TABLE IF NOT EXISTS routing_lock (id integer PRIMARY KEY);
INSERT INTO routing_lock(id) VALUES (1) ON CONFLICT DO NOTHING;
ALTER TABLE queue_items ADD COLUMN IF NOT EXISTS routing_cycle integer NOT NULL DEFAULT 0;
CREATE TABLE IF NOT EXISTS agent_presence (
 id varchar(64) PRIMARY KEY, issuer varchar(255) NOT NULL, subject varchar(255) NOT NULL,
 organization_id varchar(64) NOT NULL, display_name varchar(100) NOT NULL,
 availability varchar(32) NOT NULL, heartbeat_at timestamptz, available_since timestamptz NOT NULL,
 work_queue_code varchar(64), state_revision bigint NOT NULL DEFAULT 0, version bigint NOT NULL DEFAULT 0,
 UNIQUE(issuer,subject)
);
CREATE INDEX IF NOT EXISTS agent_presence_organization ON agent_presence(organization_id);
CREATE TABLE IF NOT EXISTS assignment_attempts (
 id varchar(64) PRIMARY KEY, organization_id varchar(64) NOT NULL, queue_code varchar(64) NOT NULL,
 presence_id varchar(64) NOT NULL REFERENCES agent_presence(id), agent_issuer varchar(255) NOT NULL,
 agent_subject varchar(255) NOT NULL, agent_name varchar(100) NOT NULL, routing_cycle integer NOT NULL,
 offered_at timestamptz NOT NULL, expires_at timestamptz NOT NULL, received_at timestamptz,
 finished_at timestamptz, outcome varchar(32) NOT NULL, version bigint NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX IF NOT EXISTS assignment_one_active_queue ON assignment_attempts(organization_id,queue_code) WHERE outcome IN ('OFFERED','RINGING');
CREATE UNIQUE INDEX IF NOT EXISTS assignment_one_active_agent ON assignment_attempts(presence_id) WHERE outcome IN ('OFFERED','RINGING');
CREATE INDEX IF NOT EXISTS assignment_history ON assignment_attempts(organization_id,queue_code,offered_at DESC);
