const express = require("express");
const pool = require("../db");
const { requireAuth, optionalAuth } = require("../middleware/auth");

const router = express.Router();

// GET /api/reviews/product/:productId — public, list reviews for a product
router.get("/product/:productId", async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT r.id, r.rating, r.comment, r.created_at, u.display_name AS buyer_name
       FROM reviews r JOIN users u ON u.id = r.buyer_id
       WHERE r.product_id = $1 ORDER BY r.created_at DESC LIMIT 50`,
      [req.params.productId]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "โหลดรีวิวไม่สำเร็จ" });
  }
});

// GET /api/reviews/mine/:productId — optional auth, tells the frontend whether
// this user already reviewed the product (so it can hide the form).
router.get("/mine/:productId", optionalAuth, async (req, res) => {
  if (!req.user) return res.json({ reviewed: false });
  try {
    const { rows } = await pool.query(
      "SELECT id FROM reviews WHERE product_id = $1 AND buyer_id = $2",
      [req.params.productId, req.user.id]
    );
    res.json({ reviewed: rows.length > 0 });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "เช็ครีวิวไม่สำเร็จ" });
  }
});

// POST /api/reviews — { productId, rating, comment }
router.post("/", requireAuth, async (req, res) => {
  const { productId, rating, comment } = req.body;
  if (!productId || !rating || rating < 1 || rating > 5) {
    return res.status(400).json({ error: "กรุณาให้คะแนน 1-5 ดาว" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows: existing } = await client.query(
      "SELECT id FROM reviews WHERE product_id = $1 AND buyer_id = $2",
      [productId, req.user.id]
    );
    if (existing.length > 0) {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "คุณรีวิวสินค้านี้ไปแล้ว" });
    }

    await client.query(
      "INSERT INTO reviews (product_id, buyer_id, rating, comment) VALUES ($1, $2, $3, $4)",
      [productId, req.user.id, rating, comment || null]
    );

    // recompute the product's aggregate rating
    await client.query(
      `UPDATE products SET
         rating_count = (SELECT COUNT(*) FROM reviews WHERE product_id = $1),
         rating_avg = (SELECT ROUND(AVG(rating)::numeric, 2) FROM reviews WHERE product_id = $1)
       WHERE id = $1`,
      [productId]
    );

    await client.query("COMMIT");
    res.status(201).json({ ok: true });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "ส่งรีวิวไม่สำเร็จ" });
  } finally {
    client.release();
  }
});

module.exports = router;
