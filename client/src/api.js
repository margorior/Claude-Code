// Couche de données : conserve la même interface `api('/api/…')` que
// l'ancienne version serveur, mais parle directement à Supabase.
import { supabase, usernameToEmail, photoUrl } from './lib/supabase';

export { photoUrl };

function fail(message, status = 400) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function frenchAuthError(error) {
  const m = (error?.message || '').toLowerCase();
  if (m.includes('invalid login credentials')) return 'Identifiants incorrects';
  if (m.includes('email not confirmed'))
    return "Compte non confirmé — l'administrateur doit désactiver « Confirm email » dans Supabase (Authentication → Sign In / Providers)";
  if (m.includes('already registered') || m.includes('database error saving'))
    return "Ce nom d'utilisateur existe déjà";
  if (m.includes('at least 6')) return 'Le mot de passe doit faire au moins 6 caractères';
  return error?.message || 'Erreur inattendue';
}

async function myProfile() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;
  const { data } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
  return data;
}

function toUser(p) {
  return { id: p.id, username: p.username, displayName: p.display_name, role: p.role };
}

/* ------------------------------------------------------------------ AUTH */
async function register({ accessPassword, username, displayName, password }) {
  const { data: ok, error: rpcErr } = await supabase.rpc('check_registration_password', { pwd: accessPassword });
  if (rpcErr) throw fail(frenchAuthError(rpcErr));
  if (!ok) throw fail("Mot de passe d'accès à l'inscription incorrect", 403);
  if (!/^[a-z0-9._-]{2,32}$/i.test(String(username).trim()))
    throw fail("Nom d'utilisateur invalide : lettres, chiffres, . _ - (2 à 32 caractères)");
  const { error } = await supabase.auth.signUp({
    email: usernameToEmail(username),
    password,
    options: { data: { username: String(username).trim().toLowerCase(), display_name: String(displayName).trim() } },
  });
  if (error) throw fail(frenchAuthError(error));
  // Un compte fraîchement créé est « en attente » : on ferme la session
  // ouverte par l'inscription (sauf pour le tout premier compte = admin).
  const profile = await myProfile();
  if (!profile || profile.status !== 'active') {
    await supabase.auth.signOut();
    return { ok: true, message: "Compte créé. En attente de validation par l'administrateur." };
  }
  await supabase.auth.signOut();
  return { ok: true, message: 'Compte administrateur créé ! Connectez-vous.' };
}

async function login({ username, password }) {
  const { error } = await supabase.auth.signInWithPassword({
    email: usernameToEmail(username),
    password,
  });
  if (error) throw fail(frenchAuthError(error), 401);
  const profile = await myProfile();
  if (!profile) {
    await supabase.auth.signOut();
    throw fail('Profil introuvable', 401);
  }
  if (profile.status === 'pending') {
    await supabase.auth.signOut();
    throw fail("Votre compte est en attente de validation par l'administrateur", 403);
  }
  if (profile.status === 'disabled') {
    await supabase.auth.signOut();
    throw fail('Votre compte a été désactivé', 403);
  }
  return { user: toUser(profile) };
}

async function me() {
  const profile = await myProfile();
  if (!profile || profile.status !== 'active') throw fail('Non connecté', 401);
  return { user: toUser(profile) };
}

/* -------------------------------------------------------------- PRODUITS */
function sanitizeSearch(s) {
  return String(s).replace(/[,()]/g, ' ').trim();
}

async function listProducts(q) {
  const limit = Math.min(Number(q.get('limit')) || 50, 200);
  const page = Math.max(Number(q.get('page')) || 1, 1);
  const sortMap = { name: 'name', quantity: 'quantity', updated: 'updated_at', category: 'category_name', zone: 'zone_name' };
  const sort = sortMap[q.get('sort')] || 'name';
  const asc = q.get('dir') !== 'desc';

  let query = supabase.from('products_list').select('*', { count: 'exact' });
  const search = q.get('search');
  if (search) {
    const s = sanitizeSearch(search);
    if (s) query = query.or(`name.ilike.%${s}%,barcode.eq.${s}`);
  }
  if (q.get('category')) query = query.eq('category_id', Number(q.get('category')));
  if (q.get('zone')) query = query.eq('zone_id', Number(q.get('zone')));
  if (q.get('stock')) query = query.eq('stock', Number(q.get('stock')));
  if (q.get('alertsOnly') === '1') query = query.eq('in_alert', true);
  query = query.order(sort, { ascending: asc, nullsFirst: asc }).order('id', { ascending: true });
  query = query.range((page - 1) * limit, page * limit - 1);

  const [{ data, error, count }, alertRes] = await Promise.all([
    query,
    supabase.from('products_list').select('id', { count: 'exact', head: true }).eq('in_alert', true),
  ]);
  if (error) throw fail(error.message);
  return { items: data || [], total: count || 0, page, limit, alertCount: alertRes.count || 0 };
}

