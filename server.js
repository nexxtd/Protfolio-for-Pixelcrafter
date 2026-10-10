import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import jwt from 'jsonwebtoken';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = parseInt(process.env.PORT || '10000', 10);
const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-change-me';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

app.use(cors());
app.use(express.json({ limit: '25mb' }));

// ---------- Storage: Postgres (Render) with JSON-file fallback (local dev) ----------
let pgPool = null;
const DATA_FILE = path.join(__dirname, 'data', 'content.json');

function getPool() {
  if (pgPool) return pgPool;
  const url = process.env.DATABASE_URL;
  if (!url || (!url.startsWith('postgresql://') && !url.startsWith('postgres://'))) return null;
  const { default: pg } = awaitImportPg();
  pgPool = new pg.Pool({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
    max: 5,
  });
  pgPool.on('error', (e) => console.error('pg pool error', e.message));
  return pgPool;
}

// pg is ESM/CJS interop — import once lazily without top-level await issues
import pgLib from 'pg';
function awaitImportPg() {
  return pgLib;
}

async function ensureTables() {
  const pool = getPool();
  if (!pool) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS portfolio_content (
      id INTEGER PRIMARY KEY DEFAULT 1,
      data JSONB NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
      CONSTRAINT single_row CHECK (id = 1)
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS portfolio_messages (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
    );
  `);
}

function readFileContent() {
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeFileContent(data) {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

async function loadContent() {
  const pool = getPool();
  if (pool) {
    try {
      const r = await pool.query('SELECT data FROM portfolio_content WHERE id = 1');
      if (r.rows[0]?.data) return r.rows[0].data;
    } catch (e) {
      console.error('loadContent pg failed, falling back to file:', e.message);
    }
  }
  const file = readFileContent();
  if (file) return file;
  throw new Error('No content found');
}

async function saveContent(data) {
  const pool = getPool();
  if (pool) {
    await pool.query(
      `INSERT INTO portfolio_content (id, data, updated_at)
       VALUES (1, $1, NOW())
       ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`,
      [JSON.stringify(data)]
    );
    return;
  }
  writeFileContent(data);
}

// Seed Postgres from the bundled JSON on first boot
async function seedIfEmpty() {
  const pool = getPool();
  if (!pool) return;
  const r = await pool.query('SELECT id FROM portfolio_content WHERE id = 1');
  if (r.rows.length === 0) {
    const file = readFileContent();
    if (file) {
      await pool.query('INSERT INTO portfolio_content (id, data) VALUES (1, $1)', [JSON.stringify(file)]);
      console.log('Seeded portfolio_content from data/content.json');
    }
  }
}

// ---------- Auth ----------
function requireAdmin(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Login required' });
  try {
    jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Session expired — please log in again' });
  }
}

function publicContent(full) {
  const { messages, ...rest } = full;
  return rest;
}

// ---------- API ----------
app.get('/api/health', (_req, res) => res.json({ ok: true, time: new Date().toISOString() }));

app.get('/api/content', async (_req, res) => {
  try {
    const full = await loadContent();
    res.json(publicContent(full));
  } catch (e) {
    res.status(500).json({ error: 'Failed to load content' });
  }
});

app.put('/api/content', requireAdmin, async (req, res) => {
  try {
    const data = req.body;
    if (!data || typeof data !== 'object' || !data.profile) {
      return res.status(400).json({ error: 'Invalid content payload' });
    }
    // Keep messages server-side only; never overwrite them via content save
    const current = await loadContent().catch(() => ({}));
    data.messages = current.messages || [];
    // Basic size guard (Render free + base64 images)
    const size = JSON.stringify(data).length;
    if (size > 8 * 1024 * 1024) {
      return res.status(413).json({ error: 'Content too large (8MB max). Use smaller images.' });
    }
    await saveContent(data);
    res.json({ ok: true });
  } catch (e) {
    console.error('save content failed', e);
    res.status(500).json({ error: 'Failed to save content' });
  }
});

app.post('/api/admin/login', (req, res) => {
  const { password } = req.body || {};
  if (!password || password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Wrong password' });
  }
  const token = jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token });
});

app.get('/api/admin/messages', requireAdmin, async (_req, res) => {
  try {
    const pool = getPool();
    if (pool) {
      const r = await pool.query('SELECT id, name, email, message, created_at FROM portfolio_messages ORDER BY id DESC LIMIT 200');
      return res.json(r.rows);
    }
    const full = await loadContent().catch(() => ({ messages: [] }));
    res.json((full.messages || []).slice().reverse());
  } catch {
    res.status(500).json({ error: 'Failed to load messages' });
  }
});

app.delete('/api/admin/messages/:id', requireAdmin, async (req, res) => {
  try {
    const pool = getPool();
    if (pool) {
      await pool.query('DELETE FROM portfolio_messages WHERE id = $1', [req.params.id]);
      return res.json({ ok: true });
    }
    const full = await loadContent();
    full.messages = (full.messages || []).filter((m) => String(m.id) !== String(req.params.id));
    await saveContent(full);
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Failed to delete message' });
  }
});

app.post('/api/contact', async (req, res) => {
  try {
    const { name, email, message } = req.body || {};
    if (!name?.trim() || !email?.trim() || !message?.trim()) {
      return res.status(400).json({ error: 'Name, email and message are required' });
    }
    if (String(name).length > 120 || String(email).length > 200 || String(message).length > 5000) {
      return res.status(400).json({ error: 'Message too long' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email))) {
      return res.status(400).json({ error: 'Invalid email address' });
    }
    const pool = getPool();
    if (pool) {
      await pool.query('INSERT INTO portfolio_messages (name, email, message) VALUES ($1, $2, $3)', [
        String(name).trim(),
        String(email).trim(),
        String(message).trim(),
      ]);
      return res.json({ ok: true });
    }
    const full = await loadContent();
    full.messages = full.messages || [];
    full.messages.push({ id: Date.now(), name: String(name).trim(), email: String(email).trim(), message: String(message).trim(), created_at: new Date().toISOString() });
    await saveContent(full);
    res.json({ ok: true });
  } catch (e) {
    console.error('contact failed', e);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// ---------- Static frontend ----------
const publicDir = path.join(__dirname, 'public');
app.use(express.static(publicDir, { maxAge: '1h' }));
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'API route not found' });
  res.sendFile(path.join(publicDir, 'index.html'));
});

// ---------- Boot ----------
async function start() {
  try {
    await ensureTables();
    await seedIfEmpty();
  } catch (e) {
    console.error('DB init warning (file fallback will be used):', e.message);
  }
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`pixeclcraffter portfolio running on port ${PORT}`);
    console.log(`DATABASE_URL: ${process.env.DATABASE_URL ? 'set (Postgres mode)' : 'not set (file mode)'}`);
  });
}
start();
