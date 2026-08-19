const express = require("express");
const pool = require("../db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth);

// GET /api/notifications — recent notifications for the logged-in user
router.get("/", async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT id, type, title, body, link_view, read_at, created_at FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50",
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "โหลดการแจ้งเตือนไม่สำเร็จ" });
  }
});

// GET /api/notifications/unread-count
router.get("/unread-count", async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT COUNT(*) AS count FROM notifications WHERE user_id = $1 AND read_at IS NULL",
      [req.user.id]
    );
    res.json({ count: Number(rows[0].count) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "โหลดจำนวนการแจ้งเตือนไม่สำเร็จ" });
  }
});

// PUT /api/notifications/read-all — marks everything read (called when the panel opens)
router.put("/read-all", async (req, res) => {
  try {
    await pool.query("UPDATE notifications SET read_at = now() WHERE user_id = $1 AND read_at IS NULL", [req.user.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "อัปเดตการแจ้งเตือนไม่สำเร็จ" });
  }
});

module.exports = router;
