import { useEffect, useRef, useState } from 'react';
import { SwitchCamera } from 'lucide-react';
import { Modal } from './ui';
import { listCameras, preferredCamera, nextCamera, cameraError } from '../lib/cameras';

export default function ScannerModal({ open, onClose, onScan }) {
  const [error, setError] = useState('');
  const [reading, setReading] = useState(null);
  const [cameras, setCameras] = useState([]);
  const [deviceId, setDeviceId] = useState(null);
  const [activeId, setActiveId] = useState(null);
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;
  // La caméra précédente doit être libérée avant d'en ouvrir une autre
  const stopped = useRef(Promise.resolve());

  useEffect(() => {
    if (!open) return;
    setError('');
    setReading(null);
    let cancelled = false;
    let accepted = false;
    let scanner = null;
    // Fiabilité : on n'accepte un code que s'il est lu 2 fois identique
    // d'affilée — élimine les lectures ratées (chiffre manquant, etc.)
    let last = { code: null, count: 0 };

    const started = stopped.current
      .then(() => import('html5-qrcode'))
      .then(({ Html5Qrcode }) => {
        if (cancelled) return;
        scanner = new Html5Qrcode('barcode-scanner');
        return scanner.start(
          deviceId || { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 260, height: 160 } },
          (text) => {
            if (accepted) return;
            const t = String(text).trim();
            if (!t) return;
            last = last.code === t ? { code: t, count: last.count + 1 } : { code: t, count: 1 };
            setReading(t);
            if (last.count >= 2) {
              accepted = true;
              try { navigator.vibrate?.(120); } catch {}
              onScanRef.current(t);
            }
          },
          () => {}
        );
      });

    started
      .then(async () => {
        if (cancelled || !scanner) return;
        const id = scanner.getRunningTrackSettings().deviceId;
        const cams = await listCameras();
        if (cancelled) return;
        setCameras(cams);
        setActiveId(id);
        const better = !deviceId && preferredCamera(cams, id);
        if (better) setDeviceId(better);
      })
      .catch((err) => !cancelled && setError(cameraError(err)));

    return () => {
      cancelled = true;
      stopped.current = started
        .then(() => scanner?.stop().then(() => scanner.clear()))
        .catch(() => {});
    };
  }, [open, deviceId]);

  return (
    <Modal open={open} onClose={onClose} title="Scanner un code-barres">
      <div id="barcode-scanner" className="overflow-hidden rounded-2xl bg-slate-900 [&_video]:w-full" />
      {error ? (
        <p className="mt-3 rounded-xl bg-red-50 px-3.5 py-2.5 text-sm font-medium text-red-700">{error}</p>
      ) : reading ? (
        <p className="mt-3 text-center text-sm font-semibold text-brand-700">
          Lecture : {reading} — confirmation en cours…
        </p>
      ) : (
        <p className="mt-3 text-center text-sm text-slate-500">
          Placez le code-barres devant la caméra, bien à plat et éclairé.
        </p>
      )}
      {cameras.length > 1 && (
        <div className="mt-3 flex justify-center">
          <button type="button" className="btn-ghost" onClick={() => setDeviceId(nextCamera(cameras, activeId))}>
            <SwitchCamera size={18} /> Changer de caméra
          </button>
        </div>
      )}
    </Modal>
  );
}
