import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../AuthContext';
import { useToast } from '../components/ui';
import {
  fetchTasks, fetchPeople, createTask, updateTask, deleteTask, uploadTaskPhoto, removeTaskPhotos,
} from '../lib/tasks';
import { resizeImage } from '../lib/photos';

const TasksContext = createContext(null);
export const useTasks = () => useContext(TasksContext);

export const canNotify = () => 'Notification' in window;

// Notification du téléphone / de l'ordinateur (si elle a été autorisée)
async function systemNotification(title, body) {
  try {
    if (!canNotify() || Notification.permission !== 'granted') return;
    const options = { body, icon: 'icon-192.png', badge: 'icon-192.png', tag: 'nouvelle-tache', renotify: true };
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) await reg.showNotification(title, options);
    else new Notification(title, options);
  } catch {}
}

// État partagé des tâches : chargé une fois, tenu à jour en direct, et modifié
// « à l'avance » à l'écran (sans attendre la réponse de la base) pour que le
// glisser-déposer et les cases à cocher répondent instantanément.
export function TasksProvider({ children }) {
  const { user, isAdmin } = useAuth();
  const toast = useToast();
  const [tasks, setTasks] = useState([]);
  const [people, setPeople] = useState([]);
  const [status, setStatus] = useState('loading'); // loading | ready | schema | error
  const [notifyPermission, setNotifyPermission] = useState(canNotify() ? Notification.permission : 'unsupported');

  const tasksRef = useRef(tasks);
  const statusRef = useRef(status);
  statusRef.current = status;
  const version = useRef(0); // augmente à chaque modification locale
  const writes = useRef(0); // enregistrements en cours
  const hold = useRef(false); // glisser-déposer en cours : on ne recharge pas
  const dirty = useRef(false);
  const timer = useRef(null);
  const queues = useRef(new Map());
  const knownUnseen = useRef(null);

  const commit = useCallback((fn) => {
    const next = fn(tasksRef.current);
    tasksRef.current = next;
    setTasks(next);
  }, []);

  const reload = useCallback(async () => {
    if (writes.current > 0 || hold.current) {
      dirty.current = true;
      return;
    }
    const v = version.current;
    try {
      const [t, p] = await Promise.all([fetchTasks(), isAdmin ? fetchPeople() : null]);
      // Une modification locale a eu lieu pendant le chargement : on recommencera
      if (v !== version.current || writes.current > 0 || hold.current) {
        dirty.current = true;
        return;
      }
      commit(() => t);
      if (p) setPeople(p);
      setStatus('ready');
    } catch (e) {
      setStatus((s) => (e.schema ? 'schema' : s === 'ready' ? 'ready' : 'error'));
    }
  }, [isAdmin, commit]);

  const schedule = useCallback(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(reload, 300);
  }, [reload]);

  const settle = useCallback(() => {
    if (writes.current === 0 && !hold.current && dirty.current) {
      dirty.current = false;
      schedule();
    }
  }, [schedule]);

  // Chargement, mise à jour en direct, et rattrapage régulier
  useEffect(() => {
    if (!user) return;
    reload();
    const channel = supabase
      .channel('tasks-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, schedule)
      .subscribe();
    const alive = () => document.visibilityState === 'visible' && statusRef.current !== 'schema';
    const poll = setInterval(() => alive() && reload(), 45000);
    const onVisible = () => alive() && schedule();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      supabase.removeChannel(channel);
      clearInterval(poll);
      clearTimeout(timer.current);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [user?.id, reload, schedule]);

  // Nouvelle tâche attribuée à la personne connectée → notification
  const myUnseen = useMemo(
    () => (user ? tasks.filter((t) => t.assignee_id === user.id && !t.seen_at && t.status !== 'done') : []),
    [tasks, user]
  );
  useEffect(() => {
    if (status !== 'ready') return;
    const ids = new Set(myUnseen.map((t) => t.id));
    if (knownUnseen.current) {
      const fresh = myUnseen.filter((t) => !knownUnseen.current.has(t.id));
      if (fresh.length) {
        const title = fresh.length === 1 ? 'Nouvelle tâche pour vous' : `${fresh.length} nouvelles tâches pour vous`;
        const body = fresh.map((t) => t.title).join(' · ');
        toast(`${title} : ${body}`);
        try { navigator.vibrate?.([120, 80, 120]); } catch {}
        systemNotification(title, body);
      }
    }
    knownUnseen.current = ids;
  }, [myUnseen, status, toast]);

  // Les enregistrements d'une même tâche partent l'un après l'autre, dans l'ordre
  const enqueue = useCallback((id, job) => {
    const next = (queues.current.get(id) || Promise.resolve()).catch(() => {}).then(job);
    queues.current.set(id, next);
    return next;
  }, []);

  const write = useCallback(async (job) => {
    version.current++;
    writes.current++;
    try {
      return await job();
    } catch (e) {
      toast(e.message, 'error');
      return null;
    } finally {
      writes.current--;
      dirty.current = true;
      settle();
    }
  }, [toast, settle]);

  const patch = useCallback((id, changes) => {
    const current = tasksRef.current.find((t) => t.id === id);
    const local = { ...changes };
    if (current && 'assignee_id' in changes && changes.assignee_id !== current.assignee_id) {
      // comme dans la base : une tâche réattribuée redevient « pas encore vue »
      local.seen_at = changes.assignee_id && changes.assignee_id === user?.id ? new Date().toISOString() : null;
    }
    if (changes.status === 'done' && current?.status !== 'done') local.done_at = new Date().toISOString();
    return write(() => {
      commit((ts) => ts.map((t) => (t.id === id ? { ...t, ...local } : t)));
      return enqueue(id, () => updateTask(id, changes)).then(() => true);
    });
  }, [write, commit, enqueue, user?.id]);

  const create = useCallback((fields) => write(async () => {
    const row = await createTask(fields);
    commit((ts) => (ts.some((t) => t.id === row.id) ? ts : [...ts, row]));
    return row;
  }), [write, commit]);

  const remove = useCallback((task) => write(async () => {
    commit((ts) => ts.filter((t) => t.id !== task.id));
    await enqueue(task.id, () => deleteTask(task));
    return true;
  }), [write, commit, enqueue]);

  // Clôture : la tâche quitte le tableau et ses photos sont supprimées
  const close = useCallback((task) => write(async () => {
    commit((ts) => ts.filter((t) => t.id !== task.id));
    await enqueue(task.id, async () => {
      await updateTask(task.id, { status: 'done', closed_at: new Date().toISOString(), photos: [] });
      await removeTaskPhotos(task.photos);
    });
    return true;
  }), [write, commit, enqueue]);

  const addPhoto = useCallback(async (taskId, file) => {
    try {
      const path = await uploadTaskPhoto(taskId, await resizeImage(file, 1280));
      const current = tasksRef.current.find((t) => t.id === taskId);
      if (!current) {
        removeTaskPhotos([path]);
        return false;
      }
      return await patch(taskId, { photos: [...(current.photos || []), path] });
    } catch (e) {
      toast(e.message, 'error');
      return false;
    }
  }, [patch, toast]);

  const removePhoto = useCallback(async (taskId, path) => {
    const current = tasksRef.current.find((t) => t.id === taskId);
    if (!current) return false;
    const ok = await patch(taskId, { photos: (current.photos || []).filter((p) => p !== path) });
    if (ok) removeTaskPhotos([path]);
    return ok;
  }, [patch]);

  const holdReloads = useCallback((on) => {
    hold.current = on;
    if (!on) settle();
  }, [settle]);

  const enableNotifications = useCallback(async () => {
    if (!canNotify()) return 'unsupported';
    const result = await Notification.requestPermission();
    setNotifyPermission(result);
    return result;
  }, []);

  const value = useMemo(() => ({
    tasks, people, status, myUnseen, notifyPermission,
    reload, patch, create, remove, close, addPhoto, removePhoto, holdReloads, enableNotifications,
  }), [tasks, people, status, myUnseen, notifyPermission, reload, patch, create, remove, close, addPhoto, removePhoto, holdReloads, enableNotifications]);

  return <TasksContext.Provider value={value}>{children}</TasksContext.Provider>;
}
