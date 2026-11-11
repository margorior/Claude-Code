// Briques d'affichage communes à l'onglet Tâches (thème noir et jaune)
import { createPortal } from 'react-dom';
import { Check, CalendarDays, ListChecks, Image as ImageIcon, MapPin, DatabaseZap, RefreshCw } from 'lucide-react';
import { useLayer, Spinner } from '../components/ui';
import { SCHEMA_HINT } from '../api';
import { checklistProgress, initials } from '../lib/tasks';
import { fmt, fmtShort, relativeDay, todayISO } from '../lib/dates';
import { useTasks } from './TasksContext';

/* ------------------------------------------------------------- Fenêtres */
// Plein écran sur téléphone, fenêtre centrée sur ordinateur. Le bouton retour
// du téléphone la referme (et seulement elle).
export function Sheet({ open, onClose, children, labelledBy, size = 'lg' }) {
  useLayer(open, onClose);
  if (!open) return null;
  const width = size === 'sm' ? 'sm:max-w-md' : size === 'md' ? 'sm:max-w-2xl' : 'sm:max-w-4xl';
  return createPortal(
    <div
      className={`tasks-scope fixed inset-0 flex justify-center bg-black/70 ${size === 'sm' ? 'z-[70] items-end p-0 sm:items-center sm:p-4' : 'z-50 items-stretch sm:items-center sm:p-4'}`}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        className={`flex w-full flex-col overflow-hidden bg-ink-850 text-ink-50 shadow-lift sm:rounded-3xl sm:border sm:border-ink-700 ${width} ${
          size === 'sm' ? 'max-h-[92dvh] rounded-t-3xl border-t border-ink-700' : 'h-full sm:h-auto sm:max-h-[92dvh]'
        }`}
      >
        {children}
      </div>
    </div>,
    document.body
  );
}

export function TConfirm({ open, onClose, onConfirm, title, message, confirmLabel = 'Confirmer', danger = false }) {
  return (
    <Sheet open={open} onClose={onClose} size="sm" labelledBy="t-confirm-title">
      <div className="p-5">
        <h2 id="t-confirm-title" className="font-display text-lg font-bold">{title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-100">{message}</p>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" className="t-btn-line" onClick={onClose}>Annuler</button>
          <button type="button" className={danger ? 't-btn bg-late text-ink-900 hover:brightness-110' : 't-btn-sun'} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </Sheet>
  );
}

/* --------------------------------------------------------------- Petits */
export function Avatar({ name, size = 28, className = '' }) {
  return (
    <span
      aria-hidden="true"
      title={name}
      style={{ width: size, height: size, fontSize: Math.max(10, Math.round(size * 0.4)) }}
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-ink-600 font-bold text-ink-50 ${className}`}
    >
      {initials(name)}
    </span>
  );
}

// Étiquette d'avancement. « unseenLabel » : « Pas encore vue » côté
// administrateur, « Nouvelle » côté personne concernée.
export function StatusPill({ task, unseenLabel = 'Pas encore vue', className = '' }) {
  const base = `inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${className}`;
  if (task.status === 'done')
    return <span className={`${base} bg-ink-700 text-ink-100`}><Check size={13} strokeWidth={3} /> Terminée</span>;
  if (task.status === 'doing')
    return <span className={`${base} border border-sun text-sun`}><span className="h-1.5 w-1.5 rounded-full bg-sun" /> En cours</span>;
  if (task.assignee_id && !task.seen_at)
    return <span className={`${base} bg-sun text-ink-900`}>{unseenLabel}</span>;
  return <span className={`${base} border border-ink-600 text-ink-100`}>À faire</span>;
}

// « 9 → 11 nov. », en orange si l'échéance est dépassée
export function dateInfo(task, today = todayISO()) {
  const { start_date: s, due_date: d } = task;
  if (!s && !d) return null;
  const late = task.status !== 'done' && d && d < today;
  const dueToday = task.status !== 'done' && d === today;
  let text;
  if (s && d && s !== d) {
    const sameMonth = s.slice(0, 7) === d.slice(0, 7);
    text = `${fmt(s, sameMonth ? { day: 'numeric' } : { day: 'numeric', month: 'short' })} → ${fmt(d, { day: 'numeric', month: 'short' })}`;
  } else {
    text = fmtShort(d || s);
  }
  const rel = d ? relativeDay(d, today) : '';
  return { text, late, dueToday, suffix: late ? 'en retard' : rel };
}

export function TaskMeta({ task, today, className = '' }) {
  const date = dateInfo(task, today);
  const { done, total } = checklistProgress(task);
  const photos = task.photos?.length || 0;
  if (!date && !total && !photos && !task.location) return null;
  return (
    <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-ink-300 ${className}`}>
      {date && (
        <span className={`inline-flex items-center gap-1.5 ${date.late ? 'font-semibold text-late' : date.dueToday ? 'font-semibold text-sun' : ''}`}>
          <CalendarDays size={14} aria-hidden="true" />
          {date.text}{date.suffix ? ` · ${date.suffix}` : ''}
        </span>
      )}
      {total > 0 && (
        <span className="inline-flex items-center gap-1.5"><ListChecks size={14} aria-hidden="true" />{done}/{total}</span>
      )}
      {photos > 0 && (
        <span className="inline-flex items-center gap-1.5"><ImageIcon size={14} aria-hidden="true" />{photos}</span>
      )}
      {task.location && (
        <span className="inline-flex min-w-0 items-center gap-1.5"><MapPin size={14} className="shrink-0" aria-hidden="true" /><span className="truncate">{task.location}</span></span>
      )}
    </div>
  );
}

/* ---------------------------------------------------- États d'une page */
// Renvoie l'écran d'attente / d'erreur à afficher, ou null si tout est prêt
export function TasksGate() {
  const { status, reload } = useTasks();
  if (status === 'ready') return null;
  if (status === 'loading') {
    return <div className="flex justify-center py-24 text-sun"><Spinner className="h-8 w-8" /></div>;
  }
  const schema = status === 'schema';
  return (
    <div className="mx-auto mt-10 max-w-lg rounded-2xl border border-ink-700 bg-ink-850 p-6 text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-ink-700 text-sun">
        <DatabaseZap size={24} />
      </div>
      <h2 className="font-display text-lg font-bold">{schema ? 'Dernière étape : mettre la base à jour' : 'Impossible de charger les tâches'}</h2>
      <p className="mt-2 text-sm leading-relaxed text-ink-100">
        {schema ? SCHEMA_HINT : 'Vérifiez la connexion internet, puis réessayez.'}
      </p>
      <button type="button" className="t-btn-sun mt-5" onClick={reload}><RefreshCw size={16} /> Réessayer</button>
    </div>
  );
}

export function PageTitle({ title, subtitle, children }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="font-display text-2xl font-bold tracking-tight sm:text-[28px]">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ink-300">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}
