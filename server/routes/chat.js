const express = require("express");
const pool = require("../db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth);

// POST /api/chat/start — { sellerId, productId? } -> finds or creates the
// conversation between the current user (as buyer) and that seller.
// Each product gets its own thread — asking about a different product opens
// a separate conversation, not the same one as before.
router.post("/start", async (req, res) => {
  const { sellerId, productId } = req.body;
  if (!sellerId) return res.status(400).json({ error: "ต้องระบุร้านค้าที่จะแชทด้วย" });
  if (sellerId === req.user.id) return res.status(400).json({ error: "แชทกับร้านของตัวเองไม่ได้" });

  try {
    const { rows: existing } = await pool.query(
      "SELECT id FROM chat_conversations WHERE buyer_id = $1 AND seller_id = $2 AND product_id IS NOT DISTINCT FROM $3",
      [req.user.id, sellerId, productId || null]
    );
    if (existing.length > 0) {
      return res.json({ conversationId: existing[0].id });
    }
    const { rows } = await pool.query(
      "INSERT INTO chat_conversations (buyer_id, seller_id, product_id) VALUES ($1, $2, $3) RETURNING id",
      [req.user.id, sellerId, productId || null]
    );
    res.status(201).json({ conversationId: rows[0].id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "เริ่มแชทไม่สำเร็จ" });
  }
});

// GET /api/chat/conversations — inbox: every conversation this user is part of
// (as buyer or as seller), with the other party's name, last message, and
// the product currently pinned to the conversation (if any).
router.get("/conversations", async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT c.id, c.buyer_id, c.seller_id,
              CASE WHEN c.buyer_id = $1 THEN sp.shop_name ELSE bu.display_name END AS other_name,
              lm.body AS last_message, lm.created_at AS last_message_at,
              p.id AS product_id, p.slug AS product_slug, p.name AS product_name, p.price AS product_price,
              (SELECT url FROM product_images pi WHERE pi.product_id = p.id ORDER BY sort_order LIMIT 1) AS product_image,
              (SELECT COUNT(*) FROM chat_messages m WHERE m.conversation_id = c.id AND m.sender_id != $1 AND m.read_at IS NULL) AS unread_count
       FROM chat_conversations c
       JOIN users bu ON bu.id = c.buyer_id
       LEFT JOIN seller_profiles sp ON sp.user_id = c.seller_id
       LEFT JOIN products p ON p.id = c.product_id
       LEFT JOIN LATERAL (
         SELECT body, created_at FROM chat_messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1
       ) lm ON true
       WHERE c.buyer_id = $1 OR c.seller_id = $1
       ORDER BY lm.created_at DESC NULLS LAST, c.created_at DESC`,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "โหลดรายการแชทไม่สำเร็จ" });
  }
});

// GET /api/chat/unread-count — total unread messages across all conversations.
// Lightweight, meant to be polled from anywhere in the app for a header badge.
router.get("/unread-count", async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT COUNT(*) AS count FROM chat_messages m
       JOIN chat_conversations c ON c.id = m.conversation_id
       WHERE (c.buyer_id = $1 OR c.seller_id = $1) AND m.sender_id != $1 AND m.read_at IS NULL`,
      [req.user.id]
    );
    res.json({ count: Number(rows[0].count) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "โหลดจำนวนข้อความไม่สำเร็จ" });
  }
});

// Small helper — throws-equivalent check that the user belongs to a conversation.
async function assertParticipant(conversationId, userId) {
  const { rows } = await pool.query(
    "SELECT buyer_id, seller_id, product_id FROM chat_conversations WHERE id = $1",
    [conversationId]
  );
  if (rows.length === 0) return null;
  const convo = rows[0];
  if (convo.buyer_id !== userId && convo.seller_id !== userId) return null;
  return convo;
}

// GET /api/chat/conversations/:id/messages — also marks incoming messages as
// read, and returns the pinned product (if any) so the thread can show it.
router.get("/conversations/:id/messages", async (req, res) => {
  try {
    const convo = await assertParticipant(req.params.id, req.user.id);
    if (!convo) return res.status(404).json({ error: "ไม่พบบทสนทนานี้" });

    await pool.query(
      "UPDATE chat_messages SET read_at = now() WHERE conversation_id = $1 AND sender_id != $2 AND read_at IS NULL",
      [req.params.id, req.user.id]
    );

    const { rows } = await pool.query(
      "SELECT id, sender_id, body, created_at FROM chat_messages WHERE conversation_id = $1 ORDER BY created_at ASC LIMIT 200",
      [req.params.id]
    );

    let product = null;
    if (convo.product_id) {
      const { rows: productRows } = await pool.query(
        `SELECT p.id, p.slug, p.name, p.price,
                (SELECT url FROM product_images pi WHERE pi.product_id = p.id ORDER BY sort_order LIMIT 1) AS image
         FROM products p WHERE p.id = $1`,
        [convo.product_id]
      );
      product = productRows[0] || null;
    }

    res.json({ messages: rows, product });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "โหลดข้อความไม่สำเร็จ" });
  }
});

// POST /api/chat/conversations/:id/messages — { body }
router.post("/conversations/:id/messages", async (req, res) => {
  const { body } = req.body;
  if (!body || !body.trim()) return res.status(400).json({ error: "ข้อความว่างเปล่า" });

  try {
    const convo = await assertParticipant(req.params.id, req.user.id);
    if (!convo) return res.status(404).json({ error: "ไม่พบบทสนทนานี้" });

    const { rows } = await pool.query(
      "INSERT INTO chat_messages (conversation_id, sender_id, body) VALUES ($1, $2, $3) RETURNING id, sender_id, body, created_at",
      [req.params.id, req.user.id, body.trim()]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "ส่งข้อความไม่สำเร็จ" });
  }
});

module.exports = router;
