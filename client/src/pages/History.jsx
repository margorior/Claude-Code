import { useCallback, useEffect, useState } from 'react';
import { Search, ScrollText, ArrowDownCircle, ArrowUpCircle, PlusCircle, Pencil, Trash2, DatabaseBackup } from 'lucide-react';
import { api } from '../api';
import { Spinner, EmptyState, Pagination } from '../components/ui';

const ACTIONS = {
  'entrée': { label: 'Entrée', icon: ArrowUpCircle, cls: 'bg-emerald-100 text-emerald-700' },
  'sortie': { label: 'Sortie', icon: ArrowDownCircle, cls: 'bg-red-100 text-red-700' },
  'création': { label: 'Création', icon: PlusCircle, cls: 'bg-brand-100 text-brand-700' },
  'modification': { label: 'Modification', icon: Pencil, cls: 'bg-slate-200 text-slate-700' },
  'suppression': { label: 'Suppression', icon: Trash2, cls: 'bg-orange-100 text-orange-700' },
  'import': { label: 'Import', icon: DatabaseBackup, cls: 'bg-purple-100 text-purple-700' },
};

function fmtDate(iso) {
  const d = new Date(iso.includes('T') ? iso : iso.replace(' ', 'T') + 'Z');
  return d.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export default function History() {
  const [items, setItems] = useState(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const limit = 50;

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (search) params.set('search', search);
      const d = await api(`/api/movements?${params}`);
      setItems(d.items);
      setTotal(d.total);
    } catch {}
  }, [page, search]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [search]);

  return (
    <div>
      <h1 className="mb-1 text-xl font-extrabold tracking-tight text-slate-900 sm:text-2xl">Historique des mouvements</h1>
      <p className="mb-5 text-sm text-slate-500">Qui a pris ou remis quoi, et quand.</p>

      <div className="relative mb-4">
        <Search size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          className="input !pl-10"
          placeholder="Filtrer par produit ou par personne…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {items === null ? (
        <div className="flex justify-center py-20 text-brand-600"><Spinner className="h-8 w-8" /></div>
      ) : items.length === 0 ? (
        <div className="card"><EmptyState icon={ScrollText} title="Aucun mouvement" subtitle="Les entrées et sorties de stock apparaîtront ici." /></div>
      ) : (
        <div className="card divide-y divide-slate-100">
          {items.map((m) => {
            const a = ACTIONS[m.action] || ACTIONS['modification'];
            const Icon = a.icon;
            return (
              <div key={m.id} className="flex items-center gap-3.5 px-4 py-3">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${a.cls}`}>
                  <Icon size={19} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-slate-800">{m.product_name}</p>
                  <p className="text-[13px] text-slate-500">
                    {a.label}
                    {m.delta != null && m.delta !== 0 && (
                      <span className={`font-bold ${m.delta > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {' '}{m.delta > 0 ? '+' : ''}{m.delta}
                      </span>
                    )}
                    {m.quantity_after != null && <span className="text-slate-400"> → reste {m.quantity_after}</span>}
                    {m.details && <span className="text-slate-400"> · {m.details}</span>}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-[13px] font-semibold text-slate-600">{m.user_name}</p>
                  <p className="text-xs text-slate-400">{fmtDate(m.created_at)}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Pagination page={page} total={total} limit={limit} onPage={setPage} />
    </div>
  );
}
