import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { X, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

/* ---------------------------------------------------------------- Toasts */
const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const toast = useCallback((message, type = 'success') => {
    const id = ++idRef.current;
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
  }, []);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex flex-col items-center gap-2 px-4">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium text-white shadow-pop ${
              t.type === 'error' ? 'bg-red-600' : 'bg-slate-900'
            }`}
          >
            {t.type === 'error' ? <AlertCircle size={17} /> : <CheckCircle2 size={17} className="text-emerald-400" />}
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);

/* ---------------------------------------------------------------- Modal */
export function Modal({ open, onClose, title, children, wide = false }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-0 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white shadow-pop sm:rounded-3xl ${wide ? 'sm:max-w-2xl' : 'sm:max-w-md'}`}>
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white/95 px-5 py-4 backdrop-blur">
          <h2 className="text-base font-bold text-slate-900">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700">
            <X size={20} />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- Confirm */
export function ConfirmDialog({ open, onClose, onConfirm, title, message, confirmLabel = 'Supprimer' }) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <p className="text-sm text-slate-600">{message}</p>
      <div className="mt-5 flex justify-end gap-2">
        <button className="btn-ghost" onClick={onClose}>Annuler</button>
        <button className="btn-danger" onClick={onConfirm}>{confirmLabel}</button>
      </div>
    </Modal>
  );
}

/* ---------------------------------------------------------------- Misc */
export function Spinner({ className = '' }) {
  return <Loader2 className={`animate-spin ${className}`} size={22} />;
}

export function Field({ label, children, hint }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-semibold text-slate-700">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-400">{hint}</span>}
    </label>
  );
}

export function EmptyState({ icon: Icon, title, subtitle, action }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      {Icon && (
        <div className="mb-4 rounded-2xl bg-slate-100 p-4 text-slate-400">
          <Icon size={30} />
        </div>
      )}
      <p className="font-semibold text-slate-700">{title}</p>
      {subtitle && <p className="mt-1 max-w-sm text-sm text-slate-500">{subtitle}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Pagination({ page, total, limit, onPage }) {
  const pages = Math.max(1, Math.ceil(total / limit));
  if (pages <= 1) return null;
  return (
    <div className="flex items-center justify-between gap-3 px-1 py-3 text-sm text-slate-500">
      <span>
        Page {page} / {pages} · {total} référence{total > 1 ? 's' : ''}
      </span>
      <div className="flex gap-2">
        <button className="btn-ghost !px-3 !py-1.5" disabled={page <= 1} onClick={() => onPage(page - 1)}>Précédent</button>
        <button className="btn-ghost !px-3 !py-1.5" disabled={page >= pages} onClick={() => onPage(page + 1)}>Suivant</button>
      </div>
    </div>
  );
}
