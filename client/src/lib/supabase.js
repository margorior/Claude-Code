import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config';

export const configured =
  typeof SUPABASE_URL === 'string' && SUPABASE_URL.startsWith('https://') && SUPABASE_ANON_KEY.length > 20;

export const supabase = configured ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

export function photoUrl(path) {
  if (!path) return null;
  return `${SUPABASE_URL}/storage/v1/object/public/photos/${path}`;
}

// Les comptes utilisent un identifiant simple ; Supabase exige un email.
export function usernameToEmail(username) {
  return `${String(username).trim().toLowerCase()}@stock-app.local`;
}
