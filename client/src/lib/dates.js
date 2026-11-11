// Dates « jour » au format AAAA-MM-JJ, toujours en heure locale (jamais en UTC,
// sinon le jour peut reculer d'un cran autour de minuit).
const pad = (n) => String(n).padStart(2, '0');

export const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export function parseISO(iso) {
  const [y, m, d] = String(iso).split('-').map(Number);
  return new Date(y, m - 1, d);
}

export const todayISO = () => toISO(new Date());

export function addDays(iso, n) {
  const d = parseISO(iso);
  d.setDate(d.getDate() + n);
  return toISO(d);
}

export function addMonths(iso, n) {
  const d = parseISO(iso);
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  return toISO(d);
}

// Lundi de la semaine qui contient ce jour
export function startOfWeek(iso) {
  const d = parseISO(iso);
  return addDays(iso, -((d.getDay() + 6) % 7));
}

export const startOfMonth = (iso) => `${iso.slice(0, 8)}01`;

export function daysBetween(a, b) {
  return Math.round((parseISO(b) - parseISO(a)) / 86400000);
}

export const fmt = (iso, options) => parseISO(iso).toLocaleDateString('fr-FR', options);

// « lun. 9 nov. »
export const fmtShort = (iso) => fmt(iso, { weekday: 'short', day: 'numeric', month: 'short' });
// « mercredi 11 novembre »
export const fmtLong = (iso) => fmt(iso, { weekday: 'long', day: 'numeric', month: 'long' });
// « Novembre 2026 »
export function fmtMonth(iso) {
  const s = fmt(iso, { month: 'long', year: 'numeric' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// « aujourd'hui », « demain », « hier » ou rien
export function relativeDay(iso, today = todayISO()) {
  const n = daysBetween(today, iso);
  return n === 0 ? "aujourd'hui" : n === 1 ? 'demain' : n === -1 ? 'hier' : '';
}
