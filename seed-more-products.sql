-- Run this AFTER schema.sql and seed.sql — adds more products across
-- different categories so the product listing + category filter has content.

INSERT INTO products (seller_id, category_id, name, slug, description, price, compare_at_price, stock, sold_count, rating_avg, rating_count, status)
SELECT '11111111-1111-1111-1111-111111111111', c.id, v.name, v.slug, v.description, v.price, v.compare_at_price, v.stock, v.sold, v.rating, v.rating_count, 'active'
FROM (VALUES
  ('มือถือ & แท็บเล็ต', 'Apple iPhone 15 Pro Max 256GB', 'apple-iphone-15-pro-max', 'iPhone 15 Pro Max จอ 6.7 นิ้ว ชิป A17 Pro กล้อง 48MP ตัวเครื่องไทเทเนียม', 41900, 44900, 80, 2100, 4.8, 980, 5000),
  ('มือถือ & แท็บเล็ต', 'iPad Air 5 Wi-Fi 64GB', 'ipad-air-5-wifi', 'iPad Air ชิป M1 หน้าจอ Liquid Retina 10.9 นิ้ว รองรับ Apple Pencil', 18900, 21900, 60, 540, 4.7, 210, 4200),
  ('อุปกรณ์อิเล็กทรอนิกส์', 'หูฟังไร้สาย Buds Pro 2', 'buds-pro-2', 'หูฟังบลูทูธตัดเสียงรบกวน แบตอึด 24 ชม. กันน้ำ IPX4', 4290, 5990, 150, 3400, 4.6, 1523, 2200),
  ('อุปกรณ์อิเล็กทรอนิกส์', 'สมาร์ทวอทช์ GT Series', 'smartwatch-gt-series', 'นาฬิกาอัจฉริยะวัดชีพจร นับก้าว กันน้ำ แบตอยู่ได้ 14 วัน', 3590, 4590, 95, 870, 4.5, 402, 3100),
  ('อุปกรณ์อิเล็กทรอนิกส์', 'เคสกันกระแทก MagSafe', 'case-magsafe', 'เคสใสกันกระแทก รองรับ MagSafe ชาร์จไร้สายได้ปกติ', 690, 990, 300, 5200, 4.4, 1890, 400),
  ('แฟชั่น', 'กระเป๋าสะพายหนัง PU รุ่นคลาสสิก', 'leather-bag-classic', 'กระเป๋าสะพายข้างหนัง PU ทรงคลาสสิก จุของได้เยอะ เหมาะกับทุกโอกาส', 1290, 1990, 120, 640, 4.6, 310, 300),
  ('แฟชั่น', 'รองเท้าผ้าใบ Sneaker Unisex', 'sneaker-unisex', 'รองเท้าผ้าใบใส่สบาย พื้นนุ่ม ระบายอากาศดี ใส่ได้ทั้งชายหญิง', 1590, 2290, 200, 1200, 4.5, 560, 800),
  ('ความงาม', 'เซรั่มวิตามินซี บำรุงผิวหน้า', 'vitamin-c-serum', 'เซรั่มวิตามินซีเข้มข้น ช่วยให้ผิวกระจ่างใส ลดริ้วรอย', 590, 890, 400, 2800, 4.7, 1340, 500),
  ('ของใช้ในบ้าน', 'หม้อทอดไร้น้ำมัน Air Fryer 5L', 'air-fryer-5l', 'หม้อทอดไร้น้ำมันขนาด 5 ลิตร ปรับอุณหภูมิได้ ทำความสะอาดง่าย', 1990, 2990, 70, 430, 4.6, 198, 200)
) AS v(cat_name, name, slug, description, price, compare_at_price, stock, sold, rating, rating_count, sort_order)
JOIN categories c ON c.name = v.cat_name
ON CONFLICT (slug) DO NOTHING;

-- one representative image per new product (using the product's own slug to match)
INSERT INTO product_images (product_id, url, sort_order)
SELECT p.id, img.url, 0
FROM products p
JOIN (VALUES
  ('apple-iphone-15-pro-max', 'https://images.unsplash.com/photo-1592286927505-1def25115481?w=600&q=80'),
  ('ipad-air-5-wifi', 'https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=600&q=80'),
  ('buds-pro-2', 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=600&q=80'),
  ('smartwatch-gt-series', 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&q=80'),
  ('case-magsafe', 'https://images.unsplash.com/photo-1601593346740-925612772716?w=600&q=80'),
  ('leather-bag-classic', 'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?w=600&q=80'),
  ('sneaker-unisex', 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&q=80'),
  ('vitamin-c-serum', 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=600&q=80'),
  ('air-fryer-5l', 'https://images.unsplash.com/photo-1648668533851-1425e6a04a3a?w=600&q=80')
) AS img(slug, url) ON img.slug = p.slug
WHERE NOT EXISTS (SELECT 1 FROM product_images pi WHERE pi.product_id = p.id);