async function uploadPhoto(file) {
  const ext = (file.name?.split('.').pop() || 'jpg').toLowerCase().slice(0, 5);
  const path = `${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from('photos').upload(path, file, { contentType: file.type });
  if (error) throw fail('Envoi de la photo impossible : ' + error.message);
  return path;
}

function removePhotoQuietly(path) {
  if (path) supabase.storage.from('photos').remove([path]).catch(() => {});
}

function parseProductForm(fd) {
  return {
    name: String(fd.get('name') || '').trim(),
    barcode: String(fd.get('barcode') || '').trim() || null,
    unit: String(fd.get('unit') || 'pièce').trim() || 'pièce',
    quantity: Math.max(0, Number(fd.get('quantity')) || 0),
    stock: Number(fd.get('stock')) === 2 ? 2 : 1,
    category_id: fd.get('category_id') ? Number(fd.get('category_id')) : null,
    zone_id: fd.get('zone_id') ? Number(fd.get('zone_id')) : null,
    alert_threshold: Math.max(0, Number(fd.get('alert_threshold')) || 0),
  };
}

async function logMovement(fields) {
  const profile = await myProfile();
  await supabase.from('movements').insert({ user_name: profile?.display_name || '?', ...fields });
}

async function createProduct(fd) {
  const p = parseProductForm(fd);
  if (!p.name) throw fail('Le nom est requis');
  const file = fd.get('photo');
  if (file && file.size) p.photo = await uploadPhoto(file);
  const { data, error } = await supabase.from('products').insert(p).select('id').single();
  if (error) {
    removePhotoQuietly(p.photo);
    throw fail(error.message);
  }
  await logMovement({ product_id: data.id, product_name: p.name, action: 'création', delta: p.quantity, quantity_after: p.quantity });
  return { id: data.id };
}

async function updateProduct(id, fd) {
  const { data: existing, error: exErr } = await supabase.from('products').select('*').eq('id', id).single();
  if (exErr || !existing) throw fail('Produit introuvable', 404);
  const p = parseProductForm(fd);
  if (!p.name) throw fail('Le nom est requis');
  p.photo = existing.photo;
  const file = fd.get('photo');
  if (file && file.size) {
    removePhotoQuietly(existing.photo);
    p.photo = await uploadPhoto(file);
  } else if (fd.get('removePhoto') === '1') {
    removePhotoQuietly(existing.photo);
    p.photo = null;
  }
  p.updated_at = new Date().toISOString();
  const { error } = await supabase.from('products').update(p).eq('id', id);
  if (error) throw fail(error.message);
  const delta = p.quantity - existing.quantity;
  await logMovement({ product_id: id, product_name: p.name, action: 'modification', delta: delta !== 0 ? delta : null, quantity_after: p.quantity });
  return { ok: true };
}

async function deleteProduct(id) {
  const { data: existing } = await supabase.from('products').select('*').eq('id', id).single();
  if (!existing) throw fail('Produit introuvable', 404);
  const { error } = await supabase.from('products').delete().eq('id', id);
  if (error) throw fail(error.message);
  removePhotoQuietly(existing.photo);
  await logMovement({ product_id: id, product_name: existing.name, action: 'suppression' });
  return { ok: true };
}

/* ---------------------------------------------------- CATÉGORIES / ZONES */
async function listRef(table) {
  const { data, error } = await supabase
    .from(table)
    .select('*, products(count)')
    .order('name', { ascending: true });
  if (error) throw fail(error.message);
  return { items: (data || []).map((r) => ({ id: r.id, name: r.name, product_count: r.products?.[0]?.count || 0 })) };
}

async function createRef(table, name, label) {
  const { data, error } = await supabase.from(table).insert({ name: String(name).trim() }).select('id').single();
  if (error) throw fail(error.code === '23505' ? `${label} déjà existant(e)` : error.message, 409);
  return { id: data.id, name };
}

async function renameRef(table, id, name, label) {
  const { error } = await supabase.from(table).update({ name: String(name).trim() }).eq('id', id);
  if (error) throw fail(error.code === '23505' ? `${label} déjà existant(e)` : error.message, 409);
  return { ok: true };
}

async function deleteRef(table, id) {
  const { error } = await supabase.from(table).delete().eq('id', id);
  if (error) throw fail(error.message);
  return { ok: true };
}

/* ------------------------------------------------------------ HISTORIQUE */
async function listMovements(q) {
  const limit = Math.min(Number(q.get('limit')) || 50, 200);
  const page = Math.max(Number(q.get('page')) || 1, 1);
  let query = supabase.from('movements').select('*', { count: 'exact' });
  const search = q.get('search');
  if (search) {
    const s = sanitizeSearch(search);
    if (s) query = query.or(`product_name.ilike.%${s}%,user_name.ilike.%${s}%`);
  }
  const { data, error, count } = await query.order('id', { ascending: false }).range((page - 1) * limit, page * limit - 1);
  if (error) throw fail(error.message);
  return { items: data || [], total: count || 0, page, limit };
}

/* ---------------------------------------------------------- UTILISATEURS */
async function listUsers() {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('status', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) throw fail(error.message);
  return { users: data || [] };
}

async function updateUser(id, patch) {
  const { data: { session } } = await supabase.auth.getSession();
  const upd = {};
  if (patch.role && ['admin', 'gestionnaire', 'lecteur'].includes(patch.role)) {
    if (id === session?.user?.id && patch.role !== 'admin')
      throw fail('Vous ne pouvez pas retirer votre propre rôle admin');
    upd.role = patch.role;
  }
  if (patch.status && ['pending', 'active', 'disabled'].includes(patch.status)) {
    if (id === session?.user?.id) throw fail('Vous ne pouvez pas modifier votre propre statut');
    upd.status = patch.status;
  }
  const { error } = await supabase.from('profiles').update(upd).eq('id', id);
  if (error) throw fail(error.message);
  return { ok: true };
}

async function deleteUser(id) {
  const { error } = await supabase.from('profiles').delete().eq('id', id);
  if (error) throw fail(error.message);
  return { ok: true };
}

/* ------------------------------------------------------------ PARAMÈTRES */
async function getSettings() {
  const { data, error } = await supabase.from('settings').select('*');
  if (error) throw fail(error.message);
  const out = {};
  for (const row of data || []) out[row.key] = row.value;
  return out;
}

async function putSettings(body) {
  const rows = [];
  for (const key of ['stock1_name', 'stock2_name', 'registration_password']) {
    if (body[key] !== undefined && String(body[key]).trim() !== '') rows.push({ key, value: String(body[key]).trim() });
  }
  const { error } = await supabase.from('settings').upsert(rows);
  if (error) throw fail(error.message);
  return { ok: true };
}

async function changePassword({ next }) {
  if (String(next || '').length < 6) throw fail('Le nouveau mot de passe doit faire au moins 6 caractères');
  const { error } = await supabase.auth.updateUser({ password: String(next) });
  if (error) throw fail(frenchAuthError(error));
  return { ok: true };
}

/* --------------------------------------------------- EXPORTS / SAUVEGARDE */
async function fetchAll(table) {
  const out = [];
  const step = 1000;
  for (let from = 0; ; from += step) {
    const { data, error } = await supabase.from(table).select('*').order('id', { ascending: true }).range(from, from + step - 1);
    if (error) throw fail(error.message);
    out.push(...(data || []));
    if (!data || data.length < step) return out;
  }
}

function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export async function exportCsv(settings) {
  const products = await fetchAll('products_list');
  const stockNames = { 1: settings.stock1_name || 'Stock 1', 2: settings.stock2_name || 'Stock 2' };
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const header = ['Nom', 'Code-barres', 'Quantité', 'Unité', 'Seuil alerte', 'Stock', 'Catégorie', 'Zone', 'Dernière modification'];
  const lines = [header.map(esc).join(';')];
  for (const r of products.sort((a, b) => a.name.localeCompare(b.name, 'fr'))) {
    lines.push(
      [r.name, r.barcode, String(r.quantity).replace('.', ','), r.unit, String(r.alert_threshold).replace('.', ','),
       stockNames[r.stock], r.category_name, r.zone_name, new Date(r.updated_at).toLocaleString('fr-FR')].map(esc).join(';')
    );
  }
  const csv = '﻿' + lines.join('\r\n');
  download(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `inventaire-${new Date().toISOString().slice(0, 10)}.csv`);
}

export async function exportBackup() {
  const { default: JSZip } = await import('jszip');
  const [categories, zones, products, movements, settingsRows] = await Promise.all([
    fetchAll('categories'), fetchAll('zones'), fetchAll('products'), fetchAll('movements'),
    supabase.from('settings').select('*').then((r) => r.data || []),
  ]);
  const zip = new JSZip();
  zip.file('data.json', JSON.stringify({
    version: 2, exported_at: new Date().toISOString(),
    categories, zones, products, movements, settings: settingsRows,
  }, null, 2));
  for (const p of products) {
    if (!p.photo) continue;
    try {
      const res = await fetch(photoUrl(p.photo));
      if (res.ok) zip.file(`photos/${p.photo}`, await res.blob());
    } catch {}
  }
  const blob = await zip.generateAsync({ type: 'blob' });
  download(blob, `sauvegarde-stock-${new Date().toISOString().slice(0, 10)}.zip`);
}

export async function importBackup(file) {
  const { default: JSZip } = await import('jszip');
  let zip, dump;
  try {
    zip = await JSZip.loadAsync(file);
    dump = JSON.parse(await zip.file('data.json').async('string'));
    if (!Array.isArray(dump.products)) throw new Error();
  } catch {
    throw fail('Fichier de sauvegarde invalide');
  }
  const { error } = await supabase.rpc('import_backup', {
    payload: {
      categories: dump.categories || [], zones: dump.zones || [],
      products: dump.products || [], movements: dump.movements || [],
      settings: dump.settings || [],
    },
  });
  if (error) throw fail('Échec de la restauration : ' + error.message);
  const photoFiles = Object.keys(zip.files).filter((n) => n.startsWith('photos/') && !zip.files[n].dir);
  for (const name of photoFiles) {
    const blob = await zip.file(name).async('blob');
    await supabase.storage.from('photos').upload(name.replace('photos/', ''), blob, { upsert: true });
  }
  return { ok: true, products: dump.products.length };
}

/* ------------------------------------------------------------ DISPATCHER */
export async function api(path, options = {}) {
  if (!supabase) throw fail("Application non configurée : remplissez client/src/config.js");
  const [rawPath, rawQuery] = path.split('?');
  const q = new URLSearchParams(rawQuery || '');
  const seg = rawPath.replace(/^\/api\//, '').split('/');
  const method = (options.method || (options.json !== undefined || options.body ? 'POST' : 'GET')).toUpperCase();
  const body = options.json !== undefined ? options.json : options.body;

  if (seg[0] === 'auth') {
    if (seg[1] === 'register') return register(body);
    if (seg[1] === 'login') return login(body);
    if (seg[1] === 'logout') { await supabase.auth.signOut(); return { ok: true }; }
    if (seg[1] === 'me') return me();
    if (seg[1] === 'password') return changePassword(body);
  }
  if (seg[0] === 'products') {
    if (seg.length === 1) return method === 'POST' ? createProduct(body) : listProducts(q);
    if (seg[2] === 'adjust') return supabase.rpc('adjust_quantity', { pid: Number(seg[1]), delta: Number(body.delta) })
      .then(({ data, error }) => { if (error) throw fail(error.message); return { ok: true, quantity: data }; });
    if (method === 'PUT') return updateProduct(Number(seg[1]), body);
    if (method === 'DELETE') return deleteProduct(Number(seg[1]));
  }
  if (seg[0] === 'categories' || seg[0] === 'zones') {
    const label = seg[0] === 'categories' ? 'Catégorie' : 'Zone';
    if (seg.length === 1) return method === 'POST' ? createRef(seg[0], body.name, label) : listRef(seg[0]);
    if (method === 'PUT') return renameRef(seg[0], Number(seg[1]), body.name, label);
    if (method === 'DELETE') return deleteRef(seg[0], Number(seg[1]));
  }
  if (seg[0] === 'movements') return listMovements(q);
  if (seg[0] === 'users') {
    if (seg.length === 1) return listUsers();
    if (method === 'PUT') return updateUser(seg[1], body);
    if (method === 'DELETE') return deleteUser(seg[1]);
  }
  if (seg[0] === 'settings') return method === 'PUT' ? putSettings(body) : getSettings();

  throw fail(`Route inconnue : ${path}`, 404);
}
