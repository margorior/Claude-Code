import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  X, ChevronLeft, ChevronRight, Check, Trash2, Camera, Image as ImageIcon, MapPin, CalendarDays, Plus, ExternalLink, Archive,
} from 'lucide-react';
import { useAuth } from '../AuthContext';
import { useToast, useLayer, Spinner } from '../components/ui';
import CameraModal from '../components/CameraModal';
import { inAppCamera } from '../lib/photos';
import { taskPhotoUrl, checklistProgress, newItemId, mapsUrl, STATUS_LABELS } from '../lib/tasks';
import { todayISO } from '../lib/dates';
import { useTasks } from './TasksContext';
import { Sheet, TConfirm, StatusPill, Avatar, dateInfo } from './ui';

// Zone de texte qui grandit avec son contenu
function AutoTextarea({ value, ...props }) {
  const ref = useRef();
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight + 2}px`;
  }, [value]);
  return <textarea ref={ref} value={value} {...props} />;
}

/* ------------------------------------------------- Photo en grand écran */
function PhotoViewer({ photos, index, onIndex, onClose, onDelete }) {
  const open = index != null && !!photos[index];
  useLayer(open, onClose);
  const [confirm, setConfirm] = useState(false);
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'ArrowLeft' && index > 0) onIndex(index - 1);
      if (e.key === 'ArrowRight' && index < photos.length - 1) onIndex(index + 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, index, photos.length, onIndex]);
  if (!open) return null;
  const round = 'flex h-11 w-11 items-center justify-center rounded-full bg-ink-800/90 text-ink-50 transition hover:bg-ink-700 disabled:opacity-30';
  return (
    <div className="tasks-scope fixed inset-0 z-[60] flex flex-col bg-black/95" role="dialog" aria-modal="true" aria-label="Photo en grand">
      <div className="flex items-center justify-between gap-3 p-3">
        <span className="px-2 text-sm font-semibold text-white">Photo {index + 1} sur {photos.length}</span>
        <div className="flex gap-2">
          {onDelete && (
            <button type="button" className={round} aria-label="Supprimer cette photo" title="Supprimer cette photo" onClick={() => setConfirm(true)}>
              <Trash2 size={18} />
            </button>
          )}
          <button type="button" className={round} aria-label="Fermer" onClick={onClose}><X size={20} /></button>
        </div>
      </div>
      <div className="relative flex min-h-0 flex-1 items-center justify-center px-3 pb-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
        <img src={taskPhotoUrl(photos[index])} alt={`Photo ${index + 1}`} className="max-h-full max-w-full rounded-xl object-contain" />
        {photos.length > 1 && (
          <>
            <button type="button" className={`${round} absolute left-3 top-1/2 -translate-y-1/2`} aria-label="Photo précédente" disabled={index === 0} onClick={() => onIndex(index - 1)}>
              <ChevronLeft size={22} />
            </button>
            <button type="button" className={`${round} absolute right-3 top-1/2 -translate-y-1/2`} aria-label="Photo suivante" disabled={index === photos.length - 1} onClick={() => onIndex(index + 1)}>
              <ChevronRight size={22} />
            </button>
          </>
        )}
      </div>
      <TConfirm
        open={confirm}
        onClose={() => setConfirm(false)}
        onConfirm={() => { setConfirm(false); onDelete(photos[index]); }}
        title="Supprimer cette photo ?"
        message="Elle sera retirée de la tâche définitivement."
        confirmLabel="Supprimer"
        danger
      />
    </div>
  );
}

/* ------------------------------------------------------------- Sections */
function Checklist({ task, canEdit, big }) {
  const { patch } = useTasks();
  const [text, setText] = useState('');
  const list = Array.isArray(task.checklist) ? task.checklist : [];
  const { done, total } = checklistProgress(task);
  const save = (next) => patch(task.id, { checklist: next });
  const add = (e) => {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    save([...list, { id: newItemId(), text: t, done: false }]);
    setText('');
  };
  if (!total && !canEdit) return null;
  const box = big ? 'h-6 w-6' : 'h-5 w-5';
  return (
    <section className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-[15px] font-bold">Check-list</h3>
        {total > 0 && <span className="text-[13px] font-semibold text-ink-300">{done} sur {total}</span>}
      </div>
      {total > 0 && (
        <div className="h-2 overflow-hidden rounded-full bg-ink-700" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done} aria-label="Avancement de la check-list">
          <div className="h-2 rounded-full bg-sun transition-all" style={{ width: `${(done / total) * 100}%` }} />
        </div>
      )}
      <ul className="flex flex-col">
        {list.map((item) => (
          <li key={item.id} className={`flex items-center gap-3 ${big ? 'min-h-[48px]' : 'min-h-[44px]'}`}>
            <input
              id={`cl-${task.id}-${item.id}`}
              type="checkbox"
              checked={!!item.done}
              onChange={() => save(list.map((i) => (i.id === item.id ? { ...i, done: !i.done } : i)))}
              className={`${box} shrink-0 cursor-pointer accent-sun`}
            />
            <label htmlFor={`cl-${task.id}-${item.id}`} className={`min-w-0 flex-1 cursor-pointer break-words py-2 text-[15px] ${item.done ? 'text-ink-300 line-through' : ''}`}>
              {item.text}
            </label>
            {canEdit && (
              <button
                type="button"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-ink-300 transition hover:bg-ink-700 hover:text-ink-50"
                aria-label={`Retirer « ${item.text} »`}
                title="Retirer"
                onClick={() => save(list.filter((i) => i.id !== item.id))}
              >
                <X size={16} />
              </button>
            )}
          </li>
        ))}
      </ul>
      {canEdit && (
        <form onSubmit={add} className="flex gap-2">
          <input className="t-input" aria-label="Nouvel élément de la check-list" placeholder="Ajouter un élément" value={text} onChange={(e) => setText(e.target.value)} />
          <button className="t-btn-line shrink-0" disabled={!text.trim()}>Ajouter</button>
        </form>
      )}
    </section>
  );
}

function Photos({ task, canDelete, columns }) {
  const { addPhoto, removePhoto } = useTasks();
  const cameraRef = useRef();
  const galleryRef = useRef();
  const [cameraOpen, setCameraOpen] = useState(false);
  const [uploading, setUploading] = useState(0);
  const [viewer, setViewer] = useState(null);
  const photos = task.photos || [];

  const send = async (files) => {
    const list = [...files].filter((f) => f && f.size);
    if (!list.length) return;
    setUploading((n) => n + list.length);
    for (const f of list) {
      await addPhoto(task.id, f);
      setUploading((n) => n - 1);
    }
  };
  const pick = (e) => {
    send(e.target.files || []);
    e.target.value = '';
  };

  return (
    <section className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-[15px] font-bold">Photos</h3>
        {photos.length > 0 && <span className="text-[13px] font-semibold text-ink-300">{photos.length}</span>}
      </div>
      {(photos.length > 0 || uploading > 0) && (
        <div className={`grid gap-2.5 ${columns}`}>
          {photos.map((path, i) => (
            <button
              key={path}
              type="button"
              onClick={() => setViewer(i)}
              aria-label={`Agrandir la photo ${i + 1}`}
              className="aspect-[4/3] overflow-hidden rounded-xl border border-ink-650 bg-ink-750 transition hover:border-sun"
            >
              <img src={taskPhotoUrl(path)} alt="" loading="lazy" className="h-full w-full object-cover" />
            </button>
          ))}
          {Array.from({ length: uploading }, (_, i) => (
            <div key={`up-${i}`} className="flex aspect-[4/3] items-center justify-center rounded-xl border border-dashed border-ink-400 text-accent">
              <Spinner className="h-5 w-5" />
            </div>
          ))}
        </div>
      )}
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={pick} />
      <input ref={galleryRef} type="file" accept="image/*" multiple className="hidden" onChange={pick} />
      <div className="grid grid-cols-1 gap-2.5 min-[430px]:grid-cols-2">
        <button type="button" className="t-btn border border-dashed border-ink-400 text-ink-50 hover:bg-ink-750" onClick={() => (inAppCamera() ? setCameraOpen(true) : cameraRef.current.click())}>
          <Camera size={18} /> Prendre une photo
        </button>
        <button type="button" className="t-btn border border-dashed border-ink-400 text-ink-50 hover:bg-ink-750" onClick={() => galleryRef.current.click()}>
          <ImageIcon size={18} /> Galerie
        </button>
      </div>
      <p className="text-[13px] text-ink-300">Les photos sont supprimées automatiquement quand la tâche est clôturée.</p>

      <CameraModal open={cameraOpen} onClose={() => setCameraOpen(false)} onCapture={(f) => { setCameraOpen(false); send([f]); }} />
      <PhotoViewer
        photos={photos}
        index={viewer}
        onIndex={setViewer}
        onClose={() => setViewer(null)}
        onDelete={canDelete ? async (path) => { setViewer(null); await removePhoto(task.id, path); } : null}
      />
    </section>
  );
}

function DateLine({ task }) {
  const info = dateInfo(task, todayISO());
  if (!info) return null;
  return (
    <p className={`flex items-center gap-2 text-sm ${info.late ? 'font-semibold text-late' : info.dueToday ? 'font-semibold text-accent' : 'text-ink-300'}`}>
      <CalendarDays size={16} aria-hidden="true" />
      {info.text}{info.suffix ? ` · ${info.suffix}` : ''}
    </p>
  );
}

function LocationLine({ location }) {
  if (!location) return null;
  return (
    <a href={mapsUrl(location)} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm text-accent underline-offset-2 hover:underline">
      <MapPin size={16} className="shrink-0" aria-hidden="true" />
      <span className="min-w-0 break-words">{location}</span>
      <ExternalLink size={13} className="shrink-0" aria-hidden="true" />
    </a>
  );
}

/* ------------------------------------------ Fiche vue par l'attributaire */
function WorkerView({ task, onClose }) {
  const { patch } = useTasks();
  const setStatus = (status) => patch(task.id, { status });
  return (
    <>
      <header className="flex shrink-0 items-center gap-1 px-3 pt-3">
        <button type="button" onClick={onClose} className="flex h-11 items-center gap-1 rounded-xl pl-1 pr-3 text-[15px] font-semibold text-ink-300 transition hover:bg-ink-750 hover:text-ink-50">
          <ChevronLeft size={22} /> Mes tâches
        </button>
      </header>
      <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-5 pb-6 pt-2">
        <div className="flex flex-col gap-2.5">
          <StatusPill task={task} unseenLabel="Nouvelle" className="self-start" />
          <h2 id="task-title" className="break-words font-display text-2xl font-bold leading-tight">{task.title}</h2>
          <DateLine task={task} />
          <LocationLine location={task.location} />
        </div>
        {task.description && (
          <section className="flex flex-col gap-2">
            <h3 className="text-[15px] font-bold">Description</h3>
            <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed text-ink-100">{task.description}</p>
          </section>
        )}
        <Checklist task={task} canEdit={false} big />
        <Photos task={task} canDelete columns="grid-cols-2 sm:grid-cols-3" />
      </div>
      <div className="grid shrink-0 grid-cols-2 gap-2.5 border-t border-ink-700 bg-ink-950 px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
        <button
          type="button"
          aria-pressed={task.status === 'doing'}
          onClick={() => setStatus(task.status === 'doing' ? 'todo' : 'doing')}
          className={`t-btn min-h-[52px] border-[1.5px] border-sun text-base ${task.status === 'doing' ? 'bg-sun text-neutral-950' : 'text-accent hover:bg-sun/10'}`}
        >
          En cours
        </button>
        <button
          type="button"
          aria-pressed={task.status === 'done'}
          onClick={() => { setStatus(task.status === 'done' ? 'doing' : 'done'); if (task.status !== 'done') onClose(); }}
          className={`t-btn min-h-[52px] border-[1.5px] border-ink-50 text-base ${task.status === 'done' ? 'bg-neutral-900 text-white' : 'text-ink-50 hover:bg-ink-50/10'}`}
        >
          {task.status === 'done' ? <><Check size={18} strokeWidth={3} /> Terminée</> : 'Terminer'}
        </button>
      </div>
    </>
  );
}

/* ---------------------------------------- Fiche vue par l'administrateur */
function AdminView({ task, onClose }) {
  const { people, patch, remove, close } = useTasks();
  const [draft, setDraft] = useState({ title: task.title || '', description: task.description || '', location: task.location || '' });
  const dirty = useRef({});
  const latest = useRef({ draft, task });
  latest.current = { draft, task };
  const [confirm, setConfirm] = useState(null); // 'close' | 'delete'

  // Reprend les changements venus d'ailleurs, sauf dans un champ en cours de saisie
  useEffect(() => {
    setDraft((d) => ({
      title: dirty.current.title ? d.title : task.title || '',
      description: dirty.current.description ? d.description : task.description || '',
      location: dirty.current.location ? d.location : task.location || '',
    }));
  }, [task.title, task.description, task.location]);

  const saveField = (key) => {
    if (!dirty.current[key]) return;
    dirty.current[key] = false;
    const { draft: d, task: t } = latest.current;
    const value = d[key].trim();
    if (key === 'title' && !value) return setDraft((x) => ({ ...x, title: t.title }));
    if (value !== (t[key] || '')) patch(t.id, { [key]: value || null });
  };
  // Fermeture par le bouton retour : on enregistre ce qui était en cours de saisie
  useEffect(() => () => ['title', 'description', 'location'].forEach(saveField), []); // eslint-disable-line react-hooks/exhaustive-deps

  const edit = (key) => (e) => {
    dirty.current[key] = true;
    setDraft((d) => ({ ...d, [key]: e.target.value }));
  };

  const assignee = people.find((p) => p.id === task.assignee_id);
  const assign = (id) => {
    const assignee_id = id || null;
    patch(task.id, { assignee_id, ...(task.status === 'doing' || !assignee_id ? { status: 'todo' } : {}) });
  };
  const photoCount = task.photos?.length || 0;
  const where = task.status === 'done' ? 'Terminées' : assignee ? assignee.display_name : 'À attribuer';

  return (
    <>
      <header className="flex shrink-0 items-start gap-3 border-b border-ink-700 px-5 py-4">
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-ink-300">Tâche · dans la colonne « {where} »</p>
          <AutoTextarea
            id="task-title"
            aria-label="Titre de la tâche"
            rows={1}
            value={draft.title}
            onChange={edit('title')}
            onBlur={() => saveField('title')}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); } }}
            className="mt-1 block w-full resize-none rounded-lg border border-transparent bg-transparent px-1.5 py-1 font-display text-[22px] font-bold leading-tight outline-none transition hover:border-ink-600 focus:border-sun focus:bg-ink-900 sm:text-2xl"
          />
        </div>
        <button type="button" onClick={onClose} aria-label="Fermer la fiche" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-ink-600 text-ink-50 transition hover:bg-ink-750">
          <X size={18} />
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
        <div className="flex flex-col gap-7 md:grid md:grid-cols-[minmax(0,1fr)_16rem] md:grid-rows-[auto_1fr] md:gap-x-7 md:gap-y-5">
          <div className="flex min-w-0 flex-col gap-7 md:col-start-1 md:row-span-2 md:row-start-1">
            <section className="flex flex-col gap-2">
              <label htmlFor="task-description" className="text-[15px] font-bold">Description</label>
              <AutoTextarea
                id="task-description"
                rows={4}
                placeholder="Ajouter une description : consignes, matériel à prévoir…"
                value={draft.description}
                onChange={edit('description')}
                onBlur={() => saveField('description')}
                className="t-input min-h-[104px] resize-none text-[15px] leading-relaxed"
              />
            </section>
            <Checklist task={task} canEdit />
            <Photos task={task} canDelete columns="grid-cols-3 sm:grid-cols-4" />
          </div>

          <aside className="order-first flex flex-col gap-5 md:order-none md:col-start-2 md:row-start-1" aria-label="Réglages de la tâche">
            <div className="flex flex-col gap-2">
              <h3 className="t-label">Statut</h3>
              <div className="grid grid-cols-3 gap-1.5 md:grid-cols-1">
                {['todo', 'doing', 'done'].map((s) => (
                  <button
                    key={s}
                    type="button"
                    aria-pressed={task.status === s}
                    onClick={() => task.status !== s && patch(task.id, { status: s })}
                    className={`min-h-[44px] rounded-xl border px-2 text-center text-sm transition md:px-3.5 md:text-left ${
                      task.status === s ? 'border-sun bg-sun font-bold text-neutral-950' : 'border-ink-600 font-semibold text-ink-50 hover:bg-ink-750'
                    }`}
                  >
                    {STATUS_LABELS[s]}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="task-assignee" className="t-label">Attribuée à</label>
              <div className="flex items-center gap-2.5">
                {assignee && <Avatar name={assignee.display_name} size={36} />}
                <select id="task-assignee" className="t-input min-h-[44px]" value={task.assignee_id || ''} onChange={(e) => assign(e.target.value)}>
                  <option value="">Personne (à attribuer)</option>
                  {people.map((p) => <option key={p.id} value={p.id}>{p.display_name}</option>)}
                  {task.assignee_id && !assignee && <option value={task.assignee_id}>Compte désactivé</option>}
                </select>
              </div>
              {task.assignee_id && task.status !== 'done' && (
                <p className="text-[13px] text-ink-300">{task.seen_at ? 'A vu la tâche.' : "N'a pas encore vu la tâche."}</p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <h3 className="t-label">Dates</h3>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-1">
                <label className="flex flex-col gap-1 text-[13px] text-ink-300">
                  Début
                  <input type="date" className="t-input min-h-[44px]" value={task.start_date || ''} max={task.due_date || undefined}
                    onChange={(e) => patch(task.id, { start_date: e.target.value || null })} />
                </label>
                <label className="flex flex-col gap-1 text-[13px] text-ink-300">
                  Échéance
                  <input type="date" className="t-input min-h-[44px]" value={task.due_date || ''} min={task.start_date || undefined}
                    onChange={(e) => patch(task.id, { due_date: e.target.value || null })} />
                </label>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="task-location" className="t-label">Lieu</label>
              <input id="task-location" className="t-input min-h-[44px]" placeholder="Adresse ou nom du chantier" value={draft.location} onChange={edit('location')} onBlur={() => saveField('location')} />
              {task.location && (
                <a href={mapsUrl(task.location)} target="_blank" rel="noreferrer" className="inline-flex min-h-[32px] items-center gap-1.5 self-start text-[13px] font-semibold text-accent underline-offset-2 hover:underline">
                  <MapPin size={14} /> Ouvrir dans Maps
                </a>
              )}
            </div>

          </aside>

          <div className="flex flex-col gap-2 border-t border-ink-700 pt-4 md:col-start-2 md:row-start-2 md:self-start">
              <button type="button" className="t-btn-sun min-h-[48px]" onClick={() => setConfirm('close')}>
                <Archive size={17} /> Clôturer la tâche
              </button>
              <button type="button" className="t-btn-line" onClick={() => setConfirm('delete')}>
                <Trash2 size={16} /> Supprimer la tâche
              </button>
          </div>
        </div>
      </div>

      <TConfirm
        open={confirm === 'close'}
        onClose={() => setConfirm(null)}
        onConfirm={() => { setConfirm(null); onClose(true); close(task); }}
        title="Clôturer cette tâche ?"
        message={`Elle quitte le tableau et reste consultable dans « Tâches clôturées ».${photoCount ? ` Ses ${photoCount} photo${photoCount > 1 ? 's seront supprimées' : ' sera supprimée'} définitivement.` : ''}`}
        confirmLabel="Clôturer"
      />
      <TConfirm
        open={confirm === 'delete'}
        onClose={() => setConfirm(null)}
        onConfirm={() => { setConfirm(null); onClose(true); remove(task); }}
        title="Supprimer cette tâche ?"
        message={`« ${task.title} » sera effacée définitivement, avec sa check-list et ses photos.`}
        confirmLabel="Supprimer"
        danger
      />
    </>
  );
}

/* ----------------------------------------------------------------- Fiche */
// Ouvre la fiche de la tâche « taskId » (null = fermée). L'administrateur peut
// tout modifier ; les autres voient la tâche, cochent la check-list, ajoutent
// des photos et changent l'avancement.
export default function TaskModal({ taskId, onClose }) {
  const { tasks, patch } = useTasks();
  const { user, isAdmin } = useAuth();
  const toast = useToast();
  const task = taskId != null ? tasks.find((t) => t.id === taskId) : null;
  const expected = useRef(false);

  // La tâche a disparu pendant qu'elle était ouverte (supprimée, réattribuée…)
  useEffect(() => {
    if (taskId == null) {
      expected.current = false;
    } else if (!task) {
      if (!expected.current) toast("Cette tâche n'est plus disponible.", 'error');
      onClose();
    }
  }, [taskId, task]); // eslint-disable-line react-hooks/exhaustive-deps

  // Ouvrir sa tâche = l'avoir vue
  const mine = !!task && task.assignee_id === user.id;
  useEffect(() => {
    if (task && mine && !task.seen_at) patch(task.id, { seen_at: new Date().toISOString() });
  }, [task?.id, mine]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleClose = (self) => {
    if (self === true) expected.current = true;
    onClose();
  };

  return (
    <Sheet open={!!task} onClose={handleClose} labelledBy="task-title" size={isAdmin ? 'lg' : 'md'}>
      {task && (isAdmin
        ? <AdminView key={task.id} task={task} onClose={handleClose} />
        : <WorkerView key={task.id} task={task} onClose={handleClose} />)}
    </Sheet>
  );
}
