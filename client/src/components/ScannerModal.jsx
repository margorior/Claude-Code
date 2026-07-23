import { useEffect, useRef, useState } from 'react';
import { Modal } from './ui';

export default function ScannerModal({ open, onClose, onScan }) {
  const [error, setError] = useState('');
  const scannerRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setError('');
    let cancelled = false;
    import('html5-qrcode')
      .then(({ Html5Qrcode }) => {
        if (cancelled) return;
        const scanner = new Html5Qrcode('barcode-scanner');
        scannerRef.current = scanner;
        return scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 260, height: 160 } },
          (text) => onScan(text),
          () => {}
        );
      })
      .catch(() => setError("Impossible d'accéder à la caméra. Vérifiez les autorisations (et utilisez HTTPS ou localhost)."));
    return () => {
      cancelled = true;
      const s = scannerRef.current;
      if (s) {
        s.stop().then(() => s.clear()).catch(() => {});
      }
    };
  }, [open, onScan]);

  return (
    <Modal open={open} onClose={onClose} title="Scanner un code-barres">
      <div id="barcode-scanner" className="overflow-hidden rounded-2xl bg-slate-900 [&_video]:w-full" />
      {error ? (
        <p className="mt-3 rounded-xl bg-red-50 px-3.5 py-2.5 text-sm font-medium text-red-700">{error}</p>
      ) : (
        <p className="mt-3 text-center text-sm text-slate-500">Placez le code-barres devant la caméra.</p>
      )}
    </Modal>
  );
}
