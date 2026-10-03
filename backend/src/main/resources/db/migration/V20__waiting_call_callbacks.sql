-- New public voice requests opt into a durable 30-second deadline. Existing rows stay unchanged.
ALTER TABLE queue_items ADD COLUMN callback_due_at timestamptz;
ALTER TABLE queue_items ADD COLUMN callback_follow_up_id bigint;
CREATE UNIQUE INDEX queue_callback_once ON queue_items(callback_follow_up_id) WHERE callback_follow_up_id IS NOT NULL;

-- A callback may be assigned and started without a promised appointment time.
ALTER TABLE follow_up_actions DROP CONSTRAINT follow_up_confirmed_interval;
ALTER TABLE follow_up_actions ADD CONSTRAINT follow_up_confirmed_interval CHECK (
 (status NOT IN ('ASSIGNED','SCHEDULED','IN_PROGRESS') OR
   (assigned_member_id IS NOT NULL AND owner_issuer IS NOT NULL AND owner_subject IS NOT NULL))
 AND (status NOT IN ('SCHEDULED','IN_PROGRESS') OR
   (status='IN_PROGRESS' AND action_type='CALLBACK' AND scheduled_at IS NULL AND scheduled_end_at IS NULL)
   OR (scheduled_at IS NOT NULL AND scheduled_end_at IS NOT NULL AND scheduled_end_at>scheduled_at
       AND duration_minutes IS NOT NULL AND duration_minutes BETWEEN 5 AND 480 AND time_zone IS NOT NULL))
 AND (status<>'ASSIGNED' OR action_type='CALLBACK')
);
