import { useEffect, useRef, useState } from 'react';
import { Camera, Trash2, ScanBarcode, Image as ImageIcon, ImageOff, Plus, Check, X } from 'lucide-react';
import { Modal, Field, ConfirmDialog, useToast, Spinner } from './ui';
import { api, photoUrl } from '../api';
import { useAuth } from '../AuthContext';
import ScannerModal from './ScannerModal';
import CameraModal from './CameraModal';
import SuggestInput from './SuggestInput';
import { searchWords, upperClean } from '../lib/text';

// Seuls les téléphones/tablettes Android et Apple ouvrent l'appareil photo via
// l'attribut capture ; sur PC (Windows…) il ouvre l'explorateur de fichiers.
const NATIVE_CAPTURE = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
  || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);

const UNITS = ['pièce', 'mètre', 'boîte', 'rouleau', 'sachet', 'kg', 'litre', 'paquet', 'lot'];

// Réduit la photo côté client (max 900px) et la convertit en WebP
// (format très léger) pour garder la base rapide et économe.
async function resizeImage(file) {
  try {
    const bmp = await createImageBitmap(file);
    const max = 900;
    const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext('2d').drawImage(bmp, 0, 0, canvas.width, canvas.height);
    let blob = await new Promise((r) => canvas.toBlob(r, 'image/webp', 0.8));
    if (blob && blob.type === 'image/webp') {
      return new File([blob], 'photo.webp', { type: 'image/webp' });
    }
    // Vieux navigateur sans WebP : on retombe sur du JPEG
    blob = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', 0.82));
    return new File([blob], 'photo.jpg', { type: 'image/jpeg' });
  } catch {
    return file;
  }
}

