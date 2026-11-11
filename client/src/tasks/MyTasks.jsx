import { useMemo, useState } from 'react';
import { Bell, BellRing, ChevronLeft, ChevronRight, Check, CalendarCheck, RotateCcw } from 'lucide-react';
import { useAuth } from '../AuthContext';
import { taskRange, checklistProgress } from '../lib/tasks';
import { todayISO, addDays, startOfWeek, fmt, fmtLong, fmtMonth, relativeDay } from '../lib/dates';
import { useTasks } from './TasksContext';
import { TasksGate, dateInfo } from './ui';
import TaskModal from './TaskModal';

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/* ------------------------------------------------------------------ Carte */
function TaskCard({ task, today, onOpen }) {
  const { patch } = useTasks();
  const unseen = !task.seen_at;
  const { done, total } = checklistProgress(task);
  const photos = task.photos?.length || 0;
  const date = dateInfo(task, today);
  const seen = unseen ? { seen_at: new Date().toISOString() } : {};
  const setStatus = (status) => patch(task.id, { status, ...seen });

  return (
    <article className="flex flex-col gap-3 rounded-2xl border border-ink-650 bg-ink-800 p-3.5">
      <button type="button" onClick={() => onOpen(task.id)} className="flex min-h-[44px] flex-col items-start gap-1.5 rounded-lg text-left">
        {unseen && <span className="rounded-full bg-sun px-2.5 py-0.5 text-[11px] font-bold text-ink-900">Nouvelle</span>}
        <span className="break-words text-base font-bold leading-snug">{task.title}</span>
        <span className="flex flex-wrap gap-x-3 gap-y-0.5 text-[13px] text-ink-300">
          {date?.late && <span className="font-semibold text-late">En retard · à finir le {fmt(task.due_date, { day: 'numeric', month: 'short' })}</span>}
          {date?.dueToday && <span className="font-semibold text-sun">À finir aujourd'hui</span>}
          {date && !date.late && !date.dueToday && <span>{date.text}</span>}
          {total > 0 && <span>Check-list {done}/{total}</span>}
          {photos > 0 && <span>{photos} photo{photos > 1 ? 's' : ''}</span>}
          {task.location && <span className="break-words">{task.location}</span>}
        </span>
      </button>
      <div className="grid grid-cols-2 gap-2.5">
        <button
          type="button"
          aria-pressed={task.status === 'doing'}
          onClick={() => setStatus(task.status === 'doing' ? 'todo' : 'doing')}
          className={`t-btn min-h-[48px] border-[1.5px] border-sun text-[15px] ${task.status === 'doing' ? 'bg-sun text-ink-900' : 'text-sun hover:bg-sun/10'}`}
        >
          En cours
        </button>
        <button
          type="button"
          onClick={() => setStatus('done')}
          className="t-btn min-h-[48px] border-[1.5px] border-ink-50 text-[15px] text-ink-50 hover:bg-ink-50/10"
        >
          Terminer
        </button>
      </div>
    </article>
  );
}

function DoneCard({ task, onOpen }) {
  const { patch } = useTasks();
  return (
    <article className="flex items-center gap-3 rounded-2xl border border-ink-700 bg-ink-850 p-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink-700 text-sun" aria-hidden="true"><Check size={16} strokeWidth={3} /></span>
      <button type="button" onClick={() => onOpen(task.id)} className="min-h-[44px] min-w-0 flex-1 break-words text-left text-[15px] font-semibold text-ink-300 line-through">
        {task.title}
      </button>
      <button type="button" className="t-btn-line shrink-0 !px-3" onClick={() => patch(task.id, { status: 'doing' })}>
        <RotateCcw size={15} /> Rouvrir
      </button>
    </article>
  );
}

function Group({ title, tone = '', children }) {
  return (
    <section className="flex flex-col gap-2.5">
      <h2 className={`mt-2 text-[13px] font-bold ${tone || 'text-ink-300'}`}>{title}</h2>
      {children}
    </section>
  );
}

/* ------------------------------------------------------------ Mes tâches */
// Écran de la personne à qui l'on confie des tâches : la semaine, puis ses
// tâches avec deux boutons « En cours » et « Terminer ».
export default function MyTasks() {
  const { user } = useAuth();
  const { tasks, status, myUnseen, notifyPermission, enableNotifications } = useTasks();
  const today = todayISO();
  const [selected, setSelected] = useState(today);
  const [weekStart, setWeekStart] = useState(startOfWeek(today));
  const [openId, setOpenId] = useState(null);
  const [showDone, setShowDone] = useState(false);

  const mine = useMemo(() => tasks.filter((t) => t.assignee_id === user.id), [tasks, user.id]);
  const open = useMemo(() => mine.filter((t) => t.status !== 'done').sort((a, b) => a.position - b.position), [mine]);
  const done = useMemo(() => mine.filter((t) => t.status === 'done'), [mine]);

  const activeOn = (t, day) => {
    const r = taskRange(t);
    return !!r && r[0] <= day && day <= r[1];
  };

  // Regroupement : en retard, aujourd'hui, jours suivants, sans date
  const groups = useMemo(() => {
    if (selected !== today) {
      const list = open.filter((t) => activeOn(t, selected));
      return [{ key: selected, title: cap(fmtLong(selected)), items: list, empty: 'Rien de prévu ce jour-là.' }];
    }
    const late = [], now = [], undated = [], later = new Map();
    for (const t of open) {
      const r = taskRange(t);
      if (!r) undated.push(t);
      else if (r[1] < today) late.push(t);
      else if (r[0] <= today) now.push(t);
      else later.set(r[0], [...(later.get(r[0]) || []), t]);
    }
    const out = [];
    if (late.length) out.push({ key: 'late', title: 'En retard', tone: 'text-late', items: late });
    out.push({ key: 'today', title: `Aujourd'hui · ${fmtLong(today)}`, items: now, empty: undated.length || later.size || late.length ? "Rien de prévu aujourd'hui." : null });
    if (undated.length) out.push({ key: 'undated', title: 'Sans date', items: undated });
    for (const day of [...later.keys()].sort()) {
      const rel = relativeDay(day, today);
      out.push({ key: day, title: rel ? `${cap(rel)} · ${fmtLong(day)}` : cap(fmtLong(day)), items: later.get(day) });
    }
    return out;
  }, [open, selected, today]); // eslint-disable-line react-hooks/exhaustive-deps

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const firstName = user.displayName.split(' ')[0];
  const nothing = open.length === 0;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 pb-10 pt-5 sm:px-6">
      <header className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-ink-300">Bonjour {firstName}</p>
          <h1 className="font-display text-[28px] font-bold leading-tight tracking-tight">Mes tâches</h1>
        </div>
        <button
          type="button"
          onClick={() => (myUnseen.length ? setOpenId(myUnseen[0].id) : notifyPermission === 'default' && enableNotifications())}
          aria-label={myUnseen.length ? `Notifications : ${myUnseen.length} nouvelle${myUnseen.length > 1 ? 's' : ''} tâche${myUnseen.length > 1 ? 's' : ''}` : 'Notifications : rien de nouveau'}
          className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-ink-600 bg-ink-850 transition hover:bg-ink-750"
        >
          {myUnseen.length ? <BellRing size={20} /> : <Bell size={20} />}
          {myUnseen.length > 0 && (
            <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-sun px-1 text-xs font-bold text-ink-900">{myUnseen.length}</span>
          )}
        </button>
      </header>

      {status !== 'ready' ? <TasksGate /> : (
        <>
          {myUnseen.slice(0, 3).map((t) => (
            <button key={t.id} type="button" onClick={() => setOpenId(t.id)} className="flex items-center gap-3 rounded-2xl bg-sun px-3.5 py-3 text-left text-ink-900 transition hover:bg-sun-300">
              <BellRing size={20} className="shrink-0" aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-bold">Nouvelle tâche pour vous</span>
                <span className="mt-0.5 block break-words text-sm font-semibold leading-snug">{t.title}</span>
              </span>
              <span className="shrink-0 text-[13px] font-bold underline">Voir</span>
            </button>
          ))}

          {notifyPermission === 'default' && (
            <button type="button" onClick={enableNotifications} className="flex min-h-[44px] items-center gap-2.5 rounded-xl border border-ink-600 px-3.5 py-2 text-left text-[13px] font-semibold text-ink-100 transition hover:bg-ink-750">
              <Bell size={16} className="shrink-0 text-sun" aria-hidden="true" />
              Activer les notifications pour être prévenu d'une nouvelle tâche
            </button>
          )}

          {/* Semaine */}
          <section aria-label="Semaine" className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-bold">{fmtMonth(days[3])}</h2>
              <div className="flex gap-1.5">
                {selected !== today && (
                  <button type="button" className="t-btn-line !px-3 text-[13px]" onClick={() => { setSelected(today); setWeekStart(startOfWeek(today)); }}>Aujourd'hui</button>
                )}
                <button type="button" aria-label="Semaine précédente" className="flex h-11 w-11 items-center justify-center rounded-xl border border-ink-600 bg-ink-850 transition hover:bg-ink-750" onClick={() => setWeekStart(addDays(weekStart, -7))}>
                  <ChevronLeft size={18} />
                </button>
                <button type="button" aria-label="Semaine suivante" className="flex h-11 w-11 items-center justify-center rounded-xl border border-ink-600 bg-ink-850 transition hover:bg-ink-750" onClick={() => setWeekStart(addDays(weekStart, 7))}>
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
            <div className="grid grid-cols-7 gap-1.5">
              {days.map((day) => {
                const isSelected = day === selected;
                const has = open.some((t) => activeOn(t, day));
                return (
                  <button
                    key={day}
                    type="button"
                    aria-pressed={isSelected}
                    aria-label={`${fmtLong(day)}${has ? ', tâches prévues' : ''}`}
                    onClick={() => setSelected(day)}
                    className={`flex h-[66px] flex-col items-center justify-center gap-0.5 rounded-xl border transition ${
                      isSelected ? 'border-sun bg-sun text-ink-900' : day === today ? 'border-sun bg-ink-850 text-ink-50' : 'border-ink-700 bg-ink-850 text-ink-50 hover:bg-ink-750'
                    }`}
                  >
                    <span className={`text-[11px] font-semibold ${isSelected ? '' : 'text-ink-300'}`}>{fmt(day, { weekday: 'short' })}</span>
                    <span className="text-base font-bold">{fmt(day, { day: 'numeric' })}</span>
                    <span className={`h-1.5 w-1.5 rounded-full ${has ? (isSelected ? 'bg-ink-900' : 'bg-sun') : ''}`} />
                  </button>
                );
              })}
            </div>
          </section>

          {nothing && selected === today ? (
            <div className="mt-4 flex flex-col items-center gap-3 rounded-2xl border border-dashed border-ink-600 px-6 py-10 text-center">
              <CalendarCheck size={30} className="text-sun" />
              <p className="font-semibold">Aucune tâche en attente</p>
              <p className="text-sm text-ink-300">Vous serez prévenu dès qu'une tâche vous sera attribuée.</p>
            </div>
          ) : (
            groups.map((g) => (
              <Group key={g.key} title={g.title} tone={g.tone}>
                {g.items.map((t) => <TaskCard key={t.id} task={t} today={today} onOpen={setOpenId} />)}
                {g.items.length === 0 && g.empty && <p className="rounded-xl border border-dashed border-ink-700 px-3 py-4 text-center text-sm text-ink-300">{g.empty}</p>}
              </Group>
            ))
          )}

          {done.length > 0 && (
            <section className="mt-2 flex flex-col gap-2.5">
              <button type="button" aria-expanded={showDone} onClick={() => setShowDone(!showDone)} className="flex min-h-[44px] items-center justify-between rounded-xl px-1 text-left text-[13px] font-bold text-ink-300 hover:text-ink-50">
                Terminées ({done.length})
                <ChevronRight size={16} className={`transition-transform ${showDone ? 'rotate-90' : ''}`} />
              </button>
              {showDone && done.map((t) => <DoneCard key={t.id} task={t} onOpen={setOpenId} />)}
            </section>
          )}
        </>
      )}

      <TaskModal taskId={openId} onClose={() => setOpenId(null)} />
    </div>
  );
}
