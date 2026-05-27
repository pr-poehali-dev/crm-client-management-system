CREATE TABLE t_p71061117_crm_client_managemen.announcements (
  id SERIAL PRIMARY KEY,
  author_id INTEGER NOT NULL,
  author_name VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);