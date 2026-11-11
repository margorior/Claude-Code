import { useCallback, useEffect, useState } from 'react';
import { X, RotateCcw, Trash2, Archive } from 'lucide-react';
import { useToast, Spinner } from '../components/ui';
import { fetchClosedTasks, updateTask, deleteTask } from '../lib/tasks';
import { useTasks } from './TasksContext';
import { Sheet, TConfirm } from './ui';

const fmtDate = (iso) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });

// Archive des tâches clôturées : on peut en rouvrir une ou l'effacer pour de bon
export default function ClosedTasks({ open, onClose }) {
  const { people, reload } = useTasks();
  const toast = useToast();
  const [items, setItems] = useState(null);
  const [toDelete, setToDelete] = useState(null);

  const load = useCallback(async () => {
    try {
      setItems(await fetchClosedTasks());
    } catch (e) {
      toast(e.message, 'error');
      setItems([]);
    }
  }, [toast]);

  useEffect(() => {
    if (open) {
      setItems(null);
      load();
    }
  }, [open, load]);

  const reopen = async (task) => {
    try {
      await updateTask(task.id, { closed_at: null, status: 'todo' });
      toast('Tâche rouverte : elle est de retour dans le tableau');
      setItems((list) => list.filter((t) => t.id !== task.id));
      reload();
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  const destroy = async () => {
    const task = toDelete;
    setToDelete(null);
    try {
      await deleteTask(task);
      setItems((list) => list.filter((t) => t.id !== task.id));
      toast('Tâche effacée');
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  const nameOf = (id) => people.find((p) => p.id === id)?.display_name;

  return (
    <Sheet open={open} onClose={onClose} size="md" labelledBy="closed-title">
      <header className="flex shrink-0 items-center gap-3 border-b border-ink-700 px-5 py-4">
        <h2 id="closed-title" className="flex-1 font-display text-xl font-bold">Tâches clôturées</h2>
        <button type="button" onClick={onClose} aria-label="Fermer" className="flex h-11 w-11 items-center justify-center rounded-xl border border-ink-600 transition hover:bg-ink-750">
          <X size={18} />
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        {items === null ? (
          <div className="flex justify-center py-12 text-sun"><Spinner className="h-7 w-7" /></div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-12 text-center text-ink-300">
            <Archive size={28} />
            <p className="text-sm">Aucune tâche clôturée pour le moment.</p>
          </div>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {items.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-ink-700 bg-ink-800 p-3.5">
                <div className="min-w-0 flex-1 basis-48">
                  <p className="break-words text-[15px] font-semibold">{t.title}</p>
                  <p className="mt-0.5 text-[13px] text-ink-300">
                    {nameOf(t.assignee_id) || 'Non attribuée'} · clôturée le {fmtDate(t.closed_at)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button type="button" className="t-btn-line !min-h-[40px] !px-3" onClick={() => reopen(t)}><RotateCcw size={15} /> Rouvrir</button>
                  <button type="button" className="t-btn-line !min-h-[40px] !px-3" aria-label={`Effacer « ${t.title} »`} title="Effacer définitivement" onClick={() => setToDelete(t)}>
                    <Trash2 size={15} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      <TConfirm
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={destroy}
        title="Effacer cette tâche ?"
        message={`« ${toDelete?.title} » sera effacée définitivement.`}
        confirmLabel="Effacer"
        danger
      />
    </Sheet>
  );
}
