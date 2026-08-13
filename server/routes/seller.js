const express = require("express");
const path = require("path");
const crypto = require("crypto");
const multer = require("multer");
const pool = require("../db");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth, requireRole("seller", "admin"));

// --- Image upload (local disk storage — files land in server/uploads/) ---
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, "..", "uploads")),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || ".jpg";
    cb(null, `${Date.now()}-${crypto.randomBytes(6).toString("hex")}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (!/^image\/(jpeg|png|webp|gif)$/.test(file.mimetype)) {
      return cb(new Error("รองรับเฉพาะไฟล์รูปภาพ (jpg, png, webp, gif)"));
    }
    cb(null, true);
  },
});

// POST /api/seller/upload-images — multipart/form-data, field name "images" (up to 5)
// Returns an array of public URLs to store in product_images.
router.post("/upload-images", (req, res) => {
  upload.array("images", 5)(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message || "อัปโหลดรูปไม่สำเร็จ" });
    if (!req.files || req.files.length === 0) return res.status(400).json({ error: "ไม่พบไฟล์รูปภาพ" });
    const base = process.env.PUBLIC_URL || `http://localhost:${process.env.PORT || 4000}`;
    res.json({ urls: req.files.map((f) => `${base}/uploads/${f.filename}`) });
  });
});

// Kept for backwards compatibility — single-image upload.
router.post("/upload-image", (req, res) => {
  upload.single("image")(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message || "อัปโหลดรูปไม่สำเร็จ" });
    if (!req.file) return res.status(400).json({ error: "ไม่พบไฟล์รูปภาพ" });
    const base = process.env.PUBLIC_URL || `http://localhost:${process.env.PORT || 4000}`;
    res.json({ url: `${base}/uploads/${req.file.filename}` });
  });
});

function slugify(name) {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9ก-๙\s-]/g, "")
      .replace(/\s+/g, "-")
      .slice(0, 80) + "-" + Math.random().toString(36).slice(2, 7)
  );
}

// GET /api/seller/products — this seller's own products
router.get("/products", async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT p.id, p.name, p.slug, p.price, p.stock, p.status, p.sold_count, c.name AS category_name,
              (SELECT url FROM product_images pi WHERE pi.product_id = p.id ORDER BY sort_order LIMIT 1) AS image
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       WHERE p.seller_id = $1
       ORDER BY p.created_at DESC`,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "โหลดรายการสินค้าไม่สำเร็จ" });
  }
});

// POST /api/seller/products — create a new product
// body: { name, description, price, compareAtPrice, stock, categoryId, images: [url,...] }
router.post("/products", async (req, res) => {
  const { name, description, price, compareAtPrice, stock, categoryId, images } = req.body;
  if (!name || price == null || stock == null) {
    return res.status(400).json({ error: "กรุณากรอกชื่อสินค้า ราคา และจำนวนสต็อก" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      `INSERT INTO products (seller_id, category_id, name, slug, description, price, compare_at_price, stock, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'active')
       RETURNING id, name, slug, price, stock, status`,
      [req.user.id, categoryId || null, name, slugify(name), description || "", price, compareAtPrice || null, stock]
    );
    const product = rows[0];

    const imgList = Array.isArray(images) && images.length > 0 ? images : [
      "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&q=80",
    ];
    for (let i = 0; i < imgList.length; i++) {
      await client.query(
        "INSERT INTO product_images (product_id, url, sort_order) VALUES ($1, $2, $3)",
        [product.id, imgList[i], i]
      );
    }

    await client.query("COMMIT");
    res.status(201).json(product);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "เพิ่มสินค้าไม่สำเร็จ" });
  } finally {
    client.release();
  }
});

// PUT /api/seller/products/:id — edit own product (price, stock, status, description)
router.put("/products/:id", async (req, res) => {
  const { name, description, price, stock, status } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE products SET
         name = COALESCE($1, name),
         description = COALESCE($2, description),
         price = COALESCE($3, price),
         stock = COALESCE($4, stock),
         status = COALESCE($5, status),
         updated_at = now()
       WHERE id = $6 AND seller_id = $7
       RETURNING id, name, price, stock, status`,
      [name, description, price, stock, status, req.params.id, req.user.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: "ไม่พบสินค้านี้ในร้านของคุณ" });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "แก้ไขสินค้าไม่สำเร็จ" });
  }
});

// DELETE /api/seller/products/:id — soft-delete (marks as draft, keeps order history intact)
router.delete("/products/:id", async (req, res) => {
  try {
    const { rows } = await pool.query(
      `UPDATE products SET status = 'draft', updated_at = now()
       WHERE id = $1 AND seller_id = $2 RETURNING id`,
      [req.params.id, req.user.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: "ไม่พบสินค้านี้ในร้านของคุณ" });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "ลบสินค้าไม่สำเร็จ" });
  }
});

// GET /api/seller/orders — order items sold by this seller
router.get("/orders", async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT oi.id, oi.product_name, oi.unit_price, oi.quantity, oi.line_total,
              o.id AS order_id, o.order_no, o.status, o.created_at, o.payment_status
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       WHERE oi.seller_id = $1
       ORDER BY o.created_at DESC
       LIMIT 100`,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "โหลดคำสั่งซื้อไม่สำเร็จ" });
  }
});

// PUT /api/seller/orders/:orderId/status — { status: 'packed'|'shipped'|'delivered'|... }
// Only allowed if this seller has at least one item in the order.
router.put("/orders/:orderId/status", async (req, res) => {
  const { status } = req.body;
  const allowed = ["packed", "shipped", "delivered", "cancelled"];
  if (!allowed.includes(status)) {
    return res.status(400).json({ error: "สถานะไม่ถูกต้อง" });
  }
  try {
    const { rows: owned } = await pool.query(
      "SELECT 1 FROM order_items WHERE order_id = $1 AND seller_id = $2 LIMIT 1",
      [req.params.orderId, req.user.id]
    );
    if (owned.length === 0) return res.status(404).json({ error: "ไม่พบคำสั่งซื้อนี้ในร้านของคุณ" });

    const { rows } = await pool.query(
      "UPDATE orders SET status = $1, updated_at = now() WHERE id = $2 RETURNING id, order_no, status",
      [status, req.params.orderId]
    );
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "อัปเดตสถานะไม่สำเร็จ" });
  }
});

module.exports = router;
