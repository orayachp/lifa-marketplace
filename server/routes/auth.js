const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const pool = require("../db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET;

function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, displayName: user.display_name },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

// POST /api/auth/register — every signup starts as a "buyer". Selling is
// opened up later from the account itself (see POST /become-seller below) —
// same as how Shopee works: one account, buy and sell both available,
// no separate "seller signup" required.
router.post("/register", async (req, res) => {
  const { email, password, displayName, phone } = req.body;
  if (!email || !password || !displayName) {
    return res.status(400).json({ error: "กรุณากรอกอีเมล รหัสผ่าน และชื่อที่ใช้แสดง" });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: "รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร" });
  }

  try {
    const existing = await pool.query("SELECT id FROM users WHERE email = $1", [email.toLowerCase()]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: "อีเมลนี้ถูกใช้สมัครแล้ว" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const { rows } = await pool.query(
      `INSERT INTO users (email, password_hash, role, display_name, phone)
       VALUES ($1, $2, 'buyer', $3, $4)
       RETURNING id, email, role, display_name, phone, avatar_url, gender, date_of_birth, bio`,
      [email.toLowerCase(), passwordHash, displayName, phone || null]
    );
    const user = rows[0];
    res.status(201).json({ token: signToken(user), user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "สมัครสมาชิกไม่สำเร็จ" });
  }
});

// POST /api/auth/become-seller — upgrades the logged-in account to also be
// a seller (doesn't remove buying ability). Creates their shop profile.
// Anyone logged in can call this on their own account — no admin approval
// step in this demo, matching Shopee's "เปิดร้านค้า" self-serve flow.
router.post("/become-seller", requireAuth, async (req, res) => {
  const { shopName } = req.body;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows: userRows } = await client.query(
      `UPDATE users SET role = 'seller', updated_at = now()
       WHERE id = $1 AND role != 'admin'
       RETURNING id, email, role, display_name, phone, avatar_url, gender, date_of_birth, bio`,
      [req.user.id]
    );
    if (userRows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "ไม่สามารถเปิดร้านค้าได้" });
    }
    const user = userRows[0];

    const { rows: existingShop } = await client.query(
      "SELECT user_id FROM seller_profiles WHERE user_id = $1", [user.id]
    );
    if (existingShop.length === 0) {
      const name = shopName || user.display_name;
      const slug = name
        .toLowerCase()
        .replace(/[^a-z0-9ก-๙\s-]/g, "")
        .trim()
        .replace(/\s+/g, "-")
        .slice(0, 100) + "-" + user.id.slice(0, 8);
      await client.query(
        `INSERT INTO seller_profiles (user_id, shop_name, shop_slug) VALUES ($1, $2, $3)`,
        [user.id, name, slug]
      );
    }

    await client.query("COMMIT");
    res.json({ token: signToken(user), user });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "เปิดร้านค้าไม่สำเร็จ" });
  } finally {
    client.release();
  }
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "กรุณากรอกอีเมลและรหัสผ่าน" });
  }

  try {
    const { rows } = await pool.query(
      "SELECT id, email, role, display_name, phone, avatar_url, gender, date_of_birth, bio, password_hash, is_active FROM users WHERE email = $1",
      [email.toLowerCase()]
    );
    const user = rows[0];
    if (!user || !user.is_active) {
      return res.status(401).json({ error: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" });
    }
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ error: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" });
    }
    delete user.password_hash;
    res.json({ token: signToken(user), user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "เข้าสู่ระบบไม่สำเร็จ" });
  }
});

// GET /api/auth/me — used on app load to check if a stored token is still valid
router.get("/me", requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT id, email, role, display_name, phone, avatar_url, gender, date_of_birth, bio FROM users WHERE id = $1",
      [req.user.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: "User not found" });
    res.json({ user: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load user" });
  }
});

// POST /api/auth/forgot-password — { email }
// This demo has no email-sending service wired up, so instead of emailing a
// reset link, it returns the reset token directly in the response — the
// frontend shows it on screen so the flow can still be tested end-to-end.
// In a real deployment, swap the response for "check your email" and
// actually send `resetToken` via an email provider instead.
router.post("/forgot-password", async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "กรุณากรอกอีเมล" });

  try {
    const { rows } = await pool.query("SELECT id FROM users WHERE email = $1", [email.toLowerCase()]);
    if (rows.length === 0) {
      // Don't reveal whether the email exists — but for the demo we still
      // need *some* response to test with, so we say it plainly here.
      return res.status(404).json({ error: "ไม่พบบัญชีที่ใช้อีเมลนี้" });
    }

    const token = crypto.randomBytes(24).toString("hex");
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await pool.query(
      "UPDATE users SET reset_token = $1, reset_token_expires = $2 WHERE id = $3",
      [token, expires, rows[0].id]
    );

    res.json({
      ok: true,
      resetToken: token, // demo-only: a real app emails this instead of returning it
      note: "ระบบยังไม่ได้เชื่อมกับผู้ให้บริการอีเมล จึงแสดงโทเค็นนี้ไว้ให้ทดสอบโดยตรง",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "ส่งคำขอไม่สำเร็จ" });
  }
});

// POST /api/auth/reset-password — { email, token, newPassword }
router.post("/reset-password", async (req, res) => {
  const { email, token, newPassword } = req.body;
  if (!email || !token || !newPassword) {
    return res.status(400).json({ error: "กรุณากรอกข้อมูลให้ครบ" });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ error: "รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร" });
  }

  try {
    const { rows } = await pool.query(
      "SELECT id, reset_token, reset_token_expires FROM users WHERE email = $1",
      [email.toLowerCase()]
    );
    const user = rows[0];
    if (!user || !user.reset_token || user.reset_token !== token) {
      return res.status(400).json({ error: "โทเค็นไม่ถูกต้อง" });
    }
    if (new Date(user.reset_token_expires) < new Date()) {
      return res.status(400).json({ error: "โทเค็นหมดอายุแล้ว กรุณาขอใหม่" });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await pool.query(
      "UPDATE users SET password_hash = $1, reset_token = NULL, reset_token_expires = NULL, updated_at = now() WHERE id = $2",
      [passwordHash, user.id]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "ตั้งรหัสผ่านใหม่ไม่สำเร็จ" });
  }
});

module.exports = router;
