const express = require("express");
const pool = require("../db");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth, requireRole("admin"));

// GET /api/admin/users
router.get("/users", async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, email, role, display_name, phone, is_active, created_at FROM users ORDER BY created_at DESC LIMIT 200`
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "โหลดผู้ใช้งานไม่สำเร็จ" });
  }
});

// PUT /api/admin/users/:id — { role, isActive }
router.put("/users/:id", async (req, res) => {
  const { role, isActive } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE users SET role = COALESCE($1, role), is_active = COALESCE($2, is_active), updated_at = now()
       WHERE id = $3 RETURNING id, email, role, is_active`,
      [role || null, isActive == null ? null : isActive, req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: "ไม่พบผู้ใช้นี้" });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "อัปเดตผู้ใช้ไม่สำเร็จ" });
  }
});

// GET /api/admin/products — all products, across all sellers
router.get("/products", async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT p.id, p.name, p.price, p.stock, p.status, u.display_name AS seller_name,
              (SELECT url FROM product_images pi WHERE pi.product_id = p.id ORDER BY sort_order LIMIT 1) AS image
       FROM products p JOIN users u ON u.id = p.seller_id
       ORDER BY p.created_at DESC LIMIT 300`
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "โหลดสินค้าไม่สำเร็จ" });
  }
});

// PUT /api/admin/products/:id — { status } e.g. 'banned' to take it down
router.put("/products/:id", async (req, res) => {
  const { status } = req.body;
  try {
    const { rows } = await pool.query(
      "UPDATE products SET status = $1, updated_at = now() WHERE id = $2 RETURNING id, status",
      [status, req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: "ไม่พบสินค้านี้" });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "อัปเดตสินค้าไม่สำเร็จ" });
  }
});

// GET /api/admin/orders — every order in the system
router.get("/orders", async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT o.id, o.order_no, o.grand_total, o.status, o.payment_status, o.created_at, u.display_name AS buyer_name
       FROM orders o JOIN users u ON u.id = o.buyer_id
       ORDER BY o.created_at DESC LIMIT 300`
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "โหลดคำสั่งซื้อไม่สำเร็จ" });
  }
});

module.exports = router;
