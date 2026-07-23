const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');

fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, 'stock.sqlite'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  display_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'lecteur' CHECK (role IN ('admin','gestionnaire','lecteur')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE COLLATE NOCASE
);

CREATE TABLE IF NOT EXISTS zones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE COLLATE NOCASE
);

CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  barcode TEXT,
  photo TEXT,
  unit TEXT NOT NULL DEFAULT 'pièce',
  quantity REAL NOT NULL DEFAULT 0,
  stock INTEGER NOT NULL DEFAULT 1 CHECK (stock IN (1,2)),
  category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  zone_id INTEGER REFERENCES zones(id) ON DELETE SET NULL,
  alert_threshold REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_zone ON products(zone_id);
CREATE INDEX IF NOT EXISTS idx_products_stock ON products(stock);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);

CREATE TABLE IF NOT EXISTS movements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER,
  product_name TEXT NOT NULL,
  user_name TEXT NOT NULL,
  action TEXT NOT NULL,
  delta REAL,
  quantity_after REAL,
  details TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_movements_created ON movements(created_at DESC);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`);

function seed() {
  const hasAdmin = db.prepare("SELECT 1 FROM users WHERE role = 'admin' LIMIT 1").get();
  if (!hasAdmin) {
    db.prepare(
      "INSERT INTO users (username, display_name, password_hash, role, status) VALUES (?,?,?,?,?)"
    ).run('admin', 'Administrateur', bcrypt.hashSync('admin123', 10), 'admin', 'active');
  }
  const defaults = {
    registration_password: 'bienvenue',
    stock1_name: 'Stock 1',
    stock2_name: 'Stock 2',
  };
  const insertSetting = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?,?)');
  for (const [k, v] of Object.entries(defaults)) insertSetting.run(k, v);

  const hasCategories = db.prepare('SELECT 1 FROM categories LIMIT 1').get();
  if (!hasCategories) {
    const ins = db.prepare('INSERT INTO categories (name) VALUES (?)');
    for (const c of ['Câbles', 'Prises', 'Interrupteurs', 'Disjoncteurs', 'Luminaires', 'Gaines']) ins.run(c);
  }
  const hasZones = db.prepare('SELECT 1 FROM zones LIMIT 1').get();
  if (!hasZones) {
    const ins = db.prepare('INSERT INTO zones (name) VALUES (?)');
    for (const z of ['Étagère A', 'Étagère B', 'Réserve']) ins.run(z);
  }
}
seed();

function getSetting(key) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : null;
}

function setSetting(key, value) {
  db.prepare('INSERT INTO settings (key, value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, value);
}

function logMovement({ productId = null, productName, userName, action, delta = null, quantityAfter = null, details = null }) {
  db.prepare(
    'INSERT INTO movements (product_id, product_name, user_name, action, delta, quantity_after, details) VALUES (?,?,?,?,?,?,?)'
  ).run(productId, productName, userName, action, delta, quantityAfter, details);
}

module.exports = { db, DATA_DIR, UPLOADS_DIR, getSetting, setSetting, logMovement };
