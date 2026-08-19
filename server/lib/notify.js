const pool = require("../db");

async function notify(client, { userId, type, title, body, linkView }) {
  await (client || pool).query(
    "INSERT INTO notifications (user_id, type, title, body, link_view) VALUES ($1, $2, $3, $4, $5)",
    [userId, type, title, body || null, linkView || null]
  );
}

module.exports = { notify };
