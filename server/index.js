const path = require('path');
const fs = require('fs');
const express = require('express');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const crypto = require('crypto');
const AdmZip = require('adm-zip');

const { db, UPLOADS_DIR, getSetting, setSetting, logMovement } = require('./db');
const { setSessionCookie, clearSessionCookie, requireAuth, requireManager, requireAdmin } = require('./auth');

const app = express();
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());

const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOADS_DIR,
    filename: (req, file, cb) => {
      const ext = (path.extname(file.originalname) || '.jpg').toLowerCase().slice(0, 10);
      cb(null, crypto.randomBytes(12).toString('hex') + ext);
    },
  }),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(null, /^image\//.test(file.mimetype)),
});
const uploadZip = multer({ storage: multer.memoryStorage(), limits: { fileSize: 500 * 1024 * 1024 } });

function deletePhotoFile(photo) {
  if (!photo) return;
  const p = path.join(UPLOADS_DIR, path.basename(photo));
  fs.unlink(p, () => {});
}

// ---------------------------------------------------------------- AUTH
app.post('/api/auth/register', (req, res) => {
  const { accessPassword, username, displayName, password } = req.body || {};
  if (accessPassword !== getSetting('registration_password')) {
    return res.status(403).json({ error: "Mot de passe d'accès à l'inscription incorrect" });
  }
  if (!username || !password || !displayName) return res.status(400).json({ error: 'Champs manquants' });
  if (String(password).length < 6) return res.status(400).json({ error: 'Le mot de passe doit faire au moins 6 caractères' });
  try {
    db.prepare('INSERT INTO users (username, display_name, password_hash, role, status) VALUES (?,?,?,?,?)').run(
      String(username).trim(), String(displayName).trim(), bcrypt.hashSync(String(password), 10), 'lecteur', 'pending'
    );
  } catch (e) {
    return res.status(409).json({ error: "Ce nom d'utilisateur existe déjà" });
  }
  res.json({ ok: true, message: "Compte créé. En attente de validation par l'administrateur." });
});

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body || {};
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(String(username || '').trim());
  if (!user || !bcrypt.compareSync(String(password || ''), user.password_hash)) {
    return res.status(401).json({ error: 'Identifiants incorrects' });
  }
  if (user.status !== 'active') {
    return res.status(403).json({ error: "Votre compte est en attente de validation par l'administrateur" });
  }
  setSessionCookie(res, user);
  res.json({ user: { id: user.id, username: user.username, displayName: user.display_name, role: user.role } });
});

app.post('/api/auth/logout', (req, res) => {
  clearSessionCookie(res);
  res.json({ ok: true });
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json({ user: { id: req.user.id, username: req.user.username, displayName: req.user.display_name, role: req.user.role } });
});

app.put('/api/auth/password', requireAuth, (req, res) => {
  const { current, next } = req.body || {};
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!bcrypt.compareSync(String(current || ''), user.password_hash)) {
    return res.status(400).json({ error: 'Mot de passe actuel incorrect' });
  }
  if (String(next || '').length < 6) return res.status(400).json({ error: 'Le nouveau mot de passe doit faire au moins 6 caractères' });
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(bcrypt.hashSync(String(next), 10), req.user.id);
  res.json({ ok: true });
});

// ---------------------------------------------------------------- SETTINGS
app.get('/api/settings', requireAuth, (req, res) => {
  const out = {
    stock1_name: getSetting('stock1_name'),
    stock2_name: getSetting('stock2_name'),
  };
  if (req.user.role === 'admin') out.registration_password = getSetting('registration_password');
  res.json(out);
});

app.put('/api/settings', requireAdmin, (req, res) => {
  const allowed = ['stock1_name', 'stock2_name', 'registration_password'];
  for (const key of allowed) {
    if (req.body[key] !== undefined && String(req.body[key]).trim() !== '') {
      setSetting(key, String(req.body[key]).trim());
    }
  }
  res.json({ ok: true });
});

// ---------------------------------------------------------------- USERS (admin)
app.get('/api/users', requireAdmin, (req, res) => {
  const users = db.prepare('SELECT id, username, display_name, role, status, created_at FROM users ORDER BY status DESC, created_at DESC').all();
  res.json({ users });
});

app.put('/api/users/:id', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const target = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!target) return res.status(404).json({ error: 'Utilisateur introuvable' });
  const { role, status } = req.body || {};
  if (id === req.user.id && role && role !== 'admin') {
    return res.status(400).json({ error: 'Vous ne pouvez pas retirer votre propre rôle admin' });
  }
  if (role && ['admin', 'gestionnaire', 'lecteur'].includes(role)) {
    db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, id);
  }
  if (status && ['pending', 'active'].includes(status) && id !== req.user.id) {
    db.prepare('UPDATE users SET status = ? WHERE id = ?').run(status, id);
  }
  res.json({ ok: true });
});

