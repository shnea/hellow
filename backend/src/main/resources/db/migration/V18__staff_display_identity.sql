alter table memberships add column login_id varchar(255);
alter table memberships add column identity_name varchar(255);
alter table memberships add column deleted boolean not null default false;
