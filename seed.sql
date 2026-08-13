-- Run this AFTER schema.sql, against the same Neon database.
-- Creates one demo seller and one product so /api/products returns real data.

-- Demo seller account (password is a placeholder hash — replace once you build real auth/signup)
INSERT INTO users (id, email, password_hash, role, display_name)
VALUES ('11111111-1111-1111-1111-111111111111', 'seller@lifa.demo', 'REPLACE_WITH_REAL_HASH', 'seller', 'LiFa Official Store')
ON CONFLICT (email) DO NOTHING;

INSERT INTO seller_profiles (user_id, shop_name, shop_slug, is_verified, rating_avg)
VALUES ('11111111-1111-1111-1111-111111111111', 'LiFa Official Store', 'lifa-official', TRUE, 4.9)
ON CONFLICT (user_id) DO NOTHING;

-- Demo product
INSERT INTO products (id, seller_id, category_id, name, slug, description, price, compare_at_price, stock, sold_count, rating_avg, rating_count, status)
SELECT
  '22222222-2222-2222-2222-222222222222',
  '11111111-1111-1111-1111-111111111111',
  c.id,
  'Samsung Galaxy S24 Ultra 6.8" Titanium Edition',
  'samsung-galaxy-s24-ultra-titanium',
  'Samsung Galaxy S24 Ultra ตัวท็อปแห่งปี โครงไทเทเนียมแข็งแกร่ง กล้อง 200MP ซูมได้ไกลระดับมืออาชีพ ชิป Snapdragon 8 Gen 3 for Galaxy แรงลื่นทุกการใช้งาน มาพร้อม S Pen ในตัว รับประกันศูนย์ไทย 1 ปีเต็ม',
  39990, 45900, 120, 3200, 4.9, 1274, 'active'
FROM categories c WHERE c.slug = 'mobile-tablet'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO product_images (product_id, url, sort_order) VALUES
  ('22222222-2222-2222-2222-222222222222', 'https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?w=800&q=80', 0),
  ('22222222-2222-2222-2222-222222222222', 'https://images.unsplash.com/photo-1598327105666-5b89351aff97?w=800&q=80', 1),
  ('22222222-2222-2222-2222-222222222222', 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=800&q=80', 2);

INSERT INTO product_variants (product_id, name, price_delta, stock, sku) VALUES
  ('22222222-2222-2222-2222-222222222222', 'Titanium Black / 256GB', 0, 40, 'S24U-BLK-256'),
  ('22222222-2222-2222-2222-222222222222', 'Titanium Gray / 512GB', 3000, 30, 'S24U-GRY-512'),
  ('22222222-2222-2222-2222-222222222222', 'Titanium Violet / 1TB', 7000, 20, 'S24U-VLT-1TB');
