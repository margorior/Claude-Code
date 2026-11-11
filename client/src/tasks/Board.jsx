import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  DndContext, DragOverlay, MouseSensor, TouchSensor, KeyboardSensor, useSensor, useSensors, useDroppable,
  pointerWithin, rectIntersection, closestCenter, MeasuringStrategy,
} from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Plus, Archive, Check, Inbox, UserRound, X } from 'lucide-react';
import { useToast } from '../components/ui';
import { taskPhotoUrl } from '../lib/tasks';
import { todayISO } from '../lib/dates';
import { useTasks } from './TasksContext';
import { Avatar, StatusPill, TaskMeta, TasksGate, TConfirm } from './ui';
import TaskModal from './TaskModal';
import ClosedTasks from './ClosedTasks';

const STEP = 1024;
const key = (task) => `t:${task.id}`;
const idOf = (k) => Number(String(k).slice(2));

// Répartit les tâches dans les colonnes : à attribuer, une par personne, terminées
function buildOrder(tasks, people) {
  const known = new Set(people.map((p) => p.id));
  const order = { pool: [], done: [] };
  for (const p of people) order[`p:${p.id}`] = [];
  for (const t of [...tasks].sort((a, b) => a.position - b.position || a.id - b.id)) {
    const col = t.status === 'done' ? 'done' : t.assignee_id && known.has(t.assignee_id) ? `p:${t.assignee_id}` : 'pool';
    order[col].push(key(t));
  }
  return order;
}

function findCol(order, id) {
  const s = String(id);
  if (s.startsWith('col:')) return s.slice(4);
  if (s.startsWith('dock:')) return s.slice(5);
  return Object.keys(order).find((c) => order[c].includes(s)) || null;
}

/* ------------------------------------------------------------------ Carte */
function CardBody({ task, col, today, person, onClose, lifted = false }) {
  const cover = task.photos?.[0];
  return (
    <div className={`overflow-hidden rounded-xl border bg-ink-800 ${lifted ? 'rotate-2 border-sun shadow-lift' : 'border-ink-650'}`}>
      {cover && <img src={taskPhotoUrl(cover)} alt="" draggable={false} loading="lazy" className="pointer-events-none h-24 w-full object-cover" />}
      <div className="flex flex-col gap-2 p-3">
        <p className={`break-words text-[15px] font-semibold leading-snug ${task.status === 'done' ? 'text-ink-300' : ''}`}>{task.title}</p>
        {col !== 'pool' && <StatusPill task={task} className="self-start" />}
        <TaskMeta task={task} today={today} />
        {col === 'done' && (
          <div className="flex items-center justify-between gap-2 pt-0.5">
            <span className="flex min-w-0 items-center gap-1.5 text-[13px] text-ink-300">
              {person ? <><Avatar name={person.display_name} size={22} /><span className="truncate">{person.display_name}</span></> : 'Non attribuée'}
            </span>
            {onClose && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onClose(task); }}
                className="flex min-h-[36px] shrink-0 items-center gap-1.5 rounded-lg border border-ink-600 px-2.5 text-xs font-bold text-ink-50 transition hover:border-sun hover:text-sun"
              >
                <Archive size={13} /> Clôturer
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function SortableCard({ task, col, today, person, onOpen, onClose }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: key(task) });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      {...attributes}
      {...listeners}
      aria-roledescription="tâche déplaçable"
      onClick={() => onOpen(task.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && e.target === e.currentTarget) { e.preventDefault(); onOpen(task.id); return; }
        listeners?.onKeyDown?.(e);
      }}
      onContextMenu={(e) => e.preventDefault()}
      className={`drag-card cursor-grab rounded-xl outline-none transition-opacity focus-visible:ring-2 focus-visible:ring-sun ${isDragging ? 'opacity-30' : 'hover:brightness-110'}`}
    >
      <CardBody task={task} col={col} today={today} person={person} onClose={onClose} />
    </div>
  );
}

/* ----------------------------------------------------------------- Colonne */
function QuickAdd({ onAdd, autoFocus, placeholder, onDone }) {
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    const t = title.trim();
    if (!t || busy) return;
    setBusy(true);
    const ok = await onAdd(t);
    setBusy(false);
    if (ok) setTitle('');
  };
  return (
    <form onSubmit={submit} className="flex gap-2">
      <input
        className="t-input min-h-[44px]"
        aria-label="Nom de la nouvelle tâche"
        placeholder={placeholder}
        autoFocus={autoFocus}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Escape' && onDone) { e.stopPropagation(); onDone(); } }}
      />
      <button className="t-btn-sun shrink-0" disabled={!title.trim() || busy}>Ajouter</button>
      {onDone && (
        <button type="button" className="t-btn-line shrink-0 !px-3" aria-label="Annuler" onClick={onDone}><X size={16} /></button>
      )}
    </form>
  );
}

function Column({ col, ids, byId, peopleById, today, highlight, onOpen, onAdd, onCloseTask, onCloseAll }) {
  const { setNodeRef } = useDroppable({ id: `col:${col.id}` });
  const [adding, setAdding] = useState(false);
  const isPool = col.id === 'pool';
  const isDone = col.id === 'done';
  return (
    <section
      ref={setNodeRef}
      aria-label={col.title}
      className={`flex max-h-full w-[84vw] max-w-[320px] shrink-0 snap-center flex-col overflow-hidden rounded-2xl border bg-ink-850 transition-colors sm:w-[300px] ${
        highlight ? 'border-sun' : 'border-ink-700'
      }`}
    >
      {isPool && <div className="hazard h-2.5 shrink-0" aria-hidden="true" />}
      <header className="flex shrink-0 items-center gap-2.5 px-3.5 pb-2.5 pt-3.5">
        {col.person ? <Avatar name={col.person.display_name} size={30} /> : (
          <span className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-ink-700 text-ink-100" aria-hidden="true">
            {isDone ? <Check size={16} strokeWidth={3} /> : <Inbox size={16} />}
          </span>
        )}
        <h2 className="min-w-0 flex-1 truncate font-display text-[17px] font-bold">{col.title}</h2>
        <span className="rounded-full bg-ink-700 px-2 py-0.5 text-xs font-bold text-ink-100" aria-label={`${ids.length} tâche${ids.length > 1 ? 's' : ''}`}>{ids.length}</span>
      </header>

      {isPool && (
        <div className="shrink-0 px-3 pb-3">
          <QuickAdd placeholder="Nouvelle tâche…" onAdd={(title) => onAdd(col, title, 'top')} />
        </div>
      )}
      {isDone && ids.length > 0 && (
        <div className="shrink-0 px-3 pb-3">
          <button type="button" className="t-btn-line w-full" onClick={onCloseAll}><Archive size={15} /> Tout clôturer</button>
        </div>
      )}

      <div className="flex min-h-[64px] flex-1 flex-col gap-2.5 overflow-y-auto px-3 pb-3">
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          {ids.map((k) => {
            const task = byId.get(idOf(k));
            if (!task) return null;
            return (
              <SortableCard
                key={k}
                task={task}
                col={col.id}
                today={today}
                person={peopleById.get(task.assignee_id)}
                onOpen={onOpen}
                onClose={isDone ? onCloseTask : null}
              />
            );
          })}
        </SortableContext>
        {ids.length === 0 && (
          <p className="rounded-xl border border-dashed border-ink-600 px-3 py-4 text-center text-[13px] text-ink-300">
            {isPool ? 'Aucune tâche à attribuer.' : isDone ? 'Les tâches terminées arrivent ici.' : 'Déposez une tâche ici.'}
          </p>
        )}
      </div>

      {col.person && (
        <div className="shrink-0 border-t border-ink-700 p-2">
          {adding ? (
            <QuickAdd autoFocus placeholder={`Tâche pour ${col.person.display_name}…`} onAdd={(title) => onAdd(col, title, 'bottom')} onDone={() => setAdding(false)} />
          ) : (
            <button type="button" onClick={() => setAdding(true)} className="flex min-h-[40px] w-full items-center gap-2 rounded-lg px-2 text-sm font-semibold text-ink-300 transition hover:bg-ink-750 hover:text-ink-50">
              <Plus size={16} /> Ajouter une tâche
            </button>
          )}
        </div>
      )}
    </section>
  );
}

/* ---------------------------- Zone de dépôt rapide (pendant un déplacement) */
// Sur téléphone, une seule colonne tient à l'écran : pendant qu'on tient une
// tâche, toutes les destinations s'affichent en bas pour la déposer directement.
function DockTarget({ col, current }) {
  const { setNodeRef, isOver } = useDroppable({ id: `dock:${col.id}` });
  return (
    <div
      ref={setNodeRef}
      className={`flex min-h-[54px] items-center gap-2 rounded-xl border-2 px-2.5 text-sm font-bold leading-tight transition-colors ${
        isOver ? 'border-sun bg-sun text-ink-900' : current ? 'border-ink-600 bg-ink-900 text-ink-300' : 'border-ink-600 bg-ink-800 text-ink-50'
      }`}
    >
      {col.person ? <UserRound size={15} className="shrink-0" aria-hidden="true" /> : col.id === 'done' ? <Check size={15} strokeWidth={3} className="shrink-0" aria-hidden="true" /> : <Inbox size={15} className="shrink-0" aria-hidden="true" />}
      <span className="line-clamp-2 min-w-0 break-words">{col.title}</span>
    </div>
  );
}

function Dock({ columns, from, target, zoneRef }) {
  const aim = columns.find((c) => c.id === target);
  return createPortal(
    <div ref={zoneRef} className="tasks-scope fixed inset-x-0 bottom-0 z-40 border-t border-ink-600 bg-ink-950/95 px-3 text-ink-50 pb-[max(.75rem,env(safe-area-inset-bottom))] pt-2.5 backdrop-blur md:hidden">
      {/* Le doigt cache la case visée : on rappelle la destination au-dessus */}
      <p className="mb-2 min-h-[20px] text-center text-sm font-bold" aria-live="polite">
        {!aim ? <span className="text-ink-300">Glissez la tâche sur une destination</span>
          : aim.person ? <>Relâchez pour attribuer à <span className="text-sun">{aim.title}</span></>
            : aim.id === 'done' ? <>Relâchez pour la marquer <span className="text-sun">terminée</span></>
              : <>Relâchez pour la remettre <span className="text-sun">à attribuer</span></>}
      </p>
      <div className={`grid gap-2 ${columns.length > 8 ? 'grid-cols-3' : 'grid-cols-2'}`}>
        {columns.map((c) => <DockTarget key={c.id} col={c} current={c.id === from} />)}
      </div>
    </div>,
    document.body
  );
}

const announcements = (title) => ({
  onDragStart: ({ active }) => `Tâche « ${title(active.id)} » saisie.`,
  onDragOver: ({ active, over }) => (over ? `Tâche « ${title(active.id)} » au-dessus de ${title(over.id)}.` : ''),
  onDragEnd: ({ active, over }) => (over ? `Tâche « ${title(active.id)} » déposée sur ${title(over.id)}.` : `Tâche « ${title(active.id)} » reposée.`),
  onDragCancel: ({ active }) => `Déplacement annulé. La tâche « ${title(active.id)} » retourne à sa place.`,
});

