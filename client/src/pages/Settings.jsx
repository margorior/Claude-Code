import { useEffect, useRef, useState } from 'react';
import { Warehouse, KeyRound, DatabaseBackup, Download, Upload, Lock } from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../AuthContext';
import { Field, useToast, Spinner, ConfirmDialog } from '../components/ui';

function Section({ icon: Icon, title, subtitle, children }) {
  return (
    <div className="card p-5">
      <div className="mb-4 flex items-center gap-2.5">
        <div className="rounded-xl bg-brand-50 p-2 text-brand-600"><Icon size={18} /></div>
        <div>
          <h2 className="font-bold text-slate-900">{title}</h2>
          {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}

export default function Settings() {
  const { isAdmin, settings, refreshSettings } = useAuth();
  const toast = useToast();
  const fileRef = useRef();
  const [form, setForm] = useState({ stock1_name: '', stock2_name: '', registration_password: '' });
  const [pwd, setPwd] = useState({ current: '', next: '' });
  const [busy, setBusy] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    setForm({
      stock1_name: settings.stock1_name || '',
      stock2_name: settings.stock2_name || '',
      registration_password: settings.registration_password || '',
    });
  }, [settings]);

  const saveSettings = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api('/api/settings', { method: 'PUT', json: form });
      await refreshSettings();
      toast('Paramètres enregistrés');
    } catch (err) {
      toast(err.message, 'error');
    }
    setBusy(false);
  };

  const changePassword = async (e) => {
    e.preventDefault();
    try {
      await api('/api/auth/password', { method: 'PUT', json: pwd });
      setPwd({ current: '', next: '' });
      toast('Mot de passe modifié');
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const doImport = async () => {
    setImporting(true);
    try {
      const fd = new FormData();
      fd.append('backup', importFile);
      const r = await api('/api/backup/import', { method: 'POST', body: fd });
      toast(`Sauvegarde importée (${r.products} produits). Reconnectez-vous si besoin.`);
      setImportFile(null);
      window.dispatchEvent(new Event('stock-changed'));
      setTimeout(() => window.location.reload(), 1200);
    } catch (err) {
      toast(err.message, 'error');
    }
    setImporting(false);
  };

  return (
    <div>
      <h1 className="mb-1 text-xl font-extrabold tracking-tight text-slate-900 sm:text-2xl">Paramètres</h1>
      <p className="mb-5 text-sm text-slate-500">Configuration de l'application{isAdmin ? ' et sauvegardes' : ''}.</p>

      <div className="grid gap-4 lg:grid-cols-2">
        {isAdmin && (
          <Section icon={Warehouse} title="Noms des stocks" subtitle="Personnalisez le nom de vos deux stocks">
            <form onSubmit={saveSettings} className="flex flex-col gap-4">
              <Field label="Nom du stock 1">
                <input className="input" value={form.stock1_name} onChange={(e) => setForm({ ...form, stock1_name: e.target.value })} />
              </Field>
              <Field label="Nom du stock 2">
                <input className="input" value={form.stock2_name} onChange={(e) => setForm({ ...form, stock2_name: e.target.value })} />
              </Field>
              <Field label="Mot de passe d'accès à l'inscription" hint="À communiquer aux personnes autorisées à créer un compte.">
                <input className="input" value={form.registration_password} onChange={(e) => setForm({ ...form, registration_password: e.target.value })} />
              </Field>
              <button className="btn-primary self-end" disabled={busy}>
                {busy ? <Spinner className="h-4 w-4" /> : 'Enregistrer'}
              </button>
            </form>
          </Section>
        )}

        <Section icon={Lock} title="Mon mot de passe" subtitle="Changer votre mot de passe de connexion">
          <form onSubmit={changePassword} className="flex flex-col gap-4">
            <Field label="Mot de passe actuel">
              <input className="input" type="password" required autoComplete="current-password" value={pwd.current} onChange={(e) => setPwd({ ...pwd, current: e.target.value })} />
            </Field>
            <Field label="Nouveau mot de passe" hint="6 caractères minimum">
              <input className="input" type="password" required autoComplete="new-password" value={pwd.next} onChange={(e) => setPwd({ ...pwd, next: e.target.value })} />
            </Field>
            <button className="btn-primary self-end"><KeyRound size={16} /> Modifier</button>
          </form>
        </Section>

        {isAdmin && (
          <div className="lg:col-span-2">
            <Section
              icon={DatabaseBackup}
              title="Sauvegarde & migration"
              subtitle="Téléchargez une sauvegarde complète (produits, photos, comptes, historique) ou restaurez-la sur un autre serveur"
            >
              <div className="flex flex-col gap-3 sm:flex-row">
                <a href="/api/backup" className="btn-primary flex-1 !py-3">
                  <Download size={17} /> Télécharger la sauvegarde
                </a>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".zip"
                  className="hidden"
                  onChange={(e) => { if (e.target.files?.[0]) setImportFile(e.target.files[0]); e.target.value = ''; }}
                />
                <button className="btn-ghost flex-1 !py-3" onClick={() => fileRef.current.click()} disabled={importing}>
                  {importing ? <Spinner className="h-4 w-4" /> : <><Upload size={17} /> Importer une sauvegarde</>}
                </button>
              </div>
              <p className="mt-3 text-xs text-slate-400">
                ⚠️ L'import remplace <strong>toutes</strong> les données actuelles (produits, comptes, historique) par celles de la sauvegarde.
              </p>
            </Section>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!importFile}
        onClose={() => setImportFile(null)}
        onConfirm={doImport}
        title="Restaurer cette sauvegarde ?"
        message={`Toutes les données actuelles seront remplacées par le contenu de « ${importFile?.name} ». Cette action est irréversible.`}
        confirmLabel="Restaurer"
      />
    </div>
  );
}