app.delete('/api/users/:id', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  if (id === req.user.id) return res.status(400).json({ error: 'Vous ne pouvez pas supprimer votre propre compte' });
  db.prepare('DELETE FROM users WHERE id = ?').run(id);
  res.json({ ok: true });
});

// ---------------------------------------------------------------- CATEGORIES & ZONES
function crudRoutes(table, label) {
  app.get(`/api/${table}`, requireAuth, (req, res) => {
    const rows = db.prepare(`SELECT t.*, (SELECT COUNT(*) FROM products p WHERE p.${table === 'categories' ? 'category_id' : 'zone_id'} = t.id) AS product_count FROM ${table} t ORDER BY t.name COLLATE NOCASE`).all();
    res.json({ items: rows });
  });
  app.post(`/api/${table}`, requireManager, (req, res) => {
    const name = String(req.body.name || '').trim();
    if (!name) return res.status(400).json({ error: 'Nom requis' });
    try {
      const info = db.prepare(`INSERT INTO ${table} (name) VALUES (?)`).run(name);
      res.json({ id: info.lastInsertRowid, name });
    } catch {
      res.status(409).json({ error: `${label} déjà existant(e)` });
    }
  });
  app.put(`/api/${table}/:id`, requireManager, (req, res) => {
    const name = String(req.body.name || '').trim();
    if (!name) return res.status(400).json({ error: 'Nom requis' });
    try {
      db.prepare(`UPDATE ${table} SET name = ? WHERE id = ?`).run(name, Number(req.params.id));
      res.json({ ok: true });
    } catch {
      res.status(409).json({ error: `${label} déjà existant(e)` });
    }
  });
  app.delete(`/api/${table}/:id`, requireManager, (req, res) => {
    db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(Number(req.params.id));
    res.json({ ok: true });
  });
}
crudRoutes('categories', 'Catégorie');
crudRoutes('zones', 'Zone');

// ---------------------------------------------------------------- PRODUCTS
function productFilters(query) {
  const where = [];
  const params = {};
  if (query.search) {
    where.push('(p.name LIKE @search OR p.barcode LIKE @searchExact)');
    params.search = `%${query.search}%`;
    params.searchExact = String(query.search);
  }
  if (query.category) { where.push('p.category_id = @category'); params.category = Number(query.category); }
  if (query.zone) { where.push('p.zone_id = @zone'); params.zone = Number(query.zone); }
  if (query.stock) { where.push('p.stock = @stock'); params.stock = Number(query.stock); }
  if (query.alertsOnly === '1') where.push('p.alert_threshold > 0 AND p.quantity <= p.alert_threshold');
  return { whereSql: where.length ? 'WHERE ' + where.join(' AND ') : '', params };
}

app.get('/api/products', requireAuth, (req, res) => {
  const { whereSql, params } = productFilters(req.query);
  const sortMap = { name: 'p.name COLLATE NOCASE', quantity: 'p.quantity', updated: 'p.updated_at', category: 'c.name COLLATE NOCASE', zone: 'z.name COLLATE NOCASE' };
  const sort = sortMap[req.query.sort] || sortMap.name;
  const dir = req.query.dir === 'desc' ? 'DESC' : 'ASC';
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const page = Math.max(Number(req.query.page) || 1, 1);

  const base = `FROM products p LEFT JOIN categories c ON c.id = p.category_id LEFT JOIN zones z ON z.id = p.zone_id ${whereSql}`;
  const total = db.prepare(`SELECT COUNT(*) AS n ${base}`).get(params).n;
  const items = db.prepare(
    `SELECT p.*, c.name AS category_name, z.name AS zone_name ${base} ORDER BY ${sort} ${dir}, p.id LIMIT ${limit} OFFSET ${(page - 1) * limit}`
  ).all(params);
  const alertCount = db.prepare('SELECT COUNT(*) AS n FROM products p WHERE p.alert_threshold > 0 AND p.quantity <= p.alert_threshold').get().n;
  res.json({ items, total, page, limit, alertCount });
});

function parseProductBody(body) {
  return {
    name: String(body.name || '').trim(),
    barcode: String(body.barcode || '').trim() || null,
    unit: String(body.unit || 'pièce').trim() || 'pièce',
    quantity: Math.max(0, Number(body.quantity) || 0),
    stock: Number(body.stock) === 2 ? 2 : 1,
    category_id: body.category_id ? Number(body.category_id) : null,
    zone_id: body.zone_id ? Number(body.zone_id) : null,
    alert_threshold: Math.max(0, Number(body.alert_threshold) || 0),
  };
}

