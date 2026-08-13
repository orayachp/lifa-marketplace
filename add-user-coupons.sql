-- Run this AFTER add-coupons.sql.
-- Adds a "collected coupons" wallet per user, Shopee-style: a user must
-- collect a coupon into their account before it can be applied at checkout.

CREATE TABLE user_coupons (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    coupon_id       UUID NOT NULL REFERENCES coupons(id) ON DELETE CASCADE,
    collected_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    used_at         TIMESTAMPTZ,
    order_id        UUID REFERENCES orders(id),
    UNIQUE (user_id, coupon_id)
);
