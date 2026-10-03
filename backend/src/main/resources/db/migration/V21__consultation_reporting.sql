-- Collect first acceptance from this version onward; never invent historical timestamps.
ALTER TABLE queue_items ADD COLUMN first_accepted_at timestamptz;
CREATE INDEX queue_report_period ON queue_items(organization_id, created_at);
CREATE INDEX consultation_report_period ON consultations(organization_id, created_at);
CREATE INDEX followup_report_period ON follow_up_actions(organization_id, action_type, created_at);
-- New monitor/report grants are opt-in for existing members and roles.