app.post('/api/products', requireManager, upload.single('photo'), (req, res) => {
  const p = parseProductBody(req.body);
  if (!p.name) return res.status(400).json({ error: 'Le nom est requis' });
  const photo = req.file ? req.file.filename : null;
  const info = db.prepare(
    'INSERT INTO products (name, barcode, photo, unit, quantity, stock, category_id, zone_id, alert_threshold) VALUES (@name, @barcode, @photo, @unit, @quantity, @stock, @category_id, @zone_id, @alert_threshold)'
  ).run({ ...p, photo });
  logMovement({ productId: info.lastInsertRowid, productName: p.name, userName: req.user.display_name, action: 'création', delta: p.quantity, quantityAfter: p.quantity });
  res.json({ id: info.lastInsertRowid });
});

app.put('/api/products/:id', requireManager, upload.single('photo'), (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Produit introuvable' });
  const p = parseProductBody(req.body);
  if (!p.name) return res.status(400).json({ error: 'Le nom est requis' });
  let photo = existing.photo;
  if (req.file) {
    deletePhotoFile(existing.photo);
    photo = req.file.filename;
  } else if (req.body.removePhoto === '1') {
    deletePhotoFile(existing.photo);
    photo = null;
  }
  db.prepare(
    'UPDATE products SET name=@name, barcode=@barcode, photo=@photo, unit=@unit, quantity=@quantity, stock=@stock, category_id=@category_id, zone_id=@zone_id, alert_threshold=@alert_threshold, updated_at=datetime(\'now\') WHERE id=@id'
  ).run({ ...p, photo, id });
  const delta = p.quantity - existing.quantity;
  logMovement({ productId: id, productName: p.name, userName: req.user.display_name, action: 'modification', delta: delta !== 0 ? delta : null, quantityAfter: p.quantity });
  res.json({ ok: true });
});

app.post('/api/products/:id/adjust', requireManager, (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Produit introuvable' });
  const delta = Number(req.body.delta);
  if (!delta || !Number.isFinite(delta)) return res.status(400).json({ error: 'Quantité invalide' });
  const newQty = Math.max(0, existing.quantity + delta);
  db.prepare("UPDATE products SET quantity = ?, updated_at = datetime('now') WHERE id = ?").run(newQty, id);
  logMovement({
    productId: id, productName: existing.name, userName: req.user.display_name,
    action: delta > 0 ? 'entrée' : 'sortie', delta, quantityAfter: newQty,
  });
  res.json({ ok: true, quantity: newQty });
});

app.delete('/api/products/:id', requireManager, (req, res) => {
  const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(Number(req.params.id));
  if (!existing) return res.status(404).json({ error: 'Produit introuvable' });
  deletePhotoFile(existing.photo);
  db.prepare('DELETE FROM products WHERE id = ?').run(existing.id);
  logMovement({ productId: existing.id, productName: existing.name, userName: req.user.display_name, action: 'suppression', quantityAfter: null });
  res.json({ ok: true });
});

// ---------------------------------------------------------------- MOVEMENTS
app.get('/api/movements', requireAuth, (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const page = Math.max(Number(req.query.page) || 1, 1);
  const search = req.query.search ? `%${req.query.search}%` : null;
  const whereSql = search ? 'WHERE product_name LIKE ? OR user_name LIKE ?' : '';
  const args = search ? [search, search] : [];
  const total = db.prepare(`SELECT COUNT(*) AS n FROM movements ${whereSql}`).get(...args).n;
  const items = db.prepare(`SELECT * FROM movements ${whereSql} ORDER BY id DESC LIMIT ${limit} OFFSET ${(page - 1) * limit}`).all(...args);
  res.json({ items, total, page, limit });
});

