import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config';

// Normalise l'adresse : on ne garde que la racine https://xxx.supabase.co
// même si on a collé par erreur un « /rest/v1/ » ou un « / » à la fin.
const BASE_URL = String(SUPABASE_URL || '')
  .trim()
  .replace(/\/+$/, '')
  .replace(/\/(rest|auth|storage)\/v1$/i, '')
  .replace(/\/+$/, '');

const KEY = String(SUPABASE_ANON_KEY || '').trim();

export const configured = BASE_URL.startsWith('https://') && KEY.length > 20 && !KEY.includes('REMPLACEZ');

export const supabase = configured ? createClient(BASE_URL, KEY) : null;

export function photoUrl(path) {
  if (!path) return null;
  return `${BASE_URL}/storage/v1/object/public/photos/${path}`;
}

// Les comptes utilisent un identifiant simple ; Supabase exige un email.
export function usernameToEmail(username) {
  return `${String(username).trim().toLowerCase()}@stock-app.local`;
}
