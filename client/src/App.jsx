import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './AuthContext';
import { ToastProvider, Spinner } from './components/ui';
import { configured } from './lib/supabase';
import Layout from './Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Organisation from './pages/Organisation';
import History from './pages/History';
import Users from './pages/Users';
import Settings from './pages/Settings';

function Protected({ children, adminOnly = false }) {
  const { user, loading, isAdmin } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-brand-600">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (adminOnly && !isAdmin) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  if (!configured) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-brand-950 px-6">
        <div className="card max-w-lg p-6">
          <h1 className="mb-2 text-lg font-extrabold text-slate-900">⚙️ Configuration requise</h1>
          <p className="text-sm text-slate-600">
            L'application n'est pas encore reliée à votre base Supabase. Ouvrez le fichier{' '}
            <code className="rounded bg-slate-100 px-1.5 py-0.5 text-[13px] font-semibold">client/src/config.js</code>{' '}
            et remplacez les deux valeurs par l'URL et la clé « anon » de votre projet Supabase
            (guide complet dans <strong>INSTALLATION.md</strong> à la racine du projet).
          </p>
        </div>
      </div>
    );
  }
  return (
    <AuthProvider>
      <ToastProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<Protected><Layout /></Protected>}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/alertes" element={<Dashboard alertsOnly />} />
            <Route path="/organisation" element={<Organisation />} />
            <Route path="/historique" element={<History />} />
            <Route path="/utilisateurs" element={<Protected adminOnly><Users /></Protected>} />
            <Route path="/parametres" element={<Settings />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </ToastProvider>
    </AuthProvider>
  );
}