/* ----------------------------------------------------------------- Tableau */
export default function Board() {
  const { tasks, people, status, patch, create, close, holdReloads } = useTasks();
  const toast = useToast();
  const today = todayISO();
  const [openId, setOpenId] = useState(null);
  const [closedOpen, setClosedOpen] = useState(false);
  const [confirmAll, setConfirmAll] = useState(false);
  const [toClose, setToClose] = useState(null);
  const [drag, setDrag] = useState(null); // { activeId, from, order }
  const [viaDock, setViaDock] = useState(false);
  const [dockTarget, setDockTarget] = useState(null); // destination rapide survolée
  const [inDock, setInDock] = useState(false); // doigt dans la zone de dépôt rapide
  const grab = useRef({ x: 0, y: 0, ox: 0, oy: 0, measured: false }); // point d'appui sur la carte
  const dragRef = useRef(null);
  dragRef.current = drag;
  const lastOver = useRef(null);
  const overDock = useRef(false);
  const dockZone = useRef(null);

  const columns = useMemo(() => [
    { id: 'pool', title: 'À attribuer' },
    ...people.map((p) => ({ id: `p:${p.id}`, title: p.display_name, person: p })),
    { id: 'done', title: 'Terminées' },
  ], [people]);
  const byId = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);
  const peopleById = useMemo(() => new Map(people.map((p) => [p.id, p])), [people]);
  const baseOrder = useMemo(() => buildOrder(tasks, people), [tasks, people]);
  const order = drag?.order ?? baseOrder;
  const orderRef = useRef(order);
  orderRef.current = order;

  useEffect(() => () => holdReloads(false), [holdReloads]);

  // Sur le tableau, tirer une carte vers le bas ne doit pas recharger la page
  // (geste « tirer pour actualiser » des téléphones)
  useEffect(() => {
    const root = document.documentElement;
    const previous = root.style.overscrollBehaviorY;
    root.style.overscrollBehaviorY = 'contain';
    return () => { root.style.overscrollBehaviorY = previous; };
  }, []);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    // Téléphone : appui long pour attraper une carte, un simple glissement fait défiler
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      keyboardCodes: { start: ['Space'], cancel: ['Escape'], end: ['Space', 'Enter'] },
    })
  );

  const autoScroll = useMemo(() => ({ canScroll: () => !overDock.current, threshold: { x: 0.14, y: 0.18 }, acceleration: 14 }), []);
  const measuring = useMemo(() => ({ droppable: { strategy: MeasuringStrategy.Always } }), []);

  // Où tombe la carte : une destination rapide, sinon la carte sous le doigt,
  // sinon la carte la plus proche dans la colonne survolée
  const collision = useCallback((args) => {
    const hits = pointerWithin(args);
    const dock = hits.find((c) => String(c.id).startsWith('dock:'));
    // Doigt dans la zone de dépôt rapide : le tableau ne doit plus défiler tout seul
    const zone = dockZone.current?.getBoundingClientRect();
    const p = args.pointerCoordinates;
    overDock.current = !!dock || (!!zone && zone.height > 0 && !!p && p.y >= zone.top);
    if (dock) return [dock];
    if (overDock.current) return [];
    // Souris / doigt : seule compte la colonne sous le pointeur. Entre deux
    // colonnes, on garde la dernière visée (sinon la carte hésiterait entre
    // les deux). Au clavier, il n'y a pas de pointeur : on se fie à la carte.
    const found = p ? hits : rectIntersection(args);
    let over = found.find((c) => String(c.id).startsWith('t:'))?.id ?? found.find((c) => String(c.id).startsWith('col:'))?.id;
    if (over == null) return lastOver.current ? [{ id: lastOver.current }] : [];
    if (String(over).startsWith('col:')) {
      const ids = orderRef.current[String(over).slice(4)] || [];
      const inside = closestCenter({ ...args, droppableContainers: args.droppableContainers.filter((c) => ids.includes(c.id)) });
      if (inside.length) over = inside[0].id;
    }
    lastOver.current = over;
    return [{ id: over }];
  }, []);

  const onDragStart = ({ active, activatorEvent }) => {
    holdReloads(true);
    setViaDock(false);
    setDockTarget(null);
    setInDock(false);
    lastOver.current = null;
    const point = activatorEvent?.touches?.[0] || activatorEvent;
    grab.current = { x: point?.clientX ?? 0, y: point?.clientY ?? 0, ox: 0, oy: 0, measured: false };
    setDrag({ activeId: active.id, from: findCol(baseOrder, active.id), order: baseOrder });
    try { navigator.vibrate?.(15); } catch {}
  };

  // Dans la zone de dépôt rapide, la carte tenue rétrécit pour laisser voir les cases
  const onDragMove = ({ active, delta }) => {
    const g = grab.current;
    const rect = active.rect.current.initial;
    if (!g.measured && rect) Object.assign(g, { ox: g.x - rect.left, oy: g.y - rect.top, measured: true });
    const zone = dockZone.current?.getBoundingClientRect();
    setInDock(!!zone && zone.height > 0 && grab.current.y + delta.y >= zone.top - 12);
  };

  // Pendant le survol d'une autre colonne, la carte s'y insère à l'écran
  const onDragOver = ({ active, over }) => {
    const overId = over ? String(over.id) : '';
    setDockTarget(overId.startsWith('dock:') ? overId.slice(5) : null);
    if (!over) return;
    if (overId.startsWith('dock:')) return;
    setDrag((d) => {
      if (!d) return d;
      const from = findCol(d.order, active.id);
      const to = findCol(d.order, overId);
      if (!from || !to || from === to) return d;
      const target = [...d.order[to]];
      let index = target.length;
      if (overId.startsWith('t:')) {
        const overIndex = target.indexOf(overId);
        const dragged = active.rect.current.translated;
        const below = dragged && dragged.top > over.rect.top + over.rect.height / 2;
        index = overIndex + (below ? 1 : 0);
      }
      target.splice(index, 0, active.id);
      return { ...d, order: { ...d.order, [from]: d.order[from].filter((k) => k !== active.id), [to]: target } };
    });
  };

  const finish = () => {
    setDrag(null);
    setDockTarget(null);
    setInDock(false);
    overDock.current = false;
    holdReloads(false);
  };

  const onDragEnd = ({ active, over }) => {
    const d = dragRef.current;
    if (!d || !over) return finish();
    let next = d.order;
    const overId = String(over.id);
    const from = findCol(next, active.id);
    if (overId.startsWith('dock:')) {
      const to = overId.slice(5);
      // Dépôt rapide : pas d'animation de retour, sinon le tableau défilerait
      // tout seul jusqu'à la colonne d'arrivée
      setViaDock(true);
      if (to !== from) next = { ...next, [from]: next[from].filter((k) => k !== active.id), [to]: [...next[to], active.id] };
    } else if (overId.startsWith('t:') && findCol(next, overId) === from) {
      const a = next[from].indexOf(active.id);
      const b = next[from].indexOf(overId);
      if (a !== b) next = { ...next, [from]: arrayMove(next[from], a, b) };
    }
    const col = findCol(next, active.id);
    const task = byId.get(idOf(active.id));
    if (task && col) drop(task, col, next[col], d.from);
    finish();
  };

  // Enregistre la nouvelle place de la carte : colonne (= attribution) et rang
  const drop = (task, col, ids, fromCol) => {
    const i = ids.indexOf(key(task));
    const at = (n) => (ids[n] ? byId.get(idOf(ids[n])) : undefined);
    const prev = at(i - 1);
    const next = at(i + 1);
    let position = task.position;
    if (prev && next) position = (prev.position + next.position) / 2;
    else if (prev) position = prev.position + STEP;
    else if (next) position = next.position - STEP;

    const changes = {};
    if (col === 'pool') {
      if (task.assignee_id) changes.assignee_id = null;
      if (task.status !== 'todo') changes.status = 'todo';
    } else if (col === 'done') {
      if (task.status !== 'done') changes.status = 'done';
    } else {
      const personId = col.slice(2);
      if (task.assignee_id !== personId) changes.assignee_id = personId;
      if (task.status === 'done' || (task.status === 'doing' && task.assignee_id !== personId)) changes.status = 'todo';
    }

    // Rangs trop serrés pour s'intercaler : on renumérote la colonne
    const tight = (prev && !(prev.position < position)) || (next && !(position < next.position));
    if (tight) {
      ids.forEach((k, n) => {
        const t = byId.get(idOf(k));
        const p = (n + 1) * STEP;
        if (!t) return;
        if (t.id === task.id) patch(t.id, { ...changes, position: p });
        else if (t.position !== p) patch(t.id, { position: p });
      });
    } else if (position !== task.position || Object.keys(changes).length) {
      patch(task.id, { ...changes, position });
    }

    if (col !== fromCol) {
      if ('assignee_id' in changes && changes.assignee_id) toast(`Tâche attribuée à ${peopleById.get(changes.assignee_id)?.display_name || '…'}`);
      else if (col === 'pool') toast('Tâche remise dans « À attribuer »');
      else if (col === 'done') toast('Tâche marquée terminée');
      else toast('Tâche rouverte');
    }
  };

  const add = async (col, title, where) => {
    const positions = tasks.map((t) => t.position);
    const position = !positions.length ? STEP : where === 'top' ? Math.min(...positions) - STEP : Math.max(...positions) + STEP;
    const row = await create({ title, position, ...(col.person ? { assignee_id: col.person.id } : {}) });
    return !!row;
  };

  const doneTasks = order.done.map((k) => byId.get(idOf(k))).filter(Boolean);
  const activeTask = drag ? byId.get(idOf(drag.activeId)) : null;
  const activeCol = drag ? findCol(order, drag.activeId) : null;
  const title = (id) => {
    const s = String(id);
    if (s.startsWith('t:')) return byId.get(idOf(s))?.title || '';
    return `la colonne ${columns.find((c) => c.id === findCol(order, s))?.title || ''}`;
  };

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] flex-col lg:h-dvh">
      <div className="shrink-0 px-4 pb-4 pt-5 sm:px-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-display text-2xl font-bold tracking-tight sm:text-[28px]">Tableau des tâches</h1>
            <p className="mt-1 text-sm text-ink-300">
              <span className="hidden md:inline">Créez une tâche, puis glissez-la sur une personne pour la lui attribuer.</span>
              <span className="md:hidden">Appui long sur une tâche, puis glissez-la sur une personne.</span>
            </p>
          </div>
          <button type="button" className="t-btn-line shrink-0 !px-3 sm:!px-4" onClick={() => setClosedOpen(true)} aria-label="Tâches clôturées" title="Tâches clôturées">
            <Archive size={16} /> <span className="hidden sm:inline">Tâches clôturées</span>
          </button>
        </div>
      </div>

      {status !== 'ready' ? <div className="px-4"><TasksGate /></div> : (
        <DndContext
          sensors={sensors}
          collisionDetection={collision}
          measuring={measuring}
          autoScroll={autoScroll}
          accessibility={{
            announcements: announcements(title),
            screenReaderInstructions: { draggable: 'Pour déplacer une tâche, appuyez sur Espace, utilisez les flèches, puis Espace pour la déposer. Échap annule. Entrée ouvre la fiche.' },
          }}
          onDragStart={onDragStart}
          onDragMove={onDragMove}
          onDragOver={onDragOver}
          onDragEnd={onDragEnd}
          onDragCancel={finish}
        >
          <div className={`flex min-h-0 flex-1 items-start gap-3 overflow-x-auto overflow-y-hidden overscroll-x-contain px-4 pb-4 sm:px-6 ${drag ? '' : 'snap-x snap-mandatory sm:snap-none'}`}>
            {columns.map((col) => (
              <Column
                key={col.id}
                col={col}
                ids={order[col.id] || []}
                byId={byId}
                peopleById={peopleById}
                today={today}
                highlight={!!drag && activeCol === col.id && drag.from !== col.id}
                onOpen={setOpenId}
                onAdd={add}
                onCloseTask={setToClose}
                onCloseAll={() => setConfirmAll(true)}
              />
            ))}
            <div className="w-1 shrink-0" aria-hidden="true" />
          </div>
          {drag && <Dock columns={columns} from={drag.from} target={dockTarget} zoneRef={dockZone} />}
          <DragOverlay zIndex={45} dropAnimation={viaDock ? null : undefined}>
            {activeTask && (
              <div
                className="cursor-grabbing transition-transform duration-150"
                style={{ transformOrigin: `${grab.current.ox}px ${grab.current.oy}px`, transform: inDock ? 'scale(.45)' : undefined }}
              >
                <CardBody task={activeTask} col={drag.from} today={today} person={peopleById.get(activeTask.assignee_id)} lifted />
              </div>
            )}
          </DragOverlay>
        </DndContext>
      )}

      <TaskModal taskId={openId} onClose={() => setOpenId(null)} />
      <ClosedTasks open={closedOpen} onClose={() => setClosedOpen(false)} />
      <TConfirm
        open={!!toClose}
        onClose={() => setToClose(null)}
        onConfirm={() => { close(toClose); setToClose(null); }}
        title="Clôturer cette tâche ?"
        message={`« ${toClose?.title} » quitte le tableau.${toClose?.photos?.length ? ` Ses photos (${toClose.photos.length}) seront supprimées définitivement.` : ''}`}
        confirmLabel="Clôturer"
      />
      <TConfirm
        open={confirmAll}
        onClose={() => setConfirmAll(false)}
        onConfirm={() => { doneTasks.forEach((t) => close(t)); setConfirmAll(false); }}
        title={`Clôturer les ${doneTasks.length} tâches terminées ?`}
        message="Elles quittent le tableau et leurs photos sont supprimées définitivement. Elles restent consultables dans « Tâches clôturées »."
        confirmLabel="Tout clôturer"
      />
    </div>
  );
}
