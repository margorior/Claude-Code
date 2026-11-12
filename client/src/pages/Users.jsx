import { useCallback, useEffect, useState } from 'react';
import { UsersRound, Check, Trash2, ShieldCheck, Wrench, Eye, Clock, Ban, RotateCcw, ListTodo, KeyRound } from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../AuthContext';
import { ConfirmDialog, useToast, Spinner, EmptyState, Modal, Field } from '../components/ui';

const ROLES = [
  { value: 'admin', label: 'Administrateur', icon: ShieldCheck, desc: 'Tous les droits : stock, tâches, comptes' },
  { value: 'gestionnaire', label: 'Gestionnaire', icon: Wrench, desc: 'Gère le stock, voit ses tâches' },
  { value: 'lecteur', label: 'Lecteur', icon: Eye, desc: 'Stock en lecture seule, voit ses tâches' },
  { value: 'utilisateur', label: 'Utilisateur', icon: ListTodo, desc: 'Ne voit que ses tâches' },
];

export default function Users() {
  const { user: me } = useAuth();
  const toast = useToast();
  const [users, setUsers] = useState(null);
  const [toDelete, setToDelete] = useState(null);
  const [pwdUser, setPwdUser] = useState(null);
  const [pwd, setPwd] = useState('');
  const [pwdBusy, setPwdBusy] = useState(false);

  const savePassword = async (e) => {
    e.preventDefault();
    setPwdBusy(true);
    try {
      await api(`/api/users/${pwdUser.id}/password`, { method: 'PUT', json: { password: pwd } });
      toast(`Nouveau mot de passe enregistré pour ${pwdUser.display_name}`);
      setPwdUser(null);
    } catch (err) {
      toast(err.message, 'error');
    }
    setPwdBusy(false);
  };

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
      toast('Accès supprimé');
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
  const others = users.filter((u) => u.status !== 'pending');

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
      <p className="mb-5 text-sm text-slate-500">Validez les nouvelles inscriptions et choisissez le niveau d'accès de chacun. Seul un administrateur peut changer un niveau.</p>

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
                <button className="btn-primary !bg-emerald-600 !text-white !px-3 !py-2 hover:!bg-emerald-700" onClick={() => update(u.id, { status: 'active' }, `${u.display_name} accepté(e)`)}>
                  <Check size={16} /> Accepter
                </button>
                <button className="btn-ghost !px-3 !py-2 !text-red-600" title="Refuser" onClick={() => setToDelete(u)}>
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
          <h2 className="font-bold text-slate-900">Comptes ({others.length})</h2>
        </div>
        {others.length === 0 ? (
          <EmptyState icon={UsersRound} title="Aucun compte" />
        ) : (
          <ul className="divide-y divide-slate-100">
            {others.map((u) => {
              const role = ROLES.find((r) => r.value === u.role) || ROLES[2];
              const Icon = role.icon;
              const disabled = u.status === 'disabled';
              return (
                <li key={u.id} className={`flex flex-wrap items-center gap-3 px-5 py-3.5 ${disabled ? 'opacity-60' : ''}`}>
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                    disabled ? 'bg-slate-100 text-slate-400' : u.role === 'admin' ? 'bg-brand-100 text-brand-700' : u.role === 'gestionnaire' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                  }`}>
                    <Icon size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-slate-800">
                      {u.display_name} {u.id === me.id && <span className="text-xs font-bold text-brand-600">(vous)</span>}
                      {disabled && <span className="ml-1 rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-bold text-slate-500">désactivé</span>}
                    </p>
                    <p className="text-[13px] text-slate-400">@{u.username} · {role.desc}</p>
                  </div>
                  {roleSelect(u)}
                  {u.id !== me.id && (
                    <button className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700" title="Changer le mot de passe" aria-label={`Changer le mot de passe de ${u.display_name}`} onClick={() => { setPwd(''); setPwdUser(u); }}>
                      <KeyRound size={16} />
                    </button>
                  )}
                  {u.id !== me.id && (
                    disabled ? (
                      <button className="btn-ghost !px-3 !py-2" title="Réactiver" onClick={() => update(u.id, { status: 'active' }, `${u.display_name} réactivé(e)`)}>
                        <RotateCcw size={16} /> Réactiver
                      </button>
                    ) : (
                      <button className="rounded-lg p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600" title="Désactiver l'accès" onClick={() => update(u.id, { status: 'disabled' }, `${u.display_name} désactivé(e)`)}>
                        <Ban size={16} />
                      </button>
                    )
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <Modal open={!!pwdUser} onClose={() => setPwdUser(null)} title={`Mot de passe de ${pwdUser?.display_name || ''}`}>
        <form onSubmit={savePassword} className="flex flex-col gap-4">
          <Field label="Nouveau mot de passe" hint="6 caractères minimum. Il s'affiche en clair pour que vous puissiez le transmettre ; la personne pourra le changer dans Paramètres.">
            <input className="input" required minLength={6} autoFocus autoComplete="off" value={pwd} onChange={(e) => setPwd(e.target.value)} />
          </Field>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={() => setPwdUser(null)}>Annuler</button>
            <button className="btn-primary" disabled={pwdBusy || pwd.length < 6}>
              {pwdBusy ? <Spinner className="h-4 w-4" /> : 'Enregistrer'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={doDelete}
        title={`Refuser l'accès de ${toDelete?.display_name} ?`}
        message="Cette personne ne pourra pas utiliser l'application."
        confirmLabel="Refuser"
      />
    </div>
  );
}
