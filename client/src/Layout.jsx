import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { LayoutGrid, Bell, Tags, ScrollText, UsersRound, Settings, LogOut, Zap, Menu, X } from 'lucide-react';
import { useAuth } from './AuthContext';
import { api } from './api';

const ROLE_LABELS = { admin: 'Administrateur', gestionnaire: 'Gestionnaire', lecteur: 'Lecteur' };

export default function Layout() {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [alertCount, setAlertCount] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const d = await api('/api/products?limit=1');
        if (alive) setAlertCount(d.alertCount);
      } catch {}
    };
    load();
    const onRefresh = () => load();
    window.addEventListener('stock-changed', onRefresh);
    return () => {
      alive = false;
      window.removeEventListener('stock-changed', onRefresh);
    };
  }, []);

  const links = [
    { to: '/', label: 'Inventaire', icon: LayoutGrid, end: true },
    { to: '/alertes', label: 'Alertes', icon: Bell, badge: alertCount },
    { to: '/organisation', label: 'Catégories & zones', icon: Tags },
    { to: '/historique', label: 'Historique', icon: ScrollText },
    ...(isAdmin ? [{ to: '/utilisateurs', label: 'Utilisateurs', icon: UsersRound }] : []),
    { to: '/parametres', label: 'Paramètres', icon: Settings },
  ];

  const nav = (mobile = false) => (
    <nav className={`flex flex-col gap-1 ${mobile ? '' : 'mt-6'}`}>
      {links.map(({ to, label, icon: Icon, badge, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={() => setMenuOpen(false)}
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition ${
              isActive ? 'bg-white/15 text-white' : 'text-brand-100/70 hover:bg-white/10 hover:text-white'
            }`
          }
        >
          <Icon size={18} />
          <span className="flex-1">{label}</span>
          {badge > 0 && (
            <span className="rounded-full bg-amber-400 px-2 py-0.5 text-xs font-bold text-amber-950">{badge}</span>
          )}
        </NavLink>
      ))}
    </nav>
  );

  const userBlock = (
    <div className="mt-auto border-t border-white/10 pt-4">
      <div className="flex items-center gap-3 px-2">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-500 text-sm font-bold text-white">
          {user.displayName.slice(0, 1).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-white">{user.displayName}</p>
          <p className="text-xs text-brand-200/70">{ROLE_LABELS[user.role]}</p>
        </div>
        <button
          title="Se déconnecter"
          onClick={async () => { await logout(); navigate('/login'); }}
          className="rounded-lg p-2 text-brand-200/70 transition hover:bg-white/10 hover:text-white"
        >
          <LogOut size={17} />
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen lg:pl-64">
      {/* Sidebar desktop */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col bg-brand-950 px-4 py-5 lg:flex">
        <div className="flex items-center gap-2.5 px-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-800">
            <Zap size={18} className="text-amber-300" fill="currentColor" />
          </div>
          <span className="text-lg font-extrabold tracking-tight text-white">Gestion Stock</span>
        </div>
        {nav()}
        {userBlock}
      </aside>

      {/* Topbar mobile */}
      <header className="sticky top-0 z-40 flex items-center justify-between bg-brand-950 px-4 py-3 lg:hidden">
        <div className="flex items-center gap-2">
          <Zap size={20} className="text-amber-300" fill="currentColor" />
          <span className="font-extrabold text-white">Gestion Stock</span>
        </div>
        <button onClick={() => setMenuOpen(!menuOpen)} className="rounded-lg p-2 text-white">
          {menuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </header>
      {menuOpen && (
        <div className="fixed inset-0 z-30 bg-slate-950/50 lg:hidden" onClick={() => setMenuOpen(false)}>
          <div className="flex h-full w-72 flex-col bg-brand-950 px-4 pb-5 pt-16" onClick={(e) => e.stopPropagation()}>
            {nav(true)}
            {userBlock}
          </div>
        </div>
      )}

      <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
        <Outlet />
      </main>
    </div>
  );
}
