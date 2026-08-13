-- Run this after schema.sql. The addresses table already exists in
-- schema.sql — this file only adds saved payment methods (cards).
--
-- Test-mode note: only the card brand, last 4 digits, expiry, and
-- cardholder name are stored — never the full card number or CVV, even
-- though this is a demo. That's standard practice for any real payment
-- system (the full number lives with the payment processor, not your DB).

CREATE TABLE payment_methods (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    brand           VARCHAR(30) NOT NULL,      -- 'Visa', 'Mastercard', etc. (detected from first digit)
    last4           VARCHAR(4) NOT NULL,
    cardholder_name VARCHAR(150) NOT NULL,
    expiry          VARCHAR(5) NOT NULL,       -- "MM/YY"
    is_default      BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
