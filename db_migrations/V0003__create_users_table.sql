CREATE TABLE t_p71061117_crm_client_managemen.users (
    id bigserial PRIMARY KEY,
    login text NOT NULL UNIQUE,
    password_hash text NOT NULL,
    full_name text NOT NULL DEFAULT '',
    role text NOT NULL DEFAULT 'employee' CHECK (role IN ('admin', 'employee')),
    created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO t_p71061117_crm_client_managemen.users (login, password_hash, full_name, role)
VALUES ('admin', md5('admin123'), 'Администратор', 'admin');