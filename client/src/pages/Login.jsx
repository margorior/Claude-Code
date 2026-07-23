import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap } from 'lucide-react';
import { useAuth } from '../AuthContext';
import { api } from '../api';
import { Field, Spinner } from '../components/ui';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState('login');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [form, setForm] = useState({ username: '', password: '', displayName: '', accessPassword: '' });

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    setInfo('');
    try {
      if (tab === 'login') {
        await login(form.username, form.password);
        navigate('/');
      } else {
        const r = await api('/api/auth/register', {
          json: {
            accessPassword: form.accessPassword,
            username: form.username,
            displayName: form.displayName,
            password: form.password,
          },
        });
        setInfo(r.message);
        setTab('login');
      }
    } catch (err) {
      setError(err.message);
    }
    setBusy(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-950 via-brand-900 to-brand-700 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-3xl bg-white/10 shadow-pop backdrop-blur">
            <Zap size={30} className="text-amber-300" fill="currentColor" />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-white">Gestion de Stock</h1>
          <p className="mt-1 text-sm text-brand-100/80">Matériel électrique · deux stocks, un seul outil</p>
        </div>

        <div className="card overflow-hidden !rounded-3xl">
          <div className="grid grid-cols-2 border-b border-slate-100">
            {[['login', 'Connexion'], ['register', 'Créer un compte']].map(([key, label]) => (
              <button
                key={key}
                onClick={() => { setTab(key); setError(''); setInfo(''); }}
                className={`py-3.5 text-sm font-bold transition ${
                  tab === key ? 'border-b-2 border-brand-600 text-brand-700' : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="flex flex-col gap-4 px-6 py-6">
            {tab === 'register' && (
              <>
                <Field label="Mot de passe d'accès" hint="Demandez-le à l'administrateur — il protège la création de comptes.">
                  <input className="input" type="password" required value={form.accessPassword} onChange={set('accessPassword')} />
                </Field>
                <Field label="Votre nom complet">
                  <input className="input" required placeholder="ex. Jean Dupont" value={form.displayName} onChange={set('displayName')} />
                </Field>
              </>
            )}
            <Field label="Nom d'utilisateur">
              <input className="input" required autoComplete="username" value={form.username} onChange={set('username')} />
            </Field>
            <Field label="Mot de passe" hint={tab === 'register' ? '6 caractères minimum' : undefined}>
              <input className="input" type="password" required autoComplete={tab === 'login' ? 'current-password' : 'new-password'} value={form.password} onChange={set('password')} />
            </Field>

            {error && <p className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm font-medium text-red-700">{error}</p>}
            {info && <p className="rounded-xl bg-emerald-50 px-3.5 py-2.5 text-sm font-medium text-emerald-700">{info}</p>}

            <button className="btn-primary mt-1 w-full !py-3" disabled={busy}>
              {busy ? <Spinner className="h-5 w-5" /> : tab === 'login' ? 'Se connecter' : 'Créer mon compte'}
            </button>
            {tab === 'register' && (
              <p className="text-center text-xs text-slate-400">
                Votre compte devra ensuite être validé par l'administrateur avant de pouvoir vous connecter.
              </p>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
