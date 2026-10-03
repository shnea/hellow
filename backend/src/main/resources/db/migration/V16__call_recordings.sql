create table call_recordings (
  id varchar(64) primary key,
  organization_id varchar(64) not null,
  owner_issuer varchar(255), owner_subject varchar(255), team_id varchar(64),
  queue_code varchar(64) not null,
  state varchar(32) not null,
  egress_id varchar(128), file_id varchar(255),
  created_at timestamptz not null, updated_at timestamptz not null,
  retry_at timestamptz not null, lease_until timestamptz,
  attempts integer not null default 0, error_code varchar(64),
  duration_seconds bigint not null default 0, version bigint not null default 0,
  unique(organization_id,queue_code)
);
create index call_recordings_pending on call_recordings(state,retry_at);