export default function ProductModal({ open, onClose, product, categories, zones, onSaved, onRefsChanged }) {
  const { settings } = useAuth();
  const toast = useToast();
  const isEdit = !!product;
  const fileRef = useRef();
  const cameraRef = useRef();
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [form, setForm] = useState({});
  const [names, setNames] = useState([]);
  const [brands, setBrands] = useState([]);
  const [newCat, setNewCat] = useState(null);
  const [extraCats, setExtraCats] = useState([]);

  // Noms et marques déjà saisis : proposés pendant la frappe
  useEffect(() => {
    if (!open) return;
    let alive = true;
    api('/api/products/suggest')
      .then((d) => { if (alive) { setNames(d.names); setBrands(d.brands); } })
      .catch(() => {});
    return () => { alive = false; };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setNewCat(null);
    setForm({
      name: product?.name || '',
      brand: product?.brand || '',
      reference: product?.reference || '',
      barcode: product?.barcode || '',
      unit: product?.unit || 'pièce',
      quantity: product?.quantity ?? '',
      stock: product?.stock || 1,
      category_id: product?.category_id || '',
      zone_id: product?.zone_id || '',
      sub_zone: product?.sub_zone || '',
      alert_threshold: product?.alert_threshold ?? '',
    });
    setPhotoFile(null);
    setPhotoPreview(product?.photo ? photoUrl(product.photo) : null);
    setRemovePhoto(false);
  }, [open, product]);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const allCategories = [...categories, ...extraCats.filter((x) => !categories.some((c) => c.id === x.id))];

  const brandKey = searchWords(form.brand).join('');
  const shownBrands = brands.filter((b) => !brandKey || searchWords(b).join('').includes(brandKey));

  const createCategory = async () => {
    const name = String(newCat || '').trim();
    if (!name) return setNewCat(null);
    const same = allCategories.find((c) => searchWords(c.name).join('') === searchWords(name).join(''));
    if (same) {
      setForm((f) => ({ ...f, category_id: same.id }));
      return setNewCat(null);
    }
    try {
      const created = await api('/api/categories', { json: { name } });
      setExtraCats((x) => [...x, { id: created.id, name }]);
      setForm((f) => ({ ...f, category_id: created.id }));
      setNewCat(null);
      onRefsChanged?.();
      toast(`Catégorie « ${name} » créée`);
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const applyPhoto = async (f) => {
    const resized = await resizeImage(f);
    setPhotoFile(resized);
    setPhotoPreview(URL.createObjectURL(resized));
    setRemovePhoto(false);
  };

  const pickPhoto = (e) => {
    const f = e.target.files?.[0];
    if (f) applyPhoto(f);
  };

  const takePhoto = () => {
    if (NATIVE_CAPTURE || !navigator.mediaDevices?.getUserMedia) cameraRef.current.click();
    else setCameraOpen(true);
  };

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const fd = new FormData();
      for (const [k, v] of Object.entries(form)) fd.append(k, v ?? '');
      if (photoFile) fd.append('photo', photoFile);
      if (removePhoto) fd.append('removePhoto', '1');
      if (isEdit) {
        await api(`/api/products/${product.id}`, { method: 'PUT', body: fd });
        toast('Produit modifié');
      } else {
        await api('/api/products', { method: 'POST', body: fd });
        toast('Produit ajouté');
      }
      onSaved();
      onClose();
    } catch (err) {
      toast(err.message, 'error');
    }
    setBusy(false);
  };

  const doDelete = async () => {
    try {
      await api(`/api/products/${product.id}`, { method: 'DELETE' });
      toast('Produit supprimé');
      setConfirmDelete(false);
      onSaved();
      onClose();
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  return (
    <>
      <Modal open={open} onClose={onClose} title={isEdit ? 'Modifier le produit' : 'Nouveau produit'} wide>
        <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
          {/* Photo */}
          <div className="sm:col-span-2">
            {/* capture="environment" ouvre directement l'appareil photo arrière */}
            <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={pickPhoto} />
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={pickPhoto} />
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={takePhoto}
                className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 text-slate-400 transition hover:border-brand-400 hover:text-brand-500"
              >
                {photoPreview ? (
                  <img src={photoPreview} alt="" className="h-full w-full object-cover" />
                ) : (
                  <Camera size={26} />
                )}
              </button>
              <div className="text-sm text-slate-500">
                <p className="font-semibold text-slate-700">Photo du produit <span className="font-normal text-slate-400">(optionnelle)</span></p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button type="button" className="btn-ghost !px-3 !py-1.5 !text-xs" onClick={takePhoto}>
                    <Camera size={14} /> Prendre une photo
                  </button>
                  <button type="button" className="btn-ghost !px-3 !py-1.5 !text-xs" onClick={() => fileRef.current.click()}>
                    <ImageIcon size={14} /> Galerie
                  </button>
                  {photoPreview && (
                    <button
                      type="button"
                      onClick={() => { setPhotoFile(null); setPhotoPreview(null); setRemovePhoto(true); }}
                      className="btn-ghost !px-3 !py-1.5 !text-xs !text-red-600"
                    >
                      <ImageOff size={14} /> Retirer
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="sm:col-span-2">
            <Field label="Nom du produit *">
              <SuggestInput
                required
                placeholder="ex. Câble 3G2,5 mm²"
                options={names}
                value={form.name || ''}
                onChange={(v) => setForm((f) => ({ ...f, name: v }))}
              />
            </Field>
          </div>

          <Field label="Marque" hint="Enregistrée en majuscules.">
            <input className="input uppercase placeholder:normal-case" placeholder="ex. Legrand, Schneider…" value={form.brand || ''} onChange={set('brand')} />
          </Field>

          {/* Marques déjà saisies : un clic évite les fautes et les doublons */}
          <div>
            <span className="mb-1.5 block text-[13px] font-semibold text-slate-700">Marques déjà utilisées</span>
            {brands.length === 0 ? (
              <p className="rounded-xl bg-slate-50 px-3 py-2.5 text-xs text-slate-400">Les marques déjà saisies apparaîtront ici.</p>
            ) : shownBrands.length === 0 ? (
              <p className="rounded-xl bg-slate-50 px-3 py-2.5 text-xs text-slate-400">Nouvelle marque : elle sera ajoutée à la liste.</p>
            ) : (
              <div className="flex max-h-[5.75rem] flex-wrap gap-1.5 overflow-y-auto rounded-xl bg-slate-50 p-2">
                {shownBrands.map((b) => {
                  const selected = upperClean(form.brand) === b;
                  return (
                    <button
                      key={b}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setForm((f) => ({ ...f, brand: b }))}
                      className={`rounded-lg border px-2.5 py-1.5 text-xs font-bold transition ${
                        selected
                          ? 'border-brand-600 bg-brand-600 text-white'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-brand-400 hover:text-brand-700'
                      }`}
                    >
                      {b}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <Field label="Référence" hint="Enregistrée en majuscules.">
            <input className="input uppercase placeholder:normal-case" placeholder="ex. LEG-099204" value={form.reference || ''} onChange={set('reference')} />
          </Field>

          <Field label="Code-barres">
            <div className="flex gap-2">
              <input className="input" placeholder="Optionnel" value={form.barcode || ''} onChange={set('barcode')} />
              <button type="button" className="btn-ghost !px-3" title="Scanner" onClick={() => setScanOpen(true)}>
                <ScanBarcode size={18} />
              </button>
            </div>
          </Field>

          <div>
            <label htmlFor="product-category" className="mb-1.5 block text-[13px] font-semibold text-slate-700">Catégorie</label>
            {newCat === null ? (
              <div className="flex gap-2">
                <select id="product-category" className="input" value={form.category_id || ''} onChange={set('category_id')}>
                  <option value="">— Aucune —</option>
                  {allCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <button type="button" className="btn-ghost shrink-0 !px-3" title="Créer une catégorie" aria-label="Créer une catégorie" onClick={() => setNewCat('')}>
                  <Plus size={18} />
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  id="product-category"
                  className="input"
                  autoFocus
                  placeholder="Nom de la nouvelle catégorie"
                  value={newCat}
                  onChange={(e) => setNewCat(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { e.preventDefault(); createCategory(); }
                    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setNewCat(null); }
                  }}
                />
                <button type="button" className="btn-primary shrink-0 !px-3" title="Créer" aria-label="Créer la catégorie" onClick={createCategory}>
                  <Check size={18} />
                </button>
                <button type="button" className="btn-ghost shrink-0 !px-3" title="Annuler" aria-label="Annuler" onClick={() => setNewCat(null)}>
                  <X size={18} />
                </button>
              </div>
            )}
          </div>

          <Field label="Quantité *">
            <input className="input" type="number" step="any" min="0" required value={form.quantity} onChange={set('quantity')} />
          </Field>

          <Field label="Unité">
            <select className="input" value={form.unit || 'pièce'} onChange={set('unit')}>
              {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          </Field>

          <Field label="Stock">
            <select className="input" value={form.stock || 1} onChange={set('stock')}>
              <option value={1}>{settings.stock1_name}</option>
              <option value={2}>{settings.stock2_name}</option>
              <option value={3}>{settings.stock3_name}</option>
            </select>
          </Field>

          <Field label="Zone de rangement">
            <select className="input" value={form.zone_id || ''} onChange={set('zone_id')}>
              <option value="">— Aucune —</option>
              {zones.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
            </select>
          </Field>

          <Field label="Emplacement dans la zone" hint="Optionnel — pour préciser où dans la zone/armoire.">
            <input className="input" placeholder="ex. étagère 2" value={form.sub_zone || ''} onChange={set('sub_zone')} />
          </Field>

          <Field label="Seuil d'alerte" hint="Alerte quand la quantité passe sous ce seuil (0 = pas d'alerte).">
            <input className="input" type="number" step="any" min="0" value={form.alert_threshold} onChange={set('alert_threshold')} placeholder="0" />
          </Field>

          <div className="mt-2 flex items-center justify-between gap-2 sm:col-span-2">
            {isEdit ? (
              <button type="button" className="btn-ghost !text-red-600" onClick={() => setConfirmDelete(true)}>
                <Trash2 size={16} /> Supprimer
              </button>
            ) : <span />}
            <div className="flex gap-2">
              <button type="button" className="btn-ghost" onClick={onClose}>Annuler</button>
              <button className="btn-primary" disabled={busy}>
                {busy ? <Spinner className="h-4 w-4" /> : isEdit ? 'Enregistrer' : 'Ajouter'}
              </button>
            </div>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={doDelete}
        title="Supprimer ce produit ?"
        message={`« ${product?.name} » sera définitivement supprimé du stock.`}
      />

      <CameraModal open={cameraOpen} onClose={() => setCameraOpen(false)} onCapture={(f) => { applyPhoto(f); setCameraOpen(false); }} />
      <ScannerModal open={scanOpen} onClose={() => setScanOpen(false)} onScan={(code) => { setForm((f) => ({ ...f, barcode: code })); setScanOpen(false); }} />
    </>
  );
}
