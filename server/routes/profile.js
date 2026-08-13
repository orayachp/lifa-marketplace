const express = require("express");
const pool = require("../db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth);

// ---- Profile info -----------------------------------------------------

// PUT /api/profile — update display name / phone
router.put("/", async (req, res) => {
  const { displayName, phone } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE users SET display_name = COALESCE($1, display_name), phone = COALESCE($2, phone), updated_at = now()
       WHERE id = $3 RETURNING id, email, role, display_name, phone`,
      [displayName || null, phone || null, req.user.id]
    );
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "อัปเดตโปรไฟล์ไม่สำเร็จ" });
  }
});

// ---- Addresses ----------------------------------------------------------

// GET /api/profile/addresses
router.get("/addresses", async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, label, recipient_name, phone, line1, subdistrict, district, province, postal_code, is_default
       FROM addresses WHERE user_id = $1 ORDER BY is_default DESC, created_at DESC`,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "โหลดที่อยู่ไม่สำเร็จ" });
  }
});

// POST /api/profile/addresses
router.post("/addresses", async (req, res) => {
  const { label, recipientName, phone, line1, subdistrict, district, province, postalCode, isDefault } = req.body;
  if (!recipientName || !phone || !line1 || !province) {
    return res.status(400).json({ error: "กรุณากรอกชื่อผู้รับ เบอร์โทร ที่อยู่ และจังหวัด" });
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    if (isDefault) {
      await client.query("UPDATE addresses SET is_default = FALSE WHERE user_id = $1", [req.user.id]);
    }
    const { rows } = await client.query(
      `INSERT INTO addresses (user_id, label, recipient_name, phone, line1, subdistrict, district, province, postal_code, is_default)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [req.user.id, label || null, recipientName, phone, line1, subdistrict || null, district || null, province, postalCode || null, !!isDefault]
    );
    await client.query("COMMIT");
    res.status(201).json(rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "เพิ่มที่อยู่ไม่สำเร็จ" });
  } finally {
    client.release();
  }
});

// PUT /api/profile/addresses/:id
router.put("/addresses/:id", async (req, res) => {
  const { label, recipientName, phone, line1, subdistrict, district, province, postalCode, isDefault } = req.body;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    if (isDefault) {
      await client.query("UPDATE addresses SET is_default = FALSE WHERE user_id = $1", [req.user.id]);
    }
    const { rows } = await client.query(
      `UPDATE addresses SET
         label = COALESCE($1, label), recipient_name = COALESCE($2, recipient_name),
         phone = COALESCE($3, phone), line1 = COALESCE($4, line1),
         subdistrict = COALESCE($5, subdistrict), district = COALESCE($6, district),
         province = COALESCE($7, province), postal_code = COALESCE($8, postal_code),
         is_default = COALESCE($9, is_default)
       WHERE id = $10 AND user_id = $11 RETURNING *`,
      [label, recipientName, phone, line1, subdistrict, district, province, postalCode, isDefault, req.params.id, req.user.id]
    );
    if (rows.length === 0) { await client.query("ROLLBACK"); return res.status(404).json({ error: "ไม่พบที่อยู่นี้" }); }
    await client.query("COMMIT");
    res.json(rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "แก้ไขที่อยู่ไม่สำเร็จ" });
  } finally {
    client.release();
  }
});

// DELETE /api/profile/addresses/:id
router.delete("/addresses/:id", async (req, res) => {
  try {
    const { rows } = await pool.query(
      "DELETE FROM addresses WHERE id = $1 AND user_id = $2 RETURNING id",
      [req.params.id, req.user.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: "ไม่พบที่อยู่นี้" });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "ลบที่อยู่ไม่สำเร็จ" });
  }
});

// ---- Saved cards (test mode — masked only) ------------------------------

function detectBrand(cardNumber) {
  const digits = cardNumber.replace(/\D/g, "");
  if (digits.startsWith("4")) return "Visa";
  if (/^5[1-5]/.test(digits)) return "Mastercard";
  if (/^3[47]/.test(digits)) return "American Express";
  return "Card";
}

// GET /api/profile/cards
router.get("/cards", async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT id, brand, last4, cardholder_name, expiry, is_default FROM payment_methods WHERE user_id = $1 ORDER BY is_default DESC, created_at DESC",
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "โหลดบัตรไม่สำเร็จ" });
  }
});

// POST /api/profile/cards — body: { cardNumber, cardholderName, expiry, isDefault }
// TEST MODE: cardNumber is never stored — only brand + last 4 digits are kept.
router.post("/cards", async (req, res) => {
  const { cardNumber, cardholderName, expiry, isDefault } = req.body;
  const digits = (cardNumber || "").replace(/\D/g, "");
  if (digits.length < 12 || !cardholderName || !expiry) {
    return res.status(400).json({ error: "กรุณากรอกข้อมูลบัตรให้ครบ" });
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    if (isDefault) {
      await client.query("UPDATE payment_methods SET is_default = FALSE WHERE user_id = $1", [req.user.id]);
    }
    const { rows } = await client.query(
      `INSERT INTO payment_methods (user_id, brand, last4, cardholder_name, expiry, is_default)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, brand, last4, cardholder_name, expiry, is_default`,
      [req.user.id, detectBrand(digits), digits.slice(-4), cardholderName, expiry, !!isDefault]
    );
    await client.query("COMMIT");
    res.status(201).json(rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "บันทึกบัตรไม่สำเร็จ" });
  } finally {
    client.release();
  }
});

// DELETE /api/profile/cards/:id
router.delete("/cards/:id", async (req, res) => {
  try {
    const { rows } = await pool.query(
      "DELETE FROM payment_methods WHERE id = $1 AND user_id = $2 RETURNING id",
      [req.params.id, req.user.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: "ไม่พบบัตรนี้" });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "ลบบัตรไม่สำเร็จ" });
  }
});

module.exports = router;
