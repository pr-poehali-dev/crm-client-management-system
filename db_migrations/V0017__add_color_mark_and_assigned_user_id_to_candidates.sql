ALTER TABLE t_p71061117_crm_client_managemen.candidates
ADD COLUMN IF NOT EXISTS color_mark TEXT DEFAULT '';

ALTER TABLE t_p71061117_crm_client_managemen.candidates
ADD COLUMN IF NOT EXISTS assigned_user_id INTEGER DEFAULT NULL;