// Accès aux tâches (table « tasks » de Supabase) et petites fonctions communes
// à tous les écrans de l'onglet Tâches.
import { supabase, fileUrl } from './supabase';
import { fail, isSchemaError, SCHEMA_HINT } from '../api';
import { todayISO } from './dates';

function wrap(error) {
  const schema = isSchemaError(error);
  const err = fail(schema ? SCHEMA_HINT : error.message);
  err.schema = schema;
  return err;
}

/* ---------------------------------------------------------------- Lecture */
// Tâches en cours (non clôturées). L'administrateur les reçoit toutes ; les
// autres ne reçoivent que les leurs (règle appliquée par la base).
export async function fetchTasks() {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .is('closed_at', null)
    .order('position', { ascending: true })
    .order('id', { ascending: true });
  if (error) throw wrap(error);
  return data || [];
}

export async function fetchClosedTasks() {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .not('closed_at', 'is', null)
    .order('closed_at', { ascending: false })
    .limit(200);
  if (error) throw wrap(error);
  return data || [];
}

// Personnes à qui l'on peut attribuer une tâche (comptes actifs)
export async function fetchPeople() {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, display_name, username, role, status')
    .eq('status', 'active')
    .order('display_name', { ascending: true });
  if (error) throw wrap(error);
  return data || [];
}

/* --------------------------------------------------------------- Écriture */
export async function createTask(fields) {
  const { data, error } = await supabase.from('tasks').insert(fields).select('*').single();
  if (error) throw wrap(error);
  return data;
}

export async function updateTask(id, patch) {
  const { data, error } = await supabase.from('tasks').update(patch).eq('id', id).select('*').maybeSingle();
  if (error) throw wrap(error);
  if (!data) throw fail("Cette tâche n'est plus disponible (supprimée ou attribuée à quelqu'un d'autre).", 404);
  return data;
}

export async function deleteTask(task) {
  const { error } = await supabase.from('tasks').delete().eq('id', task.id);
  if (error) throw wrap(error);
  await removeTaskPhotos(task.photos);
}

/* ----------------------------------------------------------------- Photos */
export const taskPhotoUrl = (path) => fileUrl('task-photos', path);

export async function uploadTaskPhoto(taskId, file) {
  const ext = (file.name?.split('.').pop() || 'jpg').toLowerCase().slice(0, 5);
  const path = `${taskId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from('task-photos').upload(path, file, { contentType: file.type });
  if (error) throw fail(/bucket/i.test(error.message) ? SCHEMA_HINT : 'Envoi de la photo impossible : ' + error.message);
  return path;
}

export async function removeTaskPhotos(paths) {
  if (!paths?.length) return;
  try {
    await supabase.storage.from('task-photos').remove(paths);
  } catch {}
}

/* ------------------------------------------------------------- Affichage */
export const STATUS_LABELS = { todo: 'À faire', doing: 'En cours', done: 'Terminée' };

// État d'une tâche pour l'affichage :
// new (attribuée, pas encore vue) · todo · doing · late (échéance dépassée) · done
export function taskState(task, today = todayISO()) {
  if (task.status === 'done') return 'done';
  if (task.due_date && task.due_date < today) return 'late';
  if (task.status === 'doing') return 'doing';
  if (task.assignee_id && !task.seen_at) return 'new';
  return 'todo';
}

// Premier et dernier jour d'une tâche dans le calendrier (ou null sans date)
export function taskRange(task) {
  const a = task.start_date || task.due_date;
  const b = task.due_date || task.start_date;
  if (!a) return null;
  return a <= b ? [a, b] : [b, a];
}

export function checklistProgress(task) {
  const list = Array.isArray(task.checklist) ? task.checklist : [];
  return { done: list.filter((i) => i.done).length, total: list.length };
}

export function initials(name) {
  const parts = String(name || '?').trim().split(/\s+/);
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || parts[0]?.[1] || '')).toUpperCase();
}

export const newItemId = () => Math.random().toString(36).slice(2, 10);

export const mapsUrl = (location) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`;
