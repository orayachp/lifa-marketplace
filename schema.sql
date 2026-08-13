-- =====================================================================
-- LIFA MARKETPLACE — PostgreSQL schema
-- Run this against your Neon database, e.g.:
--   psql "postgresql://neondb_owner:***@ep-red-firefly-zadni1a3-pooler.c-2.eu-west-2.aws.neon.tech/neondb?sslmode=require" -f schema.sql
-- =====================================================================

-- Extensions -----------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto"; -- for gen_random_uuid()

-- Enums ------------------------------------------------------------------
CREATE TYPE user_role        AS ENUM ('admin', 'seller', 'buyer');
CREATE TYPE product_status   AS ENUM ('draft', 'active', 'out_of_stock', 'banned');
CREATE TYPE order_status     AS ENUM ('pending', 'paid', 'packed', 'shipped', 'delivered', 'cancelled', 'refunded');
CREATE TYPE payment_status   AS ENUM ('pending', 'paid', 'failed', 'refunded');
CREATE TYPE payment_method   AS ENUM ('credit_card', 'promptpay', 'bank_transfer', 'cod', 'wallet');

-- Users (admin / seller / buyer share one table, split by role) ----------
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           VARCHAR(255) UNIQUE NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,
    role            user_role NOT NULL DEFAULT 'buyer',
    display_name    VARCHAR(150) NOT NULL,
    phone           VARCHAR(30),
    avatar_url      TEXT,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seller profile (extra info only sellers need) ---------------------------
CREATE TABLE seller_profiles (
    user_id         UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    shop_name       VARCHAR(150) NOT NULL,
    shop_slug       VARCHAR(150) UNIQUE NOT NULL,
    shop_logo_url   TEXT,
    description     TEXT,
    rating_avg      NUMERIC(3,2) DEFAULT 0,
    rating_count    INTEGER DEFAULT 0,
    is_verified     BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Addresses ----------------------------------------------------------------
CREATE TABLE addresses (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    label           VARCHAR(50),           -- e.g. "Home", "Office"
    recipient_name  VARCHAR(150) NOT NULL,
    phone           VARCHAR(30) NOT NULL,
    line1           TEXT NOT NULL,
    subdistrict     VARCHAR(100),
    district        VARCHAR(100),
    province        VARCHAR(100),
    postal_code     VARCHAR(20),
    is_default      BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Categories (self-referencing for sub-categories) -------------------------
CREATE TABLE categories (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_id       UUID REFERENCES categories(id) ON DELETE SET NULL,
    name            VARCHAR(150) NOT NULL,
    slug            VARCHAR(150) UNIQUE NOT NULL,
    icon_url        TEXT,
    sort_order      INTEGER DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Products -------------------------------------------------------------------
CREATE TABLE products (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category_id     UUID REFERENCES categories(id) ON DELETE SET NULL,
    name            VARCHAR(255) NOT NULL,
    slug            VARCHAR(255) UNIQUE NOT NULL,
    description     TEXT,
    price           NUMERIC(12,2) NOT NULL CHECK (price >= 0),
    compare_at_price NUMERIC(12,2),          -- "was" price, for showing discount
    stock           INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
    sold_count      INTEGER NOT NULL DEFAULT 0,
    rating_avg      NUMERIC(3,2) DEFAULT 0,
    rating_count    INTEGER DEFAULT 0,
    status          product_status NOT NULL DEFAULT 'draft',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_seller   ON products(seller_id);
CREATE INDEX idx_products_status   ON products(status);

-- Product images (multiple per product) -------------------------------------
CREATE TABLE product_images (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id      UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    url             TEXT NOT NULL,
    sort_order      INTEGER DEFAULT 0
);

-- Product variants (e.g. color / size / storage) -----------------------------
CREATE TABLE product_variants (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id      UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    name            VARCHAR(150) NOT NULL,   -- e.g. "Titanium Black / 256GB"
    price_delta     NUMERIC(12,2) NOT NULL DEFAULT 0,
    stock           INTEGER NOT NULL DEFAULT 0,
    sku             VARCHAR(100)
);

-- Cart & cart items ------------------------------------------------------------
CREATE TABLE carts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE cart_items (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cart_id         UUID NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
    product_id      UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    variant_id      UUID REFERENCES product_variants(id) ON DELETE SET NULL,
    quantity        INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
    added_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (cart_id, product_id, variant_id)
);

-- Orders & order items ----------------------------------------------------------
CREATE TABLE orders (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_no        VARCHAR(30) UNIQUE NOT NULL,   -- human-readable e.g. LF-20260807-0001
    buyer_id        UUID NOT NULL REFERENCES users(id),
    shipping_address_id UUID REFERENCES addresses(id),
    subtotal        NUMERIC(12,2) NOT NULL,
    shipping_fee    NUMERIC(12,2) NOT NULL DEFAULT 0,
    discount_total  NUMERIC(12,2) NOT NULL DEFAULT 0,
    grand_total     NUMERIC(12,2) NOT NULL,
    status          order_status NOT NULL DEFAULT 'pending',
    payment_status  payment_status NOT NULL DEFAULT 'pending',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE order_items (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id        UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id      UUID NOT NULL REFERENCES products(id),
    seller_id       UUID NOT NULL REFERENCES users(id),
    variant_id      UUID REFERENCES product_variants(id),
    product_name    VARCHAR(255) NOT NULL,   -- snapshot at time of order
    unit_price      NUMERIC(12,2) NOT NULL,
    quantity        INTEGER NOT NULL CHECK (quantity > 0),
    line_total      NUMERIC(12,2) NOT NULL
);

-- Payments ------------------------------------------------------------------------
CREATE TABLE payments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id        UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    method          payment_method NOT NULL,
    amount          NUMERIC(12,2) NOT NULL,
    status          payment_status NOT NULL DEFAULT 'pending',
    transaction_ref VARCHAR(255),
    paid_at         TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Reviews ---------------------------------------------------------------------------
CREATE TABLE reviews (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id      UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    buyer_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    order_item_id   UUID REFERENCES order_items(id),
    rating          SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment         TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed: a couple of top-level categories to start with ------------------------------
INSERT INTO categories (name, slug) VALUES
    ('มือถือ & แท็บเล็ต', 'mobile-tablet'),
    ('แฟชั่น', 'fashion'),
    ('อุปกรณ์อิเล็กทรอนิกส์', 'electronics'),
    ('ความงาม', 'beauty'),
    ('ของใช้ในบ้าน', 'home');
