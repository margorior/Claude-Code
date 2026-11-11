import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutGrid, Bell, Tags, ScrollText, UsersRound, Settings, LogOut, Zap, Menu, X, Smartphone, Share,
  Package, ClipboardList, KanbanSquare, ListTodo, CalendarDays,
} from 'lucide-react';
import { useAuth } from './AuthContext';
import { api } from './api';
import { Modal } from './components/ui';
import { TasksProvider, useTasks } from './tasks/TasksContext';

const ROLE_LABELS = { admin: 'Administrateur', gestionnaire: 'Gestionnaire', lecteur: 'Lecteur', utilisateur: 'Utilisateur' };
const STOCK_PATHS = ['/', '/alertes', '/organisation', '/historique'];

// Couleurs du menu : bleu pour le stock, noir et jaune pour les tâches
const THEMES = {
  stock: {
    bar: 'bg-brand-950',
    link: 'text-brand-100/70 hover:bg-white/10 hover:text-white',
    active: 'bg-white/15 text-white',
    switchBox: 'bg-white/10',
    switchOn: 'bg-white text-brand-950',
    switchOff: 'text-brand-100/80 hover:text-white',
    muted: 'text-brand-200/70',
    line: 'border-white/10',
    avatar: 'bg-brand-500 text-white',
    badge: 'bg-amber-400 text-amber-950',
    logo: 'bg-gradient-to-br from-brand-500 to-brand-800',
    color: '#161d53',
  },
  tasks: {
    bar: 'bg-ink-950',
    link: 'text-ink-300 hover:bg-ink-800 hover:text-ink-50',
    active: 'bg-sun text-ink-900',
    switchBox: 'bg-ink-800',
    switchOn: 'bg-sun text-ink-900',
    switchOff: 'text-ink-300 hover:text-ink-50',
    muted: 'text-ink-300',
    line: 'border-ink-700',
    avatar: 'bg-sun text-ink-900',
    badge: 'bg-sun text-ink-900 group-aria-[current=page]:bg-ink-950 group-aria-[current=page]:text-sun',
    logo: 'bg-ink-800',
    color: '#0A0A0A',
  },
};

export default function Layout() {
  return (
    <TasksProvider>
      <Shell />
    </TasksProvider>
  );
}

