UPDATE t_p71061117_crm_client_managemen.candidates
SET assigned_user_id = u.id
FROM t_p71061117_crm_client_managemen.users u
WHERE t_p71061117_crm_client_managemen.candidates.is_lead = true
  AND t_p71061117_crm_client_managemen.candidates.assigned_user_id IS NULL
  AND t_p71061117_crm_client_managemen.candidates.assigned_to != ''
  AND u.full_name = t_p71061117_crm_client_managemen.candidates.assigned_to;