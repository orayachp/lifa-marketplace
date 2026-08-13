const express = require("express");
const pool = require("../db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth);

// GET /api/wishlist — the logged-in user's saved products
router.get("/", async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT p.id, p.name, p.slug, p.price, p.compare_at_price, p.rating_avg, p.sold_count,
              (SELECT url FROM product_images pi WHERE pi.product_id = p.id ORDER BY sort_order LIMIT 1) AS image
       FROM wishlist_items w
       JOIN products p ON p.id = w.product_id
       WHERE w.user_id = $1
       ORDER BY w.created_at DESC`,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "โหลดรายการโปรดไม่สำเร็จ" });
  }
});

// POST /api/wishlist/:productId — add
router.post("/:productId", async (req, res) => {
  try {
    await pool.query(
      "INSERT INTO wishlist_items (user_id, product_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
      [req.user.id, req.params.productId]
    );
    res.status(201).json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "เพิ่มรายการโปรดไม่สำเร็จ" });
  }
});

// DELETE /api/wishlist/:productId — remove
router.delete("/:productId", async (req, res) => {
  try {
    await pool.query("DELETE FROM wishlist_items WHERE user_id = $1 AND product_id = $2", [req.user.id, req.params.productId]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "ลบรายการโปรดไม่สำเร็จ" });
  }
});

module.exports = router;
