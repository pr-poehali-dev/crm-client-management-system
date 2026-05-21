
CREATE TABLE t_p71061117_crm_client_managemen.candidates (
    id BIGSERIAL PRIMARY KEY,
    full_name TEXT NOT NULL,
    age TEXT,
    criminal_record TEXT DEFAULT '',
    chronic_diseases TEXT DEFAULT '',
    dispensary_record TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    doc_photos JSONB DEFAULT '[]',
    relation_photos JSONB DEFAULT '[]',
    tickets JSONB DEFAULT '[]',
    contract_photos JSONB DEFAULT '[]',
    employee_name TEXT DEFAULT '',
    created_at DATE DEFAULT CURRENT_DATE
);
