CREATE TABLE t_p71061117_crm_client_managemen.call_log (
    id BIGSERIAL PRIMARY KEY,
    candidate_id BIGINT NOT NULL,
    user_id BIGINT,
    user_name TEXT NOT NULL DEFAULT '',
    called_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    result TEXT NOT NULL DEFAULT '',
    comment TEXT NOT NULL DEFAULT ''
);

CREATE INDEX idx_call_log_candidate_id ON t_p71061117_crm_client_managemen.call_log(candidate_id);
CREATE INDEX idx_call_log_called_at ON t_p71061117_crm_client_managemen.call_log(called_at DESC);