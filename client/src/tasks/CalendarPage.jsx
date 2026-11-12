import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { useAuth } from '../AuthContext';
import { taskRange, taskState, initials } from '../lib/tasks';
import {
  todayISO, addDays, addMonths, startOfWeek, startOfMonth, daysBetween, fmt, fmtLong, fmtMonth,
} from '../lib/dates';
import { useTasks } from './TasksContext';
import { TasksGate, PageTitle, StatusPill, TaskMeta, Avatar } from './ui';
import TaskModal from './TaskModal';

const WEEKDAYS = ['lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.', 'dim.'];
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// Couleur d'une tâche selon son avancement
const TONES = {
  todo: 'bg-ink-600 text-ink-50',
  new: 'bg-ink-600 text-ink-50',
  doing: 'bg-sun text-neutral-950',
  late: 'bg-late text-white',
  done: 'bg-ink-750 text-ink-300 line-through',
};
const LEGEND = [['todo', 'À faire'], ['doing', 'En cours'], ['late', 'En retard'], ['done', 'Terminée']];

// Place les tâches d'une semaine sur des lignes, sans chevauchement
function layoutWeek(weekStart, tasks) {
  const weekEnd = addDays(weekStart, 6);
  const segments = [];
  for (const t of tasks) {
    const r = taskRange(t);
    if (!r || r[1] < weekStart || r[0] > weekEnd) continue;
    const from = r[0] < weekStart ? weekStart : r[0];
    const to = r[1] > weekEnd ? weekEnd : r[1];
    segments.push({ task: t, col: daysBetween(weekStart, from), span: daysBetween(from, to) + 1, cutLeft: r[0] < weekStart, cutRight: r[1] > weekEnd });
  }
  segments.sort((a, b) => a.col - b.col || b.span - a.span || a.task.id - b.task.id);
  const lanes = [];
  for (const s of segments) {
    let lane = lanes.findIndex((end) => end < s.col);
    if (lane === -1) lane = lanes.length;
    lanes[lane] = s.col + s.span - 1;
    s.lane = lane;
  }
  return { segments, lanes: lanes.length };
}

function Bar({ seg, today, showWho, peopleById, onOpen, tall }) {
  const { task } = seg;
  const who = showWho && task.assignee_id ? peopleById.get(task.assignee_id)?.display_name : null;
  return (
    <button
      type="button"
      onClick={() => onOpen(task.id)}
      title={who ? `${task.title} — ${who}` : task.title}
      style={{ gridColumn: `${seg.col + 1} / span ${seg.span}`, gridRow: seg.lane + 1 }}
      className={`pointer-events-auto mx-0.5 flex min-w-0 items-center gap-1 overflow-hidden px-1.5 text-left font-semibold transition hover:brightness-110 ${TONES[taskState(task, today)]} ${
        tall ? 'min-h-[34px] text-[13px]' : 'h-[22px] text-[11px] sm:text-xs'
      } ${seg.cutLeft ? 'rounded-l-none' : 'rounded-l-md'} ${seg.cutRight ? 'rounded-r-none' : 'rounded-r-md'}`}
    >
      {who && <span className="shrink-0 rounded bg-black/20 px-1 text-[10px] font-bold no-underline">{initials(who)}</span>}
      <span className="truncate">{task.title}</span>
    </button>
  );
}

// Une semaine du calendrier : fond cliquable par jour + tâches posées dessus
function WeekRow({ weekStart, month, tasks, today, maxLanes, tall, showWho, peopleById, onOpen, onDay }) {
  const { segments, lanes } = useMemo(() => layoutWeek(weekStart, tasks), [weekStart, tasks]);
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const shown = segments.filter((s) => s.lane < maxLanes);
  const hidden = days.map((_, i) => segments.filter((s) => s.lane >= maxLanes && s.col <= i && i < s.col + s.span).length);
  return (
    <div className={`relative ${tall ? 'min-h-[46dvh]' : 'min-h-[92px] sm:min-h-[112px]'}`}>
      <div className="absolute inset-0 grid grid-cols-7">
      {days.map((day, i) => {
        const outside = month && day.slice(0, 7) !== month;
        return (
          <button
            key={day}
            type="button"
            onClick={() => onDay(day)}
            aria-label={`Voir le ${fmtLong(day)}`}
            className={`flex flex-col items-start border-b border-r border-ink-700 p-1 text-left transition hover:bg-ink-800 ${i === 0 ? 'border-l' : ''} ${outside ? 'bg-ink-950/60' : ''}`}
          >
            <span className={`flex h-7 min-w-[28px] items-center justify-center rounded-full px-1.5 text-[13px] font-bold ${
              day === today ? 'bg-sun text-neutral-950' : outside ? 'text-ink-400' : 'text-ink-100'
            }`}>
              {fmt(day, { day: 'numeric' })}
            </span>
          </button>
        );
      })}
      </div>
      <div className="pointer-events-none relative grid auto-rows-min grid-cols-7 gap-y-1 pb-1.5 pt-9">
        {shown.map((s) => <Bar key={s.task.id} seg={s} today={today} showWho={showWho} peopleById={peopleById} onOpen={onOpen} tall={tall} />)}
        {hidden.map((n, i) => n > 0 && (
          <button
            key={`more-${i}`}
            type="button"
            onClick={() => onDay(days[i])}
            style={{ gridColumn: i + 1, gridRow: maxLanes + 1 }}
            className="pointer-events-auto mx-0.5 h-[20px] truncate rounded px-1 text-left text-[11px] font-bold text-ink-100 hover:bg-ink-700"
          >
            +{n}<span className="hidden sm:inline"> autre{n > 1 ? 's' : ''}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function DayList({ day, tasks, today, showWho, peopleById, onOpen, empty = 'Rien de prévu ce jour-là.' }) {
  const list = tasks.filter((t) => {
    const r = taskRange(t);
    return r && r[0] <= day && day <= r[1];
  });
  if (!list.length) return <p className="rounded-xl border border-dashed border-ink-700 px-3 py-5 text-center text-sm text-ink-300">{empty}</p>;
  return (
    <ul className="flex flex-col gap-2.5">
      {list.map((t) => {
        const who = showWho && t.assignee_id ? peopleById.get(t.assignee_id) : null;
        return (
          <li key={t.id}>
            <button type="button" onClick={() => onOpen(t.id)} className="flex w-full flex-col gap-2 rounded-2xl border border-ink-650 bg-ink-800 p-3.5 text-left transition hover:border-ink-400">
              <span className="flex w-full items-start justify-between gap-3">
                <span className={`min-w-0 break-words text-[15px] font-semibold ${t.status === 'done' ? 'text-ink-300 line-through' : ''}`}>{t.title}</span>
                <StatusPill task={t} className="shrink-0" />
              </span>
              <TaskMeta task={t} today={today} />
              {showWho && (
                <span className="flex items-center gap-2 text-[13px] text-ink-300">
                  {who ? <><Avatar name={who.display_name} size={22} />{who.display_name}</> : 'Non attribuée'}
                </span>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/* -------------------------------------------------------------- Calendrier */
// Vue Mois / Semaine / Jour. L'administrateur voit les tâches de tout le monde
// (avec un filtre par personne) ; les autres ne voient que les leurs.
export default function CalendarPage() {
  const { isAdmin } = useAuth();
  const { tasks, people, status, create } = useTasks();
  const today = todayISO();
  const [view, setView] = useState('month');
  const [cursor, setCursor] = useState(today);
  const [person, setPerson] = useState('');
  const [openId, setOpenId] = useState(null);
  const [newTitle, setNewTitle] = useState('');

  const peopleById = useMemo(() => new Map(people.map((p) => [p.id, p])), [people]);
  const visible = useMemo(() => tasks.filter((t) => {
    if (!isAdmin || !person) return true;
    return person === 'none' ? !t.assignee_id : t.assignee_id === person;
  }), [tasks, isAdmin, person]);
  const undated = visible.filter((t) => !taskRange(t) && t.status !== 'done');

  const month = cursor.slice(0, 7);
  const monthWeeks = useMemo(() => {
    const first = startOfWeek(startOfMonth(cursor));
    const weeks = Array.from({ length: 6 }, (_, i) => addDays(first, i * 7));
    // la 6e semaine n'est affichée que si elle contient encore des jours du mois
    return weeks.filter((w, i) => i < 5 || w.slice(0, 7) === month);
  }, [cursor, month]);
  const weekStart = startOfWeek(cursor);

  const move = (dir) => setCursor(view === 'month' ? addMonths(cursor, dir) : addDays(cursor, dir * (view === 'week' ? 7 : 1)));
  const openDay = (day) => { setCursor(day); setView('day'); };
  const label = view === 'month'
    ? fmtMonth(cursor)
    : view === 'week'
      ? `Semaine du ${fmt(weekStart, { day: 'numeric', month: weekStart.slice(0, 7) === addDays(weekStart, 6).slice(0, 7) ? undefined : 'short' })} au ${fmt(addDays(weekStart, 6), { day: 'numeric', month: 'long', year: 'numeric' })}`
      : cap(fmt(cursor, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }));

  const addOnDay = async (e) => {
    e.preventDefault();
    const title = newTitle.trim();
    if (!title) return;
    const positions = tasks.map((t) => t.position);
    const row = await create({
      title, start_date: cursor, due_date: cursor,
      position: positions.length ? Math.max(...positions) + 1024 : 1024,
      ...(person && person !== 'none' ? { assignee_id: person } : {}),
    });
    if (row) setNewTitle('');
  };

  const nav = 'flex h-11 w-11 items-center justify-center rounded-xl border border-ink-600 bg-ink-850 transition hover:bg-ink-750';
  const common = { today, showWho: isAdmin, peopleById, onOpen: setOpenId };

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 pb-10 pt-5 sm:px-6">
      <PageTitle title="Calendrier" subtitle={isAdmin ? 'Toutes les tâches, pour toute l\'équipe.' : 'Vos tâches, jour par jour.'}>
        {isAdmin && (
          <select aria-label="Filtrer par personne" className="t-input min-h-[44px] !w-auto" value={person} onChange={(e) => setPerson(e.target.value)}>
            <option value="">Tout le monde</option>
            {people.map((p) => <option key={p.id} value={p.id}>{p.display_name}</option>)}
            <option value="none">Non attribuées</option>
          </select>
        )}
      </PageTitle>

      {status !== 'ready' ? <TasksGate /> : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="t-btn-line" onClick={() => setCursor(today)}>Aujourd'hui</button>
            <button type="button" className={nav} aria-label="Précédent" onClick={() => move(-1)}><ChevronLeft size={18} /></button>
            <button type="button" className={nav} aria-label="Suivant" onClick={() => move(1)}><ChevronRight size={18} /></button>
            <h2 className="min-w-0 flex-1 basis-40 font-display text-lg font-bold sm:text-xl" aria-live="polite">{label}</h2>
            <div className="flex rounded-xl border border-ink-600 p-1" role="group" aria-label="Affichage">
              {[['month', 'Mois'], ['week', 'Semaine'], ['day', 'Jour']].map(([v, text]) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={view === v}
                  onClick={() => setView(v)}
                  className={`min-h-[36px] rounded-lg px-3 text-sm font-bold transition ${view === v ? 'bg-sun text-neutral-950' : 'text-ink-100 hover:bg-ink-750'}`}
                >
                  {text}
                </button>
              ))}
            </div>
          </div>

          {/* Semaine sur téléphone : une liste jour par jour, plus lisible que 7 colonnes étroites */}
          {view === 'week' && (
            <div className="flex flex-col gap-4 md:hidden">
              {Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)).map((day) => (
                <section key={day} className="flex flex-col gap-2">
                  <h3 className={`text-[13px] font-bold ${day === today ? 'text-accent' : 'text-ink-300'}`}>
                    {cap(fmtLong(day))}{day === today ? " · aujourd'hui" : ''}
                  </h3>
                  <DayList day={day} tasks={visible} empty="Rien de prévu." {...common} />
                </section>
              ))}
            </div>
          )}

          {view !== 'day' && (
            <div className={`overflow-hidden rounded-2xl border border-ink-700 bg-ink-850 ${view === 'week' ? 'hidden md:block' : ''}`}>
              <div className="grid grid-cols-7 border-b border-ink-700 bg-ink-950">
                {WEEKDAYS.map((d, i) => (
                  <div key={d} className="px-1 py-2 text-center text-xs font-bold text-ink-300">
                    {d}{view === 'week' && <span className="sr-only"> {fmt(addDays(weekStart, i), { day: 'numeric', month: 'long' })}</span>}
                  </div>
                ))}
              </div>
              {view === 'month'
                ? monthWeeks.map((w) => <WeekRow key={w} weekStart={w} month={month} tasks={visible} maxLanes={3} onDay={openDay} {...common} />)
                : <WeekRow weekStart={weekStart} tasks={visible} maxLanes={12} tall onDay={openDay} {...common} />}
            </div>
          )}

          {view === 'day' && (
            <div className="flex flex-col gap-3">
              {isAdmin && (
                <form onSubmit={addOnDay} className="flex gap-2">
                  <input className="t-input min-h-[44px]" aria-label="Nouvelle tâche ce jour-là" placeholder="Nouvelle tâche ce jour-là…" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
                  <button className="t-btn-sun shrink-0" disabled={!newTitle.trim()}><Plus size={16} /> Ajouter</button>
                </form>
              )}
              <DayList day={cursor} tasks={visible} {...common} />
            </div>
          )}

          <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-[13px] text-ink-300" aria-label="Légende">
            {LEGEND.map(([tone, text]) => (
              <li key={tone} className="flex items-center gap-1.5">
                <span className={`h-3 w-5 rounded ${TONES[tone].split(' ')[0]} ${tone === 'done' ? 'border border-ink-600' : ''}`} aria-hidden="true" />{text}
              </li>
            ))}
          </ul>

          {undated.length > 0 && (
            <details className="rounded-2xl border border-ink-700 bg-ink-850 p-3.5">
              <summary className="cursor-pointer text-sm font-bold">Tâches sans date ({undated.length})</summary>
              <ul className="mt-3 flex flex-col gap-2">
                {undated.map((t) => (
                  <li key={t.id}>
                    <button type="button" onClick={() => setOpenId(t.id)} className="flex min-h-[44px] w-full items-center justify-between gap-3 rounded-xl border border-ink-700 bg-ink-800 px-3 py-2 text-left text-sm font-semibold transition hover:border-ink-400">
                      <span className="min-w-0 break-words">{t.title}</span>
                      <StatusPill task={t} className="shrink-0" />
                    </button>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}

      <TaskModal taskId={openId} onClose={() => setOpenId(null)} />
    </div>
  );
}
