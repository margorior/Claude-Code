import { useCallback, useEffect, useState } from 'react';
import { Search, ScrollText, ArrowDownCircle, ArrowUpCircle, PlusCircle, Pencil, Trash2, DatabaseBackup, X } from 'lucide-react';
import { api, photoUrl } from '../api';
import { useAuth } from '../AuthContext';
import { Spinner, EmptyState, Pagination, useToast } from '../components/ui';
import ProductModal from '../components/ProductModal';

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

const EMPTY_FILTERS = { user: '', action: '', category: '', stock: '' };

export default function History() {
  const { settings, isManager } = useAuth();
  const toast = useToast();
  const [zones, setZones] = useState([]);
  const [editing, setEditing] = useState(null);
  const [opening, setOpening] = useState(null);
  const [items, setItems] = useState(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [users, setUsers] = useState([]);
  const [categories, setCategories] = useState([]);
  const limit = 50;

  const loadRefs = useCallback(async () => {
    try {
      const [u, c, z] = await Promise.all([api('/api/movements/users'), api('/api/categories'), api('/api/zones')]);
      setUsers(u.users);
      setCategories(c.items);
      setZones(z.items);
    } catch {}
  }, []);

  useEffect(() => { loadRefs(); }, [loadRefs]);

  // Un clic sur une ligne ouvre la fiche du produit concerné
  const openProduct = async (m) => {
    if (opening) return;
    setOpening(m.id);
    try {
      setEditing(await api(`/api/products/${m.product_id}`));
    } catch (err) {
      toast(err.status === 404 ? "Ce produit a été supprimé : il n'y a plus de fiche à ouvrir." : err.message, 'error');
    }
    setOpening(null);
  };

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (search) params.set('search', search);
      for (const [k, v] of Object.entries(filters)) if (v) params.set(k, v);
      const d = await api(`/api/movements?${params}`);
      setItems(d.items);
      setTotal(d.total);
    } catch {}
  }, [page, search, filters]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [search, filters]);

  const hasFilters = search || Object.values(filters).some(Boolean);
  const set = (k) => (e) => setFilters({ ...filters, [k]: e.target.value });

  return (
    <div>
      <h1 className="mb-1 text-xl font-extrabold tracking-tight text-slate-900 sm:text-2xl">Historique des mouvements</h1>
      <p className="mb-5 text-sm text-slate-500">Qui a pris ou remis quoi, et quand.</p>

      <div className="card mb-4 p-3">
        <div className="relative">
          <Search size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="input !pl-10"
            placeholder="Rechercher un produit…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="mt-2.5 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
          <select className="input" value={filters.user} onChange={set('user')}>
            <option value="">Toutes les personnes</option>
            {users.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
          <select className="input" value={filters.action} onChange={set('action')}>
            <option value="">Toutes les actions</option>
            {Object.entries(ACTIONS).map(([k, a]) => <option key={k} value={k}>{a.label}</option>)}
          </select>
          <select className="input" value={filters.category} onChange={set('category')}>
            <option value="">Toutes les catégories</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select className="input" value={filters.stock} onChange={set('stock')}>
            <option value="">Tous les stocks</option>
            <option value="1">{settings.stock1_name}</option>
            <option value="2">{settings.stock2_name}</option>
            <option value="3">{settings.stock3_name}</option>
          </select>
        </div>
        {hasFilters && (
          <button
            className="mt-2.5 inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[13px] font-semibold text-slate-500 transition hover:bg-slate-100"
            onClick={() => { setSearch(''); setFilters(EMPTY_FILTERS); }}
          >
            <X size={14} /> Effacer les filtres
          </button>
        )}
      </div>

      {items === null ? (
        <div className="flex justify-center py-20 text-brand-600"><Spinner className="h-8 w-8" /></div>
      ) : items.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={ScrollText}
            title={hasFilters ? 'Aucun mouvement trouvé' : 'Aucun mouvement'}
            subtitle={hasFilters ? 'Essayez de modifier vos filtres.' : 'Les entrées et sorties de stock apparaîtront ici.'}
          />
        </div>
      ) : (
        <div className="card divide-y divide-slate-100">
          {items.map((m) => {
            const a = ACTIONS[m.action] || ACTIONS['modification'];
            const Icon = a.icon;
            const clickable = isManager && m.product_id != null && m.action !== 'suppression';
            const Row = clickable ? 'button' : 'div';
            return (
              <Row
                key={m.id}
                {...(clickable ? { type: 'button', onClick: () => openProduct(m), title: 'Ouvrir la fiche du produit' } : {})}
                className={`flex w-full items-center gap-3.5 px-4 py-3 text-left ${clickable ? 'transition hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none' : ''}`}
              >
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${a.cls}`}>
                  {opening === m.id ? <Spinner className="h-5 w-5" /> : <Icon size={19} />}
                </div>
                {m.photo && <img src={photoUrl(m.photo)} alt="" loading="lazy" className="h-10 w-10 shrink-0 rounded-xl object-cover" />}
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
                    {m.category_name && <span className="text-slate-400"> · {m.category_name}</span>}
                    {m.details && <span className="text-slate-400"> · {m.details}</span>}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-[13px] font-semibold text-slate-600">{m.user_name}</p>
                  <p className="text-xs text-slate-400">{fmtDate(m.created_at)}</p>
                </div>
              </Row>
            );
          })}
        </div>
      )}

      <Pagination page={page} total={total} limit={limit} onPage={setPage} />

      <ProductModal
        open={!!editing}
        onClose={() => setEditing(null)}
        product={editing}
        categories={categories}
        zones={zones}
        onSaved={() => { load(); loadRefs(); window.dispatchEvent(new Event('stock-changed')); }}
        onRefsChanged={loadRefs}
      />
    </div>
  );
}
