import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { LayoutGrid, Bell, Tags, ScrollText, UsersRound, Settings, LogOut, Zap, Menu, X, Smartphone, Share } from 'lucide-react';
import { useAuth } from './AuthContext';
import { api } from './api';
import { Modal } from './components/ui';

const ROLE_LABELS = { admin: 'Administrateur', gestionnaire: 'Gestionnaire', lecteur: 'Lecteur' };

export default function Layout() {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [alertCount, setAlertCount] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [installEvt, setInstallEvt] = useState(null);
  const [installHelp, setInstallHelp] = useState(false);

  // Déjà installée (lancée depuis l'icône) → on cache le bouton
  const installed =
    window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

  useEffect(() => {
    const onPrompt = (e) => {
      e.preventDefault();
      setInstallEvt(e);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  const install = async () => {
    setMenuOpen(false);
    if (installEvt) {
      installEvt.prompt();
      const { outcome } = await installEvt.userChoice;
      if (outcome === 'accepted') setInstallEvt(null);
    } else {
      // Navigateur sans invite automatique (iPhone…) : on explique
      setInstallHelp(true);
    }
  };

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
      {!installed && (
        <button
          onClick={install}
          className="mt-3 flex items-center gap-3 rounded-xl border border-dashed border-white/25 px-3.5 py-2.5 text-sm font-semibold text-brand-100/80 transition hover:bg-white/10 hover:text-white"
        >
          <Smartphone size={18} />
          <span className="flex-1 text-left">Installer l'appli</span>
        </button>
      )}
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

      <Modal open={installHelp} onClose={() => setInstallHelp(false)} title="Installer l'application">
        <div className="flex flex-col gap-4 text-sm text-slate-600">
          <p>
            L'application s'installe directement depuis le navigateur, sans passer par un magasin
            d'applications :
          </p>
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="mb-1 font-bold text-slate-800">📱 Sur iPhone / iPad (Safari)</p>
            <p>
              Touchez le bouton <strong>Partager</strong> <Share size={14} className="inline -mt-0.5" /> en bas de
              l'écran, puis <strong>« Sur l'écran d'accueil »</strong> et validez.
            </p>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="mb-1 font-bold text-slate-800">🤖 Sur Android (Chrome)</p>
            <p>
              Ouvrez le menu <strong>⋮</strong> en haut à droite, puis{' '}
              <strong>« Ajouter à l'écran d'accueil »</strong> (ou « Installer l'application »).
            </p>
          </div>
          <p className="text-xs text-slate-400">
            L'icône ⚡ apparaît alors sur votre écran d'accueil et l'appli s'ouvre en plein écran, comme
            une application classique.
          </p>
        </div>
      </Modal>
    </div>
  );
}
