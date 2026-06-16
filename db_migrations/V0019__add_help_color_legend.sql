ALTER TABLE t_p71061117_crm_client_managemen.help_sections
ADD COLUMN IF NOT EXISTS section_type TEXT NOT NULL DEFAULT 'list';

CREATE TABLE IF NOT EXISTS t_p71061117_crm_client_managemen.help_color_legend (
  id SERIAL PRIMARY KEY,
  section_id INTEGER NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  color TEXT NOT NULL DEFAULT '#3b82f6',
  label TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT ''
);
