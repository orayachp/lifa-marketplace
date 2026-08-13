const express = require("express");
const pool = require("../db");

const router = express.Router();

// GET /api/products — list products, optionally filtered by category and/or search query
// e.g. /api/products?category=mobile-tablet&q=samsung
router.get("/", async (req, res) => {
  try {
    const { category, q } = req.query;
    const params = [];
    let where = "WHERE p.status = 'active'";
    if (category) {
      params.push(category);
      where += ` AND c.slug = $${params.length}`;
    }
    if (q) {
      params.push(`%${q}%`);
      where += ` AND (p.name ILIKE $${params.length} OR p.description ILIKE $${params.length})`;
    }

    const { rows } = await pool.query(
      `SELECT p.id, p.name, p.slug, p.price, p.compare_at_price, p.rating_avg,
              p.rating_count, p.sold_count, c.slug AS category_slug, c.name AS category_name,
              (SELECT url FROM product_images pi WHERE pi.product_id = p.id ORDER BY sort_order LIMIT 1) AS image
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       ${where}
       ORDER BY p.created_at DESC
       LIMIT 60`,
      params
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch products" });
  }
});

// GET /api/products/:slug — full product detail page data
router.get("/:slug", async (req, res) => {
  try {
    const { rows: productRows } = await pool.query(
      `SELECT p.*, u.display_name AS seller_name, sp.shop_name, sp.shop_slug, sp.rating_avg AS shop_rating,
              sp.is_verified AS shop_verified
       FROM products p
       JOIN users u ON u.id = p.seller_id
       LEFT JOIN seller_profiles sp ON sp.user_id = p.seller_id
       WHERE p.slug = $1`,
      [req.params.slug]
    );
    if (productRows.length === 0) {
      return res.status(404).json({ error: "Product not found" });
    }
    const product = productRows[0];

    const { rows: images } = await pool.query(
      "SELECT url FROM product_images WHERE product_id = $1 ORDER BY sort_order",
      [product.id]
    );
    const { rows: variants } = await pool.query(
      "SELECT id, name, price_delta, stock, sku FROM product_variants WHERE product_id = $1",
      [product.id]
    );

    res.json({ ...product, images: images.map((i) => i.url), variants });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch product" });
  }
});

module.exports = router;
