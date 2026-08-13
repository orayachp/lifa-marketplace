const express = require("express");
const pool = require("../db");

const router = express.Router();

// GET /api/shops/:slug — public shop info + their active products
router.get("/:slug", async (req, res) => {
  try {
    const { rows: shopRows } = await pool.query(
      `SELECT sp.user_id, sp.shop_name, sp.shop_slug, sp.description, sp.rating_avg, sp.rating_count, sp.is_verified
       FROM seller_profiles sp WHERE sp.shop_slug = $1`,
      [req.params.slug]
    );
    if (shopRows.length === 0) return res.status(404).json({ error: "ไม่พบร้านค้านี้" });
    const shop = shopRows[0];

    const { rows: products } = await pool.query(
      `SELECT p.id, p.name, p.slug, p.price, p.compare_at_price, p.rating_avg, p.sold_count,
              (SELECT url FROM product_images pi WHERE pi.product_id = p.id ORDER BY sort_order LIMIT 1) AS image
       FROM products p WHERE p.seller_id = $1 AND p.status = 'active' ORDER BY p.created_at DESC`,
      [shop.user_id]
    );

    res.json({ ...shop, products });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "โหลดร้านค้าไม่สำเร็จ" });
  }
});

module.exports = router;
