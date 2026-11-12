// Couche de données : conserve la même interface `api('/api/…')` que
// l'ancienne version serveur, mais parle directement à Supabase.
import { supabase, usernameToEmail, photoUrl, fileUrl } from './lib/supabase';
import { searchWords, upperClean, naturalCompare } from './lib/text';

export { photoUrl };

export function fail(message, status = 400) {
  const err = new Error(message);
  err.status = status;
  return err;
}

// Message affiché tant que la base Supabase n'a pas reçu la dernière version
// du fichier supabase/schema.sql
export const SCHEMA_HINT =
  "La base de données n'est pas encore à jour : collez le fichier supabase/schema.sql dans Supabase (SQL Editor → Run), puis rechargez la page.";

// Table, colonne ou fonction absente : la base n'a pas reçu la mise à jour
export function isSchemaError(error) {
  return ['42P01', '42703', '42883', 'PGRST202', 'PGRST204', 'PGRST205'].includes(error?.code);
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
  const asc = q.get('dir') !== 'desc';

  const build = (mode) => {
    let query = supabase.from('products_list').select('*', { count: 'exact' });
    // zone_sort range les zones numérotées dans l'ordre 1, 2 … 10 (et non 1, 10, 2)
    const sort = q.get('sort') === 'zone' && mode === 'full' ? 'zone_sort' : sortMap[q.get('sort')] || 'name';
    const search = q.get('search');
    if (search && (mode === 'full' || mode === 'norm')) {
      for (const w of searchWords(search)) query = query.ilike('search_text', `%${w}%`);
    } else if (search) {
      const s = sanitizeSearch(search);
      if (s) {
        query = mode === 'brand'
          ? query.or(`name.ilike.%${s}%,barcode.ilike.%${s}%,brand.ilike.%${s}%,reference.ilike.%${s}%`)
          : query.or(`name.ilike.%${s}%,barcode.ilike.%${s}%`);
      }
    }
    // « none » = les produits sans catégorie / sans zone
    for (const [param, column] of [['category', 'category_id'], ['zone', 'zone_id']]) {
      const v = q.get(param);
      if (v === 'none') query = query.is(column, null);
      else if (v) query = query.eq(column, Number(v));
    }
    if (q.get('stock')) query = query.eq('stock', Number(q.get('stock')));
    // Marque : sans tenir compte des majuscules/minuscules
    if (mode !== 'basic' && q.get('brand')) query = query.ilike('brand', q.get('brand').replace(/[\\%_]/g, '\\$&'));
    if (q.get('alertsOnly') === '1') query = query.eq('in_alert', true);
    query = query.order(sort, { ascending: asc, nullsFirst: asc }).order('id', { ascending: true });
    return query.range((page - 1) * limit, page * limit - 1);
  };

  // Replis tant que le schéma Supabase n'est pas à jour : sans tri numérique
  // des zones, puis recherche simple, puis sans marque/référence
  let [{ data, error, count }, alertRes] = await Promise.all([
    build('full'),
    supabase.from('products_list').select('id', { count: 'exact', head: true }).eq('in_alert', true),
  ]);
  for (const mode of ['norm', 'brand', 'basic']) {
    if (error) ({ data, error, count } = await build(mode));
  }
  if (error) throw fail(error.message);
  return { items: data || [], total: count || 0, page, limit, alertCount: alertRes.count || 0 };
}

// Noms de produits et marques déjà saisis (aide à la saisie, anti-doublons)
async function productSuggestions() {
  const names = new Map();
  const brands = new Map();
  const step = 1000;
  for (let from = 0; ; from += step) {
    let { data, error } = await supabase.from('products').select('name, brand').order('id').range(from, from + step - 1);
    if (error) ({ data, error } = await supabase.from('products').select('name').order('id').range(from, from + step - 1));
    if (error) break;
    for (const r of data || []) {
      const name = String(r.name || '').trim();
      const key = searchWords(name).join('');
      if (key && !names.has(key)) names.set(key, name);
      const brand = upperClean(r.brand);
      if (brand) brands.set(brand, (brands.get(brand) || 0) + 1);
    }
    if (!data || data.length < step) break;
  }
  return {
    names: [...names.values()].sort(naturalCompare),
    brands: [...brands.keys()].sort(naturalCompare),
  };
}

async function productBrands() {
  return { brands: (await productSuggestions()).brands };
}

async function getProduct(id) {
  let { data, error } = await supabase.from('products_list').select('*').eq('id', id).maybeSingle();
  if (error) ({ data, error } = await supabase.from('products').select('*').eq('id', id).maybeSingle());
  if (error) throw fail(error.message);
  if (!data) throw fail("Ce produit n'existe plus", 404);
  return data;
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
    brand: upperClean(fd.get('brand')) || null,
    reference: upperClean(fd.get('reference')) || null,
    barcode: String(fd.get('barcode') || '').trim() || null,
    unit: String(fd.get('unit') || 'pièce').trim() || 'pièce',
    quantity: Math.max(0, Number(fd.get('quantity')) || 0),
    stock: [1, 2, 3].includes(Number(fd.get('stock'))) ? Number(fd.get('stock')) : 1,
    category_id: fd.get('category_id') ? Number(fd.get('category_id')) : null,
    zone_id: fd.get('zone_id') ? Number(fd.get('zone_id')) : null,
    sub_zone: String(fd.get('sub_zone') || '').trim() || null,
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
  return {
    items: (data || [])
      .map((r) => ({ id: r.id, name: r.name, product_count: r.products?.[0]?.count || 0 }))
      .sort((a, b) => naturalCompare(a.name, b.name)),
  };
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

  const build = (table, withJoins, norm) => {
    let query = supabase.from(table).select('*', { count: 'exact' });
    const search = q.get('search');
    if (search && norm) {
      for (const w of searchWords(search)) query = query.ilike('search_text', `%${w}%`);
    } else if (search) {
      const s = sanitizeSearch(search);
      if (s) query = query.ilike('product_name', `%${s}%`);
    }
    if (q.get('user')) query = query.eq('user_name', q.get('user'));
    if (q.get('action')) query = query.eq('action', q.get('action'));
    if (withJoins) {
      if (q.get('category')) query = query.eq('category_id', Number(q.get('category')));
      if (q.get('stock')) query = query.eq('stock', Number(q.get('stock')));
    }
    return query.order('id', { ascending: false }).range((page - 1) * limit, page * limit - 1);
  };

  // movements_list (avec catégorie/stock) ; repli sur la table brute si la
  // base n'a pas encore reçu la mise à jour du schéma
  let { data, error, count } = await build('movements_list', true, true);
  if (error) ({ data, error, count } = await build('movements_list', true, false));
  if (error) ({ data, error, count } = await build('movements', false, false));
  if (error) throw fail(error.message);
  // Photo du produit concerné, quand il existe encore et qu'il en a une
  const items = data || [];
  const ids = [...new Set(items.map((m) => m.product_id).filter((id) => id != null))];
  if (ids.length) {
    const { data: rows } = await supabase.from('products').select('id, photo').in('id', ids);
    const photos = new Map((rows || []).map((r) => [r.id, r.photo]));
    for (const m of items) m.photo = photos.get(m.product_id) || null;
  }
  return { items, total: count || 0, page, limit };
}

async function movementUsers() {
  const { data, error } = await supabase.from('movement_users').select('*').order('user_name');
  if (error) return { users: [] };
  return { users: (data || []).map((r) => r.user_name) };
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
  if (patch.role && ['admin', 'gestionnaire', 'lecteur', 'utilisateur'].includes(patch.role)) {
    if (id === session?.user?.id && patch.role !== 'admin')
      throw fail('Vous ne pouvez pas retirer votre propre rôle admin');
    upd.role = patch.role;
  }
  if (patch.status && ['pending', 'active', 'disabled'].includes(patch.status)) {
    if (id === session?.user?.id) throw fail('Vous ne pouvez pas modifier votre propre statut');
    upd.status = patch.status;
  }
  const { error } = await supabase.from('profiles').update(upd).eq('id', id);
  if (error) throw fail(error.code === '23514' ? SCHEMA_HINT : error.message);
  return { ok: true };
}

async function setUserPassword(id, password) {
  if (String(password || '').length < 6) throw fail('Le mot de passe doit faire au moins 6 caractères');
  const { error } = await supabase.rpc('admin_set_password', { target: id, new_password: String(password) });
  if (error) throw fail(isSchemaError(error) ? SCHEMA_HINT : error.message);
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
  for (const key of ['stock1_name', 'stock2_name', 'stock3_name', 'registration_password']) {
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

// Export en vrai fichier Excel (.xlsx) : contrairement au CSV, l'encodage
// y est sans ambiguïté — les accents passent partout (Excel, Google Sheets…).
const xmlEsc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const cellStr = (v) => `<c t="inlineStr"><is><t xml:space="preserve">${xmlEsc(v)}</t></is></c>`;
const cellNum = (v) => `<c><v>${Number(v) || 0}</v></c>`;

export async function exportExcel(settings) {
  const { default: JSZip } = await import('jszip');
  const products = await fetchAll('products_list');
  const stockNames = { 1: settings.stock1_name || 'Stock 1', 2: settings.stock2_name || 'Stock 2', 3: settings.stock3_name || 'E.P.' };

  const header = ['Nom', 'Marque', 'Référence', 'Code-barres', 'Quantité', 'Unité', 'Seuil alerte', 'Stock', 'Catégorie', 'Zone', 'Emplacement', 'Dernière modification'];
  const rows = [header.map(cellStr).join('')];
  for (const r of products.sort((a, b) => a.name.localeCompare(b.name, 'fr'))) {
    rows.push(
      [cellStr(r.name), cellStr(r.brand), cellStr(r.reference), cellStr(r.barcode), cellNum(r.quantity), cellStr(r.unit), cellNum(r.alert_threshold),
       cellStr(stockNames[r.stock]), cellStr(r.category_name), cellStr(r.zone_name), cellStr(r.sub_zone),
       cellStr(new Date(r.updated_at).toLocaleString('fr-FR'))].join('')
    );
  }
  const sheet =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>' +
    rows.map((cells) => `<row>${cells}</row>`).join('') +
    '</sheetData></worksheet>';

  const zip = new JSZip();
  zip.file('[Content_Types].xml',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
    '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
    '</Types>');
  zip.file('_rels/.rels',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
    '</Relationships>');
  zip.file('xl/workbook.xml',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
    '<sheets><sheet name="Inventaire" sheetId="1" r:id="rId1"/></sheets></workbook>');
  zip.file('xl/_rels/workbook.xml.rels',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
    '</Relationships>');
  zip.file('xl/worksheets/sheet1.xml', sheet);

  const buf = await zip.generateAsync({ type: 'arraybuffer' });
  download(
    new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    `inventaire-${new Date().toISOString().slice(0, 10)}.xlsx`
  );
}

export async function exportBackup() {
  const { default: JSZip } = await import('jszip');
  const [categories, zones, products, movements, settingsRows, tasks] = await Promise.all([
    fetchAll('categories'), fetchAll('zones'), fetchAll('products'), fetchAll('movements'),
    supabase.from('settings').select('*').then((r) => r.data || []),
    // Tâches : absentes tant que la base n'a pas reçu la mise à jour
    fetchAll('tasks').catch(() => null),
  ]);
  const zip = new JSZip();
  zip.file('data.json', JSON.stringify({
    version: 3, exported_at: new Date().toISOString(),
    categories, zones, products, movements, settings: settingsRows,
    ...(tasks ? { tasks } : {}),
  }, null, 2));

  // Toutes les images : photos des produits + photos des tâches en cours
  const wanted = [
    ...products.filter((p) => p.photo).map((p) => ['photos', p.photo]),
    ...(tasks || []).flatMap((t) => (t.photos || []).map((path) => ['task-photos', path])),
  ];
  let next = 0;
  const worker = async () => {
    while (next < wanted.length) {
      const [bucket, path] = wanted[next++];
      try {
        const res = await fetch(fileUrl(bucket, path));
        if (res.ok) zip.file(`${bucket}/${path}`, await res.blob());
      } catch {}
    }
  };
  await Promise.all(Array.from({ length: 6 }, worker));

  const blob = await zip.generateAsync({ type: 'blob' });
  download(blob, `sauvegarde-stock-${new Date().toISOString().slice(0, 10)}.zip`);
}

const IMAGE_TYPES = { webp: 'image/webp', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif' };

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
      // Les sauvegardes d'avant les tâches n'en contiennent pas : dans ce cas
      // les tâches actuelles ne sont pas touchées
      ...(Array.isArray(dump.tasks) ? { tasks: dump.tasks } : {}),
    },
  });
  if (error) throw fail('Échec de la restauration : ' + error.message);
  for (const bucket of ['photos', 'task-photos']) {
    const prefix = `${bucket}/`;
    const names = Object.keys(zip.files).filter((n) => n.startsWith(prefix) && !zip.files[n].dir);
    for (const name of names) {
      const blob = await zip.file(name).async('blob');
      const contentType = IMAGE_TYPES[name.split('.').pop().toLowerCase()] || 'application/octet-stream';
      await supabase.storage.from(bucket).upload(name.slice(prefix.length), blob, { upsert: true, contentType });
    }
  }
  return { ok: true, products: dump.products.length, tasks: Array.isArray(dump.tasks) ? dump.tasks.length : null };
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
    if (seg[1] === 'brands') return productBrands();
    if (seg[1] === 'suggest') return productSuggestions();
    if (seg.length === 1) return method === 'POST' ? createProduct(body) : listProducts(q);
    if (seg[2] === 'adjust') return supabase.rpc('adjust_quantity', { pid: Number(seg[1]), delta: Number(body.delta) })
      .then(({ data, error }) => { if (error) throw fail(error.message); return { ok: true, quantity: data }; });
    if (method === 'PUT') return updateProduct(Number(seg[1]), body);
    if (method === 'DELETE') return deleteProduct(Number(seg[1]));
    if (method === 'GET') return getProduct(Number(seg[1]));
  }
  if (seg[0] === 'categories' || seg[0] === 'zones') {
    const label = seg[0] === 'categories' ? 'Catégorie' : 'Zone';
    if (seg.length === 1) return method === 'POST' ? createRef(seg[0], body.name, label) : listRef(seg[0]);
    if (method === 'PUT') return renameRef(seg[0], Number(seg[1]), body.name, label);
    if (method === 'DELETE') return deleteRef(seg[0], Number(seg[1]));
  }
  if (seg[0] === 'movements') return seg[1] === 'users' ? movementUsers() : listMovements(q);
  if (seg[0] === 'users') {
    if (seg.length === 1) return listUsers();
    if (seg[2] === 'password') return setUserPassword(seg[1], body.password);
    if (method === 'PUT') return updateUser(seg[1], body);
    if (method === 'DELETE') return deleteUser(seg[1]);
  }
  if (seg[0] === 'settings') return method === 'PUT' ? putSettings(body) : getSettings();

  throw fail(`Route inconnue : ${path}`, 404);
}
