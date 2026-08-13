const { Pool } = require("pg");

// DATABASE_URL comes from .env — never hardcode credentials here.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // Neon requires SSL
});

module.exports = pool;