// ---------------------------------------------------------------- EXPORT CSV
app.get('/api/export/csv', requireAuth, (req, res) => {
  const rows = db.prepare(
    `SELECT p.name, p.barcode, p.quantity, p.unit, p.alert_threshold, p.stock, c.name AS category, z.name AS zone, p.updated_at
     FROM products p LEFT JOIN categories c ON c.id = p.category_id LEFT JOIN zones z ON z.id = p.zone_id
     ORDER BY p.name COLLATE NOCASE`
  ).all();
  const stockNames = { 1: getSetting('stock1_name'), 2: getSetting('stock2_name') };
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const header = ['Nom', 'Code-barres', 'Quantité', 'Unité', 'Seuil alerte', 'Stock', 'Catégorie', 'Zone', 'Dernière modification'];
  const lines = [header.map(esc).join(';')];
  for (const r of rows) {
    lines.push([r.name, r.barcode, String(r.quantity).replace('.', ','), r.unit, String(r.alert_threshold).replace('.', ','), stockNames[r.stock], r.category, r.zone, r.updated_at].map(esc).join(';'));
  }
  const csv = '﻿' + lines.join('\r\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="inventaire-${new Date().toISOString().slice(0, 10)}.csv"`);
  res.send(csv);
});

// ---------------------------------------------------------------- BACKUP EXPORT / IMPORT
app.get('/api/backup', requireAdmin, (req, res) => {
  const dump = {
    version: 1,
    exported_at: new Date().toISOString(),
    users: db.prepare('SELECT * FROM users').all(),
    categories: db.prepare('SELECT * FROM categories').all(),
    zones: db.prepare('SELECT * FROM zones').all(),
    products: db.prepare('SELECT * FROM products').all(),
    movements: db.prepare('SELECT * FROM movements').all(),
    settings: db.prepare('SELECT * FROM settings').all(),
  };
  const zip = new AdmZip();
  zip.addFile('data.json', Buffer.from(JSON.stringify(dump, null, 2), 'utf8'));
  for (const p of dump.products) {
    if (p.photo) {
      const f = path.join(UPLOADS_DIR, path.basename(p.photo));
      if (fs.existsSync(f)) zip.addLocalFile(f, 'uploads');
    }
  }
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="sauvegarde-stock-${new Date().toISOString().slice(0, 10)}.zip"`);
  res.send(zip.toBuffer());
});

app.post('/api/backup/import', requireAdmin, uploadZip.single('backup'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Fichier manquant' });
  let zip, dump;
  try {
    zip = new AdmZip(req.file.buffer);
    const entry = zip.getEntry('data.json');
    if (!entry) throw new Error('data.json manquant');
    dump = JSON.parse(entry.getData().toString('utf8'));
    if (!Array.isArray(dump.products) || !Array.isArray(dump.users)) throw new Error('format invalide');
  } catch (e) {
    return res.status(400).json({ error: 'Fichier de sauvegarde invalide' });
  }

  const importAll = db.transaction(() => {
    db.prepare('DELETE FROM movements').run();
    db.prepare('DELETE FROM products').run();
    db.prepare('DELETE FROM categories').run();
    db.prepare('DELETE FROM zones').run();
    db.prepare('DELETE FROM users').run();
    db.prepare('DELETE FROM settings').run();
    const insUser = db.prepare('INSERT INTO users (id, username, display_name, password_hash, role, status, created_at) VALUES (@id,@username,@display_name,@password_hash,@role,@status,@created_at)');
    for (const u of dump.users) insUser.run(u);
    const insCat = db.prepare('INSERT INTO categories (id, name) VALUES (@id,@name)');
    for (const c of dump.categories || []) insCat.run(c);
    const insZone = db.prepare('INSERT INTO zones (id, name) VALUES (@id,@name)');
    for (const z of dump.zones || []) insZone.run(z);
    const insProd = db.prepare('INSERT INTO products (id, name, barcode, photo, unit, quantity, stock, category_id, zone_id, alert_threshold, created_at, updated_at) VALUES (@id,@name,@barcode,@photo,@unit,@quantity,@stock,@category_id,@zone_id,@alert_threshold,@created_at,@updated_at)');
    for (const p of dump.products) insProd.run(p);
    const insMov = db.prepare('INSERT INTO movements (id, product_id, product_name, user_name, action, delta, quantity_after, details, created_at) VALUES (@id,@product_id,@product_name,@user_name,@action,@delta,@quantity_after,@details,@created_at)');
    for (const m of dump.movements || []) insMov.run(m);
    const insSet = db.prepare('INSERT INTO settings (key, value) VALUES (@key,@value)');
    for (const s of dump.settings || []) insSet.run(s);
  });

  try {
    importAll();
  } catch (e) {
    return res.status(500).json({ error: "Échec de l'import : " + e.message });
  }

  for (const entry of zip.getEntries()) {
    if (entry.entryName.startsWith('uploads/') && !entry.isDirectory) {
      fs.writeFileSync(path.join(UPLOADS_DIR, path.basename(entry.entryName)), entry.getData());
    }
  }
  logMovement({ productName: '—', userName: req.user.display_name, action: 'import', details: `Sauvegarde importée (${dump.products.length} produits)` });
  res.json({ ok: true, products: dump.products.length });
});

// ---------------------------------------------------------------- STATIC
app.use('/uploads', express.static(UPLOADS_DIR, { maxAge: '7d' }));

const CLIENT_DIST = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(CLIENT_DIST)) {
  app.use(express.static(CLIENT_DIST));
  app.get(/^\/(?!api\/).*/, (req, res) => res.sendFile(path.join(CLIENT_DIST, 'index.html')));
}

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Erreur serveur' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Gestion de stock démarrée sur http://localhost:${PORT}`);
});
