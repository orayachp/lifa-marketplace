const express = require("express");
const pool = require("../db");
const { requireAuth } = require("../middleware/auth");
const { notify } = require("../lib/notify");

const router = express.Router();

// POST /api/orders — create a real order from the current cart.
// body: { items: [{id, name, price, qty}], address, method, couponCode, discount, subtotal, total }
// This still runs in the app's "test payment" flow — no real money moves — but the
// order, order_items, stock, and coupon usage are all real writes to the database.
router.post("/", requireAuth, async (req, res) => {
  const { items, address, method, couponCode, discount = 0, subtotal, total } = req.body;
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "ตะกร้าว่างเปล่า" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Look up seller_id for each product (order_items needs it)
    const productIds = items.map((i) => i.id);
    const { rows: productRows } = await client.query(
      "SELECT id, seller_id, stock, name FROM products WHERE id = ANY($1)",
      [productIds]
    );
    const productMap = Object.fromEntries(productRows.map((p) => [p.id, p]));

    for (const item of items) {
      const p = productMap[item.id];
      if (!p) throw new Error(`ไม่พบสินค้า ${item.name}`);
      if (p.stock < item.qty) throw new Error(`สินค้า ${item.name} เหลือไม่พอ (คงเหลือ ${p.stock})`);
    }

    const orderNo = `LF-${Date.now().toString().slice(-8)}`;
    const { rows: orderRows } = await client.query(
      `INSERT INTO orders (order_no, buyer_id, subtotal, shipping_fee, discount_total, grand_total, status, payment_status)
       VALUES ($1, $2, $3, 0, $4, $5, 'paid', 'paid')
       RETURNING id, order_no, created_at`,
      [orderNo, req.user.id, subtotal, discount, total]
    );
    const order = orderRows[0];

    const sellersToNotify = new Set();
    for (const item of items) {
      const p = productMap[item.id];
      await client.query(
        `INSERT INTO order_items (order_id, product_id, seller_id, product_name, unit_price, quantity, line_total)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [order.id, item.id, p.seller_id, item.name, item.price, item.qty, item.price * item.qty]
      );
      await client.query(
        "UPDATE products SET stock = stock - $1, sold_count = sold_count + $1 WHERE id = $2",
        [item.qty, item.id]
      );
      sellersToNotify.add(p.seller_id);
    }

    if (address) {
      await client.query(
        `INSERT INTO addresses (user_id, recipient_name, phone, line1, district, province, postal_code)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [req.user.id, address.name, address.phone, address.line1, address.district, address.province, address.postalCode]
      );
    }

    if (couponCode) {
      await client.query("UPDATE coupons SET used_count = used_count + 1 WHERE code = $1", [couponCode]);
      // Mark this specific user's wallet copy of the coupon as used (Shopee-style: one use per collected coupon)
      await client.query(
        `UPDATE user_coupons SET used_at = now(), order_id = $1
         WHERE user_id = $2 AND coupon_id = (SELECT id FROM coupons WHERE code = $3) AND used_at IS NULL`,
        [order.id, req.user.id, couponCode]
      );
    }

    await client.query(
      `INSERT INTO payments (order_id, method, amount, status, paid_at) VALUES ($1, $2, $3, 'paid', now())`,
      [order.id, method, total]
    );

    // Notify each seller that a new order came in
    for (const sellerId of sellersToNotify) {
      await notify(client, {
        userId: sellerId,
        type: "new_order",
        title: "มีคำสั่งซื้อใหม่เข้ามา",
        body: `คำสั่งซื้อ ${order.order_no}`,
        linkView: "seller",
      });
    }

    await client.query("COMMIT");
    res.status(201).json({ orderNo: order.order_no, createdAt: order.created_at });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(400).json({ error: err.message || "สร้างคำสั่งซื้อไม่สำเร็จ" });
  } finally {
    client.release();
  }
});

// GET /api/orders/mine — the logged-in buyer's order history, plus any return request status
router.get("/mine", requireAuth, async (req, res) => {
  try {
    const { rows: orders } = await pool.query(
      `SELECT o.id, o.order_no, o.grand_total, o.status, o.payment_status, o.created_at,
              rr.status AS return_status, rr.reason AS return_reason
       FROM orders o
       LEFT JOIN return_requests rr ON rr.order_id = o.id
       WHERE o.buyer_id = $1 ORDER BY o.created_at DESC LIMIT 50`,
      [req.user.id]
    );
    if (orders.length === 0) return res.json([]);

    const orderIds = orders.map((o) => o.id);
    const { rows: items } = await pool.query(
      `SELECT id, order_id, product_id, product_name, unit_price, quantity, line_total FROM order_items WHERE order_id = ANY($1)`,
      [orderIds]
    );
    const itemsByOrder = {};
    for (const it of items) {
      (itemsByOrder[it.order_id] ||= []).push(it);
    }
    res.json(orders.map((o) => ({ ...o, items: itemsByOrder[o.id] || [] })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "โหลดประวัติคำสั่งซื้อไม่สำเร็จ" });
  }
});

// POST /api/orders/:id/return — buyer requests a return/refund for this order.
router.post("/:id/return", requireAuth, async (req, res) => {
  const { reason } = req.body;
  if (!reason || !reason.trim()) return res.status(400).json({ error: "กรุณาระบุเหตุผลในการคืนสินค้า" });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows: orderRows } = await client.query(
      "SELECT id, buyer_id, order_no, status FROM orders WHERE id = $1",
      [req.params.id]
    );
    if (orderRows.length === 0 || orderRows[0].buyer_id !== req.user.id) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "ไม่พบคำสั่งซื้อนี้" });
    }
    const order = orderRows[0];
    if (["cancelled", "refunded"].includes(order.status)) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "คำสั่งซื้อนี้ยกเลิกหรือคืนเงินไปแล้ว" });
    }

    const { rows } = await client.query(
      `INSERT INTO return_requests (order_id, buyer_id, reason) VALUES ($1, $2, $3)
       ON CONFLICT (order_id) DO NOTHING RETURNING id`,
      [order.id, req.user.id, reason.trim()]
    );
    if (rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "คุณส่งคำขอคืนสินค้าสำหรับคำสั่งซื้อนี้ไปแล้ว" });
    }

    // Notify every seller involved in this order
    const { rows: sellerRows } = await client.query(
      "SELECT DISTINCT seller_id FROM order_items WHERE order_id = $1",
      [order.id]
    );
    for (const s of sellerRows) {
      await notify(client, {
        userId: s.seller_id,
        type: "return_request",
        title: "มีคำขอคืนสินค้า",
        body: `คำสั่งซื้อ ${order.order_no}`,
        linkView: "seller",
      });
    }

    await client.query("COMMIT");
    res.status(201).json({ ok: true });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "ส่งคำขอคืนสินค้าไม่สำเร็จ" });
  } finally {
    client.release();
  }
});

module.exports = router;
