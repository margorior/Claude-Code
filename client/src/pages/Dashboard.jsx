import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Plus, Minus, Search, Pencil, PackageOpen, Bell, ScanBarcode, X,
  ArrowUpDown, FileSpreadsheet, ImageOff,
} from 'lucide-react';
import { api, exportCsv, photoUrl } from '../api';
import { useAuth } from '../AuthContext';
import { Spinner, EmptyState, Pagination, useToast } from '../components/ui';
import ProductModal from '../components/ProductModal';
import AdjustModal from '../components/AdjustModal';
import ScannerModal from '../components/ScannerModal';

function useDebounced(value, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export default function Dashboard({ alertsOnly = false }) {
  const { isManager, settings } = useAuth();
  const toast = useToast();
  const [exporting, setExporting] = useState(false);
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [alertCount, setAlertCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const limit = 50;

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounced(search);
  const [filters, setFilters] = useState({ category: '', zone: '', stock: '' });
  const [sort, setSort] = useState({ by: 'name', dir: 'asc' });

  const [categories, setCategories] = useState([]);
  const [zones, setZones] = useState([]);

  const [productModal, setProductModal] = useState({ open: false, product: null });
  const [adjust, setAdjust] = useState({ open: false, product: null, direction: 'out' });
  const [scanOpen, setScanOpen] = useState(false);

  const loadRefs = useCallback(async () => {
    try {
      const [c, z] = await Promise.all([api('/api/categories'), api('/api/zones')]);
      setCategories(c.items);
      setZones(z.items);
    } catch {}
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page), limit: String(limit),
        sort: sort.by, dir: sort.dir,
      });
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (filters.category) params.set('category', filters.category);
      if (filters.zone) params.set('zone', filters.zone);
      if (filters.stock) params.set('stock', filters.stock);
      if (alertsOnly) params.set('alertsOnly', '1');
      const d = await api(`/api/products?${params}`);
      setItems(d.items);
      setTotal(d.total);
      setAlertCount(d.alertCount);
    } catch {}
    setLoading(false);
  }, [page, debouncedSearch, filters, sort, alertsOnly]);

  useEffect(() => { loadRefs(); }, [loadRefs]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [debouncedSearch, filters, alertsOnly]);

  const refresh = () => {
    load();
    window.dispatchEvent(new Event('stock-changed'));
  };

  const toggleSort = (by) =>
    setSort((s) => ({ by, dir: s.by === by && s.dir === 'asc' ? 'desc' : 'asc' }));

  const stockName = (n) => (n === 2 ? settings.stock2_name : settings.stock1_name);
  const hasFilters = filters.category || filters.zone || filters.stock || search;

  const fmtQty = (q) => (Number.isInteger(q) ? q : String(q).replace('.', ','));

  const rows = useMemo(() => items.map((p) => {
    const inAlert = p.alert_threshold > 0 && p.quantity <= p.alert_threshold;
    return (
      <div key={p.id} className="card flex flex-col gap-3 p-3.5 sm:flex-row sm:items-center">
        <div className="flex flex-1 items-center gap-3.5">
          {p.photo ? (
            <img src={photoUrl(p.photo)} alt="" loading="lazy" className="h-14 w-14 shrink-0 rounded-xl object-cover" />
          ) : (
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-300">
              <ImageOff size={20} />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <p className="font-bold text-slate-900">{p.name}</p>
              {inAlert && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800">
                  <Bell size={11} /> Stock bas
                </span>
              )}
            </div>
            <p className="mt-0.5 flex flex-wrap gap-x-2 text-[13px] text-slate-500">
              <span className="font-medium text-brand-700">{stockName(p.stock)}</span>
              {p.category_name && <span>· {p.category_name}</span>}
              {(p.zone_name || p.sub_zone) && <span>· {[p.zone_name, p.sub_zone].filter(Boolean).join(' · ')}</span>}
            </p>
          </div>
          <div className="text-right">
            <p className={`text-lg font-extrabold ${inAlert ? 'text-amber-600' : 'text-slate-900'}`}>
              {fmtQty(p.quantity)}
            </p>
            <p className="text-xs text-slate-400">{p.unit}{p.quantity > 1 && p.unit === 'pièce' ? 's' : ''}</p>
          </div>
        </div>

        {isManager && (
          <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3 sm:border-0 sm:pt-0">
            <button
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-red-600 transition hover:bg-red-100 active:scale-95"
              title="Prendre"
              onClick={() => setAdjust({ open: true, product: p, direction: 'out' })}
            >
              <Minus size={19} strokeWidth={2.5} />
            </button>
            <button
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 transition hover:bg-emerald-100 active:scale-95"
              title="Remettre"
              onClick={() => setAdjust({ open: true, product: p, direction: 'in' })}
            >
              <Plus size={19} strokeWidth={2.5} />
            </button>
            <button
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600 transition hover:bg-slate-200 active:scale-95"
              title="Modifier"
              onClick={() => setProductModal({ open: true, product: p })}
            >
              <Pencil size={17} />
            </button>
          </div>
        )}
      </div>
    );
  }), [items, isManager, settings]);

  return (
    <div>
      {/* Header */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-slate-900 sm:text-2xl">
            {alertsOnly ? 'Alertes de stock' : 'Inventaire'}
          </h1>
          <p className="mt-0.5 text-sm text-slate-500">
            {alertsOnly
              ? `${alertCount} produit${alertCount > 1 ? 's' : ''} sous le seuil d'alerte`
              : `${total} référence${total > 1 ? 's' : ''}`}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            className="btn-ghost"
            title="Télécharger l'inventaire (Excel/CSV)"
            disabled={exporting}
            onClick={async () => {
              setExporting(true);
              try { await exportCsv(settings); } catch (e) { toast(e.message, 'error'); }
              setExporting(false);
            }}
          >
            {exporting ? <Spinner className="h-4 w-4" /> : <FileSpreadsheet size={17} />}
            <span className="hidden sm:inline">Export Excel</span>
          </button>
          {isManager && !alertsOnly && (
            <button className="btn-primary" onClick={() => setProductModal({ open: true, product: null })}>
              <Plus size={18} strokeWidth={2.5} /> Ajouter
            </button>
          )}
        </div>
      </div>

      {/* Search + filters */}
      <div className="card mb-4 p-3">
        <div className="flex flex-col gap-2.5 lg:flex-row">
          <div className="relative flex-1">
            <Search size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className="input !pl-10 !pr-20"
              placeholder="Rechercher un produit ou un code-barres…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="absolute right-2 top-1/2 flex -translate-y-1/2 gap-1">
              {search && (
                <button className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100" onClick={() => setSearch('')}>
                  <X size={16} />
                </button>
              )}
              <button className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100" title="Scanner un code-barres" onClick={() => setScanOpen(true)}>
                <ScanBarcode size={18} />
              </button>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2.5">
            <select className="input" value={filters.stock} onChange={(e) => setFilters({ ...filters, stock: e.target.value })}>
              <option value="">Tous les stocks</option>
              <option value="1">{settings.stock1_name}</option>
              <option value="2">{settings.stock2_name}</option>
            </select>
            <select className="input" value={filters.category} onChange={(e) => setFilters({ ...filters, category: e.target.value })}>
              <option value="">Catégories</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select className="input" value={filters.zone} onChange={(e) => setFilters({ ...filters, zone: e.target.value })}>
              <option value="">Zones</option>
              {zones.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
            </select>
          </div>
        </div>
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-[13px]">
          <span className="mr-1 flex items-center gap-1 font-semibold text-slate-400"><ArrowUpDown size={13} /> Trier :</span>
          {[['name', 'Nom'], ['quantity', 'Quantité'], ['category', 'Catégorie'], ['zone', 'Zone'], ['updated', 'Modifié']].map(([by, label]) => (
            <button
              key={by}
              onClick={() => toggleSort(by)}
              className={`rounded-lg px-2.5 py-1 font-semibold transition ${
                sort.by === by ? 'bg-brand-100 text-brand-700' : 'text-slate-500 hover:bg-slate-100'
              }`}
            >
              {label} {sort.by === by ? (sort.dir === 'asc' ? '↑' : '↓') : ''}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      {loading && items.length === 0 ? (
        <div className="flex justify-center py-20 text-brand-600"><Spinner className="h-8 w-8" /></div>
      ) : items.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={alertsOnly ? Bell : PackageOpen}
            title={alertsOnly ? 'Aucune alerte 🎉' : hasFilters ? 'Aucun résultat' : 'Le stock est vide'}
            subtitle={
              alertsOnly
                ? 'Tous les produits sont au-dessus de leur seuil.'
                : hasFilters
                ? 'Essayez de modifier votre recherche ou vos filtres.'
                : isManager
                ? 'Ajoutez votre première référence avec le bouton « Ajouter ».'
                : 'Aucun produit enregistré pour le moment.'
            }
          />
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">{rows}</div>
      )}

      <Pagination page={page} total={total} limit={limit} onPage={setPage} />

      {/* Modals */}
      <ProductModal
        open={productModal.open}
        onClose={() => setProductModal({ open: false, product: null })}
        product={productModal.product}
        categories={categories}
        zones={zones}
        onSaved={() => { refresh(); loadRefs(); }}
      />
      <AdjustModal
        open={adjust.open}
        onClose={() => setAdjust({ ...adjust, open: false })}
        product={adjust.product}
        direction={adjust.direction}
        onSaved={refresh}
      />
      <ScannerModal open={scanOpen} onClose={() => setScanOpen(false)} onScan={(code) => { setSearch(code); setScanOpen(false); }} />
    </div>
  );
}
