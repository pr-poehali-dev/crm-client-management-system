CREATE TABLE IF NOT EXISTS t_p71061117_crm_client_managemen.push_subscriptions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    endpoint TEXT NOT NULL,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, endpoint)
);