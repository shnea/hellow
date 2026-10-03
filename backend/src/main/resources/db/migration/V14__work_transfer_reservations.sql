ALTER TABLE work_transfers ADD COLUMN live_work boolean NOT NULL DEFAULT false;
CREATE UNIQUE INDEX work_transfer_one_live_target ON work_transfers(to_issuer,to_subject) WHERE status='OFFERED' AND live_work;
ALTER TABLE consultations ADD COLUMN current_assignee_name varchar(255);
