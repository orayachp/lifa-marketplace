const express = require("express");
const pool = require("../db");

const router = express.Router();

// GET /api/categories — list all categories
router.get("/", async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT id, name, slug, parent_id, icon_url FROM categories ORDER BY sort_order, name"
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch categories" });
  }
});

module.exports = router;
