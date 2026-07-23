import { useCallback, useEffect, useState } from 'react';
import { UsersRound, Check, Trash2, ShieldCheck, Wrench, Eye, Clock } from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../AuthContext';
import { ConfirmDialog, useToast, Spinner, EmptyState } from '../components/ui';

const ROLES = [
  { value: 'admin', label: 'Administrateur', icon: ShieldCheck, desc: 'Tous les droits' },
  { value: 'gestionnaire', label: 'Gestionnaire', icon: Wrench, desc: 'Gère le stock' },
  { value: 'lecteur', label: 'Lecteur', icon: Eye, desc: 'Lecture seule' },
];

export default function Users() {
  const { user: me } = useAuth();
  const toast = useToast();
  const [users, setUsers] = useState(null);
  const [toDelete, setToDelete] = useState(null);

  const load = useCallback(async () => {
    try {
      const d = await api('/api/users');
      setUsers(d.users);
    } catch {}
  }, []);

  useEffect(() => { load(); }, [load]);

  const update = async (id, patch, msg) => {
    try {
      await api(`/api/users/${id}`, { method: 'PUT', json: patch });
      toast(msg);
      load();
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const doDelete = async () => {
    try {
      await api(`/api/users/${toDelete.id}`, { method: 'DELETE' });
      toast('Utilisateur supprimé');
      setToDelete(null);
      load();
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  if (users === null) {
    return <div className="flex justify-center py-20 text-brand-600"><Spinner className="h-8 w-8" /></div>;
  }

  const pending = users.filter((u) => u.status === 'pending');
  const active = users.filter((u) => u.status === 'active');

  const roleSelect = (u) => (
    <select
      className="input !w-auto !py-1.5 text-[13px] font-semibold"
      value={u.role}
      disabled={u.id === me.id}
      onChange={(e) => update(u.id, { role: e.target.value }, 'Rôle mis à jour')}
    >
      {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
    </select>
  );

  return (
    <div>
      <h1 className="mb-1 text-xl font-extrabold tracking-tight text-slate-900 sm:text-2xl">Utilisateurs</h1>
      <p className="mb-5 text-sm text-slate-500">Validez les nouvelles inscriptions et gérez les rôles d'accès.</p>

      {pending.length > 0 && (
        <div className="card mb-4 overflow-hidden border-amber-200">
          <div className="flex items-center gap-2 border-b border-amber-100 bg-amber-50 px-5 py-3.5">
            <Clock size={17} className="text-amber-600" />
            <h2 className="font-bold text-amber-900">En attente de validation ({pending.length})</h2>
          </div>
          <ul className="divide-y divide-slate-100">
            {pending.map((u) => (
              <li key={u.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-800">{u.display_name}</p>
                  <p className="text-[13px] text-slate-400">@{u.username}</p>
                </div>
                {roleSelect(u)}
                <button className="btn-primary !bg-emerald-600 !px-3 !py-2 hover:!bg-emerald-700" onClick={() => update(u.id, { status: 'active' }, `${u.display_name} accepté(e)`)}>
                  <Check size={16} /> Accepter
                </button>
                <button className="btn-ghost !px-3 !py-2 !text-red-600" onClick={() => setToDelete(u)}>
                  <Trash2 size={16} />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-3.5">
          <UsersRound size={17} className="text-brand-600" />
          <h2 className="font-bold text-slate-900">Comptes actifs ({active.length})</h2>
        </div>
        {active.length === 0 ? (
          <EmptyState icon={UsersRound} title="Aucun compte actif" />
        ) : (
          <ul className="divide-y divide-slate-100">
            {active.map((u) => {
              const role = ROLES.find((r) => r.value === u.role);
              const Icon = role.icon;
              return (
                <li key={u.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                    u.role === 'admin' ? 'bg-brand-100 text-brand-700' : u.role === 'gestionnaire' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                  }`}>
                    <Icon size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-slate-800">
                      {u.display_name} {u.id === me.id && <span className="text-xs font-bold text-brand-600">(vous)</span>}
                    </p>
                    <p className="text-[13px] text-slate-400">@{u.username} · {role.desc}</p>
                  </div>
                  {roleSelect(u)}
                  {u.id !== me.id && (
                    <button className="rounded-lg p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600" onClick={() => setToDelete(u)}>
                      <Trash2 size={16} />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={doDelete}
        title={`Supprimer le compte de ${toDelete?.display_name} ?`}
        message="Cette personne ne pourra plus se connecter. Cette action est définitive."
      />
    </div>
  );
}
