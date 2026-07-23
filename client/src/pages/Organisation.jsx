import { useCallback, useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Tags, MapPin } from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../AuthContext';
import { Modal, Field, ConfirmDialog, useToast, EmptyState, Spinner } from '../components/ui';

function CrudSection({ endpoint, title, icon: Icon, singular, hint }) {
  const { isManager } = useAuth();
  const toast = useToast();
  const [items, setItems] = useState(null);
  const [modal, setModal] = useState({ open: false, item: null });
  const [name, setName] = useState('');
  const [toDelete, setToDelete] = useState(null);

  const load = useCallback(async () => {
    try {
      const d = await api(`/api/${endpoint}`);
      setItems(d.items);
    } catch {}
  }, [endpoint]);

  useEffect(() => { load(); }, [load]);

  const save = async (e) => {
    e.preventDefault();
    try {
      if (modal.item) {
        await api(`/api/${endpoint}/${modal.item.id}`, { method: 'PUT', json: { name } });
        toast(`${singular} renommée`);
      } else {
        await api(`/api/${endpoint}`, { json: { name } });
        toast(`${singular} ajoutée`);
      }
      setModal({ open: false, item: null });
      load();
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const doDelete = async () => {
    try {
      await api(`/api/${endpoint}/${toDelete.id}`, { method: 'DELETE' });
      toast(`${singular} supprimée`);
      setToDelete(null);
      load();
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
        <div className="flex items-center gap-2.5">
          <div className="rounded-xl bg-brand-50 p-2 text-brand-600"><Icon size={18} /></div>
          <div>
            <h2 className="font-bold text-slate-900">{title}</h2>
            <p className="text-xs text-slate-400">{hint}</p>
          </div>
        </div>
        {isManager && (
          <button className="btn-primary !px-3 !py-2" onClick={() => { setModal({ open: true, item: null }); setName(''); }}>
            <Plus size={17} />
          </button>
        )}
      </div>

      {items === null ? (
        <div className="flex justify-center py-10 text-brand-600"><Spinner /></div>
      ) : items.length === 0 ? (
        <EmptyState icon={Icon} title={`Aucune ${singular.toLowerCase()}`} />
      ) : (
        <ul className="divide-y divide-slate-100">
          {items.map((it) => (
            <li key={it.id} className="flex items-center gap-3 px-5 py-3">
              <span className="flex-1 font-medium text-slate-700">{it.name}</span>
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-500">
                {it.product_count} produit{it.product_count > 1 ? 's' : ''}
              </span>
              {isManager && (
                <>
                  <button
                    className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                    onClick={() => { setModal({ open: true, item: it }); setName(it.name); }}
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    className="rounded-lg p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                    onClick={() => setToDelete(it)}
                  >
                    <Trash2 size={15} />
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={modal.open}
        onClose={() => setModal({ open: false, item: null })}
        title={modal.item ? `Renommer la ${singular.toLowerCase()}` : `Nouvelle ${singular.toLowerCase()}`}
      >
        <form onSubmit={save} className="flex flex-col gap-4">
          <Field label="Nom">
            <input className="input" required autoFocus value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={() => setModal({ open: false, item: null })}>Annuler</button>
            <button className="btn-primary">{modal.item ? 'Enregistrer' : 'Ajouter'}</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={doDelete}
        title={`Supprimer « ${toDelete?.name} » ?`}
        message={
          toDelete?.product_count > 0
            ? `${toDelete.product_count} produit(s) utilisent cette ${singular.toLowerCase()} — ils ne seront pas supprimés, mais n'auront plus de ${singular.toLowerCase()}.`
            : 'Cette action est définitive.'
        }
      />
    </div>
  );
}

export default function Organisation() {
  return (
    <div>
      <h1 className="mb-1 text-xl font-extrabold tracking-tight text-slate-900 sm:text-2xl">Catégories & zones</h1>
      <p className="mb-5 text-sm text-slate-500">Organisez votre matériel par catégorie et par emplacement de rangement.</p>
      <div className="grid gap-4 lg:grid-cols-2">
        <CrudSection endpoint="categories" title="Catégories" singular="Catégorie" icon={Tags} hint="ex. câbles, prises, interrupteurs…" />
        <CrudSection endpoint="zones" title="Zones de rangement" singular="Zone" icon={MapPin} hint="ex. étagère A, réserve…" />
      </div>
    </div>
  );
}
