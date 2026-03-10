require('dotenv').config();
const express = require('express');
const { createClient } = require('@libsql/client');
const path = require('path');

const app = express();
app.use(express.json({ limit: '5mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Turso client
const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

// Initialize tables
async function initDB() {
  await db.batch([
    `CREATE TABLE IF NOT EXISTS config (key TEXT PRIMARY KEY, value TEXT)`,
    `CREATE TABLE IF NOT EXISTS organisations (id INTEGER PRIMARY KEY, data TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP)`,
  ]);
  // Seed defaults if config is empty
  const check = await db.execute(`SELECT COUNT(*) as c FROM config`);
  if (check.rows[0].c === 0) {
    console.log('Seeding default config...');
    await db.execute({ sql: `INSERT INTO config (key, value) VALUES ('ns_a', ?)`, args: [JSON.stringify({})] });
    await db.execute({ sql: `INSERT INTO config (key, value) VALUES ('ns_b', ?)`, args: [JSON.stringify([])] });
  }
}

// GET /api/config - Load all config + orgs
app.get('/api/config', async (req, res) => {
  try {
    const [aRow, bRow, orgs] = await Promise.all([
      db.execute(`SELECT value FROM config WHERE key = 'ns_a'`),
      db.execute(`SELECT value FROM config WHERE key = 'ns_b'`),
      db.execute(`SELECT id, data FROM organisations ORDER BY id`),
    ]);
    const a = aRow.rows.length > 0 ? JSON.parse(aRow.rows[0].value) : {};
    const b = bRow.rows.length > 0 ? JSON.parse(bRow.rows[0].value) : [];
    const p = orgs.rows.map(r => JSON.parse(r.data));
    res.json({ a, b, p });
  } catch (e) {
    console.error('GET /api/config error:', e);
    res.status(500).json({ error: e.message });
  }
});

// POST /api/config - Save config (A + bundles)
app.post('/api/config', async (req, res) => {
  try {
    const { a, b } = req.body;
    await db.batch([
      { sql: `INSERT OR REPLACE INTO config (key, value) VALUES ('ns_a', ?)`, args: [JSON.stringify(a)] },
      { sql: `INSERT OR REPLACE INTO config (key, value) VALUES ('ns_b', ?)`, args: [JSON.stringify(b)] },
    ]);
    res.json({ ok: true });
  } catch (e) {
    console.error('POST /api/config error:', e);
    res.status(500).json({ error: e.message });
  }
});

// POST /api/org - Save or update an organisation
app.post('/api/org', async (req, res) => {
  try {
    const org = req.body;
    await db.execute({
      sql: `INSERT OR REPLACE INTO organisations (id, data) VALUES (?, ?)`,
      args: [org.id, JSON.stringify(org)],
    });
    res.json({ ok: true });
  } catch (e) {
    console.error('POST /api/org error:', e);
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/org/:id - Remove an organisation
app.delete('/api/org/:id', async (req, res) => {
  try {
    await db.execute({ sql: `DELETE FROM organisations WHERE id = ?`, args: [parseInt(req.params.id)] });
    res.json({ ok: true });
  } catch (e) {
    console.error('DELETE /api/org error:', e);
    res.status(500).json({ error: e.message });
  }
});

// POST /api/orgs/sync - Replace all orgs at once
app.post('/api/orgs/sync', async (req, res) => {
  try {
    const { orgs } = req.body;
    const stmts = [`DELETE FROM organisations`];
    (orgs || []).forEach(org => {
      stmts.push({ sql: `INSERT INTO organisations (id, data) VALUES (?, ?)`, args: [org.id, JSON.stringify(org)] });
    });
    await db.batch(stmts);
    res.json({ ok: true });
  } catch (e) {
    console.error('POST /api/orgs/sync error:', e);
    res.status(500).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 3000;

initDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  })
  .catch(e => {
    console.error('DB init failed:', e);
    process.exit(1);
  });