function Shell() {
  const { user, logout, isAdmin, tasksOnly } = useAuth();
  const { myUnseen } = useTasks();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [alertCount, setAlertCount] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [installEvt, setInstallEvt] = useState(null);
  const [installHelp, setInstallHelp] = useState(false);
  const [lastSection, setLastSection] = useState('stock');

  // Partie de l'appli affichée : Stock ou Tâches. Les pages communes
  // (Utilisateurs, Paramètres) gardent le menu de la partie d'où l'on vient.
  const onTasks = pathname.startsWith('/taches');
  const section = tasksOnly || onTasks ? 'tasks' : STOCK_PATHS.includes(pathname) ? 'stock' : lastSection;
  const theme = THEMES[section];
  useEffect(() => { setLastSection(section); }, [section]);
  useEffect(() => { setMenuOpen(false); }, [pathname]);

  useEffect(() => {
    document.body.classList.toggle('tasks-dark', onTasks);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme.color);
    return () => document.body.classList.remove('tasks-dark');
  }, [onTasks, theme.color]);

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
    if (tasksOnly) return;
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
  }, [tasksOnly]);

  const tasksHome = isAdmin ? '/taches' : '/taches/miennes';
  const links = [
    ...(section === 'stock' ? [
      { to: '/', label: 'Inventaire', icon: LayoutGrid, end: true },
      { to: '/alertes', label: 'Alertes', icon: Bell, badge: alertCount },
      { to: '/organisation', label: 'Catégories & zones', icon: Tags },
      { to: '/historique', label: 'Historique', icon: ScrollText },
    ] : [
      ...(isAdmin ? [{ to: '/taches', label: 'Tableau', icon: KanbanSquare, end: true }] : []),
      { to: '/taches/miennes', label: 'Mes tâches', icon: ListTodo, badge: myUnseen.length },
      { to: '/taches/calendrier', label: 'Calendrier', icon: CalendarDays },
    ]),
    ...(isAdmin ? [{ to: '/utilisateurs', label: 'Utilisateurs', icon: UsersRound }] : []),
    { to: '/parametres', label: 'Paramètres', icon: Settings },
  ];

  // Les deux onglets : Stock et Tâches
  const sectionSwitch = (compact = false) => !tasksOnly && (
    <div className={`grid grid-cols-2 gap-1 rounded-xl p-1 ${theme.switchBox} ${compact ? 'w-full max-w-[220px]' : 'mt-5'}`} role="group" aria-label="Partie de l'application">
      {[
        { key: 'stock', to: '/', label: 'Stock', icon: Package },
        { key: 'tasks', to: tasksHome, label: 'Tâches', icon: ClipboardList, badge: myUnseen.length },
      ].map(({ key, to, label, icon: Icon, badge }) => (
        <Link
          key={key}
          to={to}
          aria-current={section === key ? 'true' : undefined}
          className={`relative flex items-center justify-center gap-1.5 rounded-lg text-sm font-bold transition ${compact ? 'min-h-[36px]' : 'min-h-[40px]'} ${
            section === key ? theme.switchOn : theme.switchOff
          }`}
        >
          <Icon size={16} /> {label}
          {badge > 0 && (
            <span className={`flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[11px] font-bold ${section === key ? 'bg-ink-950 text-sun' : 'bg-sun text-ink-900'}`}>{badge}</span>
          )}
        </Link>
      ))}
    </div>
  );

  const nav = (mobile = false) => (
    <nav className={`flex flex-col gap-1 ${mobile ? 'mt-4' : 'mt-5'}`} aria-label="Menu">
      {links.map(({ to, label, icon: Icon, badge, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={() => setMenuOpen(false)}
          className={({ isActive }) =>
            `group flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition ${isActive ? theme.active : theme.link}`
          }
        >
          <Icon size={18} />
          <span className="flex-1">{label}</span>
          {badge > 0 && (
            <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${theme.badge}`}>{badge}</span>
          )}
        </NavLink>
      ))}
      {!installed && (
        <button
          onClick={install}
          className={`mt-3 flex items-center gap-3 rounded-xl border border-dashed px-3.5 py-2.5 text-sm font-semibold transition ${theme.line} ${theme.link}`}
        >
          <Smartphone size={18} />
          <span className="flex-1 text-left">Installer l'appli</span>
        </button>
      )}
    </nav>
  );

  const userBlock = (
    <div className={`mt-auto border-t pt-4 ${theme.line}`}>
      <div className="flex items-center gap-3 px-2">
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${theme.avatar}`}>
          {user.displayName.slice(0, 1).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-white">{user.displayName}</p>
          <p className={`text-xs ${theme.muted}`}>{ROLE_LABELS[user.role]}</p>
        </div>
        <button
          title="Se déconnecter"
          aria-label="Se déconnecter"
          onClick={async () => { await logout(); navigate('/login'); }}
          className={`rounded-lg p-2 transition ${theme.link}`}
        >
          <LogOut size={17} />
        </button>
      </div>
    </div>
  );

  const logo = (
    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${theme.logo}`}>
      <Zap size={18} className={section === 'tasks' ? 'text-sun' : 'text-amber-300'} fill="currentColor" />
    </div>
  );

  return (
    <div className="min-h-screen lg:pl-64">
      {/* Menu latéral (ordinateur) */}
      <aside className={`fixed inset-y-0 left-0 z-40 hidden w-64 flex-col px-4 py-5 lg:flex ${theme.bar} ${section === 'tasks' ? 'border-r border-ink-700' : ''}`}>
        <div className="flex items-center gap-2.5 px-2">
          {logo}
          <span className="text-lg font-extrabold tracking-tight text-white">Gestion Stock</span>
        </div>
        {sectionSwitch()}
        {nav()}
        {userBlock}
      </aside>

      {/* Barre du haut (téléphone) */}
      <header className={`sticky top-0 z-40 flex h-14 items-center justify-between gap-3 px-3 lg:hidden ${theme.bar} ${section === 'tasks' ? 'border-b border-ink-700' : ''}`}>
        <div className="flex min-w-0 items-center gap-2">
          {logo}
          {tasksOnly && <span className="truncate font-extrabold text-white">Mes tâches</span>}
        </div>
        {sectionSwitch(true)}
        <button onClick={() => setMenuOpen(!menuOpen)} aria-label={menuOpen ? 'Fermer le menu' : 'Ouvrir le menu'} aria-expanded={menuOpen} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white">
          {menuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </header>
      {menuOpen && (
        <div className="fixed inset-0 z-30 bg-slate-950/50 lg:hidden" onClick={() => setMenuOpen(false)}>
          <div className={`flex h-full w-72 flex-col px-4 pb-5 pt-16 ${theme.bar}`} onClick={(e) => e.stopPropagation()}>
            {nav(true)}
            {userBlock}
          </div>
        </div>
      )}

      {onTasks ? (
        <main className="tasks-scope min-h-[calc(100dvh-3.5rem)] bg-ink-900 text-ink-50 lg:min-h-dvh">
          <Outlet />
        </main>
      ) : (
        <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
          <Outlet />
        </main>
      )}

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
