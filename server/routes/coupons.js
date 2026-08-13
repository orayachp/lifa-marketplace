const express = require("express");
const pool = require("../db");
const { requireAuth, optionalAuth } = require("../middleware/auth");

const router = express.Router();

// GET /api/coupons — browse all active, non-expired coupons.
// Works for guests too; if logged in, each coupon also says whether this
// user has already collected it (Shopee-style "เก็บแล้ว" state).
router.get("/", optionalAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, code, description, discount_type, discount_value, min_order_amount,
              max_discount, expires_at
       FROM coupons
       WHERE is_active = TRUE
         AND (expires_at IS NULL OR expires_at > now())
         AND (max_uses IS NULL OR used_count < max_uses)
       ORDER BY created_at DESC`
    );

    if (!req.user) {
      return res.json(rows.map((c) => ({ ...c, collected: false })));
    }

    const { rows: collected } = await pool.query(
      "SELECT coupon_id FROM user_coupons WHERE user_id = $1",
      [req.user.id]
    );
    const collectedIds = new Set(collected.map((c) => c.coupon_id));
    res.json(rows.map((c) => ({ ...c, collected: collectedIds.has(c.id) })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "โหลดคูปองไม่สำเร็จ" });
  }
});

// POST /api/coupons/:id/collect — save a coupon into the logged-in user's wallet.
router.post("/:id/collect", requireAuth, async (req, res) => {
  try {
    const { rows: couponRows } = await pool.query(
      "SELECT id FROM coupons WHERE id = $1 AND is_active = TRUE",
      [req.params.id]
    );
    if (couponRows.length === 0) return res.status(404).json({ error: "ไม่พบคูปองนี้" });

    await pool.query(
      `INSERT INTO user_coupons (user_id, coupon_id) VALUES ($1, $2)
       ON CONFLICT (user_id, coupon_id) DO NOTHING`,
      [req.user.id, req.params.id]
    );
    res.status(201).json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "เก็บคูปองไม่สำเร็จ" });
  }
});

// GET /api/coupons/mine — the logged-in user's collected coupons (used + unused).
router.get("/mine", requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT uc.id AS user_coupon_id, uc.used_at, c.id AS coupon_id, c.code, c.description,
              c.discount_type, c.discount_value, c.min_order_amount, c.max_discount, c.expires_at
       FROM user_coupons uc
       JOIN coupons c ON c.id = uc.coupon_id
       WHERE uc.user_id = $1
       ORDER BY uc.collected_at DESC`,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "โหลดคูปองของฉันไม่สำเร็จ" });
  }
});

// POST /api/coupons/validate — { code, subtotal } -> { valid, discountAmount, description }
// Requires login, AND requires the coupon to already be collected + unused —
// same rule Shopee uses: you must collect a coupon before you can apply it.
router.post("/validate", requireAuth, async (req, res) => {
  const { code, subtotal } = req.body;
  if (!code || subtotal == null) {
    return res.status(400).json({ error: "ต้องระบุรหัสคูปองและยอดรวมสินค้า" });
  }

  try {
    const { rows } = await pool.query("SELECT * FROM coupons WHERE code = $1", [code.trim().toUpperCase()]);
    const coupon = rows[0];
    if (!coupon) return res.status(404).json({ error: "ไม่พบรหัสคูปองนี้" });

    const { rows: ucRows } = await pool.query(
      "SELECT * FROM user_coupons WHERE user_id = $1 AND coupon_id = $2",
      [req.user.id, coupon.id]
    );
    const userCoupon = ucRows[0];
    if (!userCoupon) {
      return res.status(400).json({ error: "กรุณาเก็บคูปองนี้ก่อนใช้งาน (ไปที่หน้าคูปอง)" });
    }
    if (userCoupon.used_at) {
      return res.status(400).json({ error: "คุณใช้คูปองนี้ไปแล้ว" });
    }

    if (!coupon.is_active) return res.status(400).json({ error: "คูปองนี้ถูกปิดใช้งานแล้ว" });
    if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
      return res.status(400).json({ error: "คูปองนี้หมดอายุแล้ว" });
    }
    if (coupon.max_uses != null && coupon.used_count >= coupon.max_uses) {
      return res.status(400).json({ error: "คูปองนี้ถูกใช้ครบจำนวนแล้ว" });
    }
    if (Number(subtotal) < Number(coupon.min_order_amount)) {
      return res.status(400).json({
        error: `ต้องซื้อขั้นต่ำ ฿${Number(coupon.min_order_amount).toLocaleString("th-TH")} เพื่อใช้คูปองนี้`,
      });
    }

    let discountAmount =
      coupon.discount_type === "percent"
        ? (Number(subtotal) * Number(coupon.discount_value)) / 100
        : Number(coupon.discount_value);

    if (coupon.max_discount != null) {
      discountAmount = Math.min(discountAmount, Number(coupon.max_discount));
    }
    discountAmount = Math.min(discountAmount, Number(subtotal));

    res.json({
      valid: true,
      code: coupon.code,
      description: coupon.description,
      discountAmount: Math.round(discountAmount * 100) / 100,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "ตรวจสอบคูปองไม่สำเร็จ" });
  }
});

module.exports = router;
