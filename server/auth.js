const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { db, DATA_DIR } = require('./db');

const SECRET_FILE = path.join(DATA_DIR, 'secret.key');
let SECRET;
if (fs.existsSync(SECRET_FILE)) {
  SECRET = fs.readFileSync(SECRET_FILE, 'utf8').trim();
} else {
  SECRET = crypto.randomBytes(48).toString('hex');
  fs.writeFileSync(SECRET_FILE, SECRET, { mode: 0o600 });
}

const COOKIE_NAME = 'stock_session';
const TOKEN_TTL = '30d';

function setSessionCookie(res, user) {
  const token = jwt.sign({ id: user.id }, SECRET, { expiresIn: TOKEN_TTL });
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 30 * 24 * 3600 * 1000,
  });
}

function clearSessionCookie(res) {
  res.clearCookie(COOKIE_NAME);
}

function getUserFromRequest(req) {
  const token = req.cookies[COOKIE_NAME];
  if (!token) return null;
  try {
    const payload = jwt.verify(token, SECRET);
    const user = db
      .prepare('SELECT id, username, display_name, role, status FROM users WHERE id = ?')
      .get(payload.id);
    if (!user || user.status !== 'active') return null;
    return user;
  } catch {
    return null;
  }
}

function requireAuth(req, res, next) {
  const user = getUserFromRequest(req);
  if (!user) return res.status(401).json({ error: 'Non connecté' });
  req.user = user;
  next();
}

// admin + gestionnaire
function requireManager(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user.role === 'lecteur') {
      return res.status(403).json({ error: 'Accès réservé aux gestionnaires' });
    }
    next();
  });
}

function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: "Accès réservé à l'administrateur" });
    }
    next();
  });
}

module.exports = { setSessionCookie, clearSessionCookie, getUserFromRequest, requireAuth, requireManager, requireAdmin, COOKIE_NAME };
