// Texte simplifié pour comparer sans tenir compte des majuscules, des accents,
// de la ponctuation ni des espaces. Doit rester identique à public.search_norm
// (supabase/schema.sql), mot par mot.
export function searchWords(s) {
  return String(s ?? '')
    .toLowerCase()
    .replace(/œ/g, 'oe').replace(/æ/g, 'ae').replace(/²/g, '2').replace(/³/g, '3')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .split(/\s+/)
    .map((w) => w.replace(/[^a-z0-9]/g, ''))
    .filter(Boolean);
}

// Marques et références : toujours en majuscules, sans espaces en trop
export function upperClean(s) {
  return String(s ?? '').replace(/\s+/g, ' ').trim().toUpperCase();
}

// Tri « naturel » : 2 avant 10, A avant B
export function naturalCompare(a, b) {
  return String(a).localeCompare(String(b), 'fr', { numeric: true, sensitivity: 'base' });
}

// Propositions pour un champ de saisie : chaque mot tapé doit se retrouver
// dans la proposition ; celles qui commencent par la saisie passent en premier.
export function suggest(list, typed, max = 8) {
  const words = searchWords(typed);
  if (!words.length) return [];
  const typedKey = words.join('');
  const out = [];
  for (const item of list) {
    const itemWords = searchWords(item);
    const key = itemWords.join('');
    if (!words.every((w) => key.includes(w))) continue;
    if (key === typedKey && item === String(typed).trim()) continue;
    const rank = key.startsWith(typedKey) ? 0 : itemWords.some((w) => w.startsWith(words[0])) ? 1 : 2;
    out.push({ item, rank });
  }
  return out
    .sort((a, b) => a.rank - b.rank || naturalCompare(a.item, b.item))
    .slice(0, max)
    .map((x) => x.item);
}
