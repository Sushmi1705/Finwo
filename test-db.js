// test-db.js (CommonJS version)
const { Client } = require("pg");
require("dotenv").config();

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function testConnection() {
  try {
    await client.connect();
    console.log("✅ Connected to PostgreSQL (AWS RDS)");
    const res = await client.query('SELECT current_database(), current_user;');
    console.log("🧠 Info:", res.rows[0]);
  } catch (err) {
    console.error("❌ Connection error:", err.message);
  } finally {
    await client.end();
  }
}

testConnection();