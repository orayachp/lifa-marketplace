-- Run this AFTER schema.sql (and seed files, order doesn't matter for this one).
-- Adds a coupons table and a couple of demo codes to test with.

CREATE TYPE discount_type AS ENUM ('percent', 'fixed');

CREATE TABLE coupons (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code            VARCHAR(50) UNIQUE NOT NULL,
    description     VARCHAR(255),
    discount_type   discount_type NOT NULL,
    discount_value  NUMERIC(12,2) NOT NULL,       -- 10 means 10% if percent, or ฿10 if fixed
    min_order_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    max_discount    NUMERIC(12,2),                -- cap for percent-type coupons, optional
    max_uses        INTEGER,                      -- null = unlimited
    used_count      INTEGER NOT NULL DEFAULT 0,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    expires_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Demo coupons to test with in the checkout page:
INSERT INTO coupons (code, description, discount_type, discount_value, min_order_amount, max_discount, max_uses, expires_at) VALUES
    ('LIFA10',   'ลด 10% สูงสุด ฿500',         'percent', 10,  0,    500,  NULL, now() + interval '90 days'),
    ('SAVE100',  'ลด ฿100 เมื่อซื้อครบ ฿500',   'fixed',   100, 500,  NULL, NULL, now() + interval '90 days'),
    ('WELCOME50','ลด ฿50 สำหรับลูกค้าใหม่',      'fixed',   50,  0,    NULL, 100,  now() + interval '30 days');
