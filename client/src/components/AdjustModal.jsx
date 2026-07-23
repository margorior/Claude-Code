import { useEffect, useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { Modal, useToast, Spinner } from './ui';
import { api } from '../api';

export default function AdjustModal({ open, onClose, product, direction, onSaved }) {
  const toast = useToast();
  const [amount, setAmount] = useState('1');
  const [busy, setBusy] = useState(false);
  const isOut = direction === 'out';

  useEffect(() => {
    if (open) setAmount('1');
  }, [open]);

  if (!product) return null;

  const submit = async (e) => {
    e.preventDefault();
    const n = Number(String(amount).replace(',', '.'));
    if (!n || n <= 0) return toast('Entrez une quantité valide', 'error');
    if (isOut && n > product.quantity) return toast(`Il ne reste que ${product.quantity} ${product.unit}`, 'error');
    setBusy(true);
    try {
      await api(`/api/products/${product.id}/adjust`, { json: { delta: isOut ? -n : n } });
      toast(isOut ? `−${n} ${product.unit} · ${product.name}` : `+${n} ${product.unit} · ${product.name}`);
      onSaved();
      onClose();
    } catch (err) {
      toast(err.message, 'error');
    }
    setBusy(false);
  };

  const quick = [1, 2, 5, 10];

  return (
    <Modal open={open} onClose={onClose} title={isOut ? 'Prendre du matériel' : 'Remettre du matériel'}>
      <div className="mb-4 flex items-center gap-3 rounded-2xl bg-slate-50 p-3">
        {product.photo ? (
          <img src={`/uploads/${product.photo}`} alt="" className="h-12 w-12 rounded-xl object-cover" />
        ) : (
          <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${isOut ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'}`}>
            {isOut ? <Minus size={20} /> : <Plus size={20} />}
          </div>
        )}
        <div>
          <p className="font-semibold text-slate-800">{product.name}</p>
          <p className="text-sm text-slate-500">Disponible : {product.quantity} {product.unit}</p>
        </div>
      </div>

      <form onSubmit={submit}>
        <div className="mb-3 flex gap-2">
          {quick.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => setAmount(String(q))}
              className={`flex-1 rounded-xl border py-2 text-sm font-bold transition ${
                Number(amount) === q ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
              }`}
            >
              {q}
            </button>
          ))}
        </div>
        <input
          className="input text-center text-lg font-bold"
          type="number"
          step="any"
          min="0"
          autoFocus
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <button className={`${isOut ? 'btn-danger' : 'btn-primary !bg-emerald-600 hover:!bg-emerald-700'} mt-4 w-full !py-3`} disabled={busy}>
          {busy ? <Spinner className="h-5 w-5" /> : isOut ? `Retirer ${amount || ''} ${product.unit}` : `Ajouter ${amount || ''} ${product.unit}`}
        </button>
      </form>
    </Modal>
  );
}
