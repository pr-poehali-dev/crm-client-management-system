CREATE TABLE t_p71061117_crm_client_managemen.sessions (
    id bigserial PRIMARY KEY,
    user_id bigint NOT NULL REFERENCES t_p71061117_crm_client_managemen.users(id),
    token text NOT NULL UNIQUE,
    expires_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);