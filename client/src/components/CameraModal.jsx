import { useEffect, useRef, useState } from 'react';
import { Camera, SwitchCamera } from 'lucide-react';
import { Modal } from './ui';

const REAR = /rear|back|arri[eè]re|environment/i;

function cameraError(err) {
  if (err?.name === 'NotAllowedError') return "Accès à la caméra refusé. Autorisez la caméra pour ce site (icône à gauche de l'adresse), puis réessayez.";
  if (err?.name === 'NotFoundError') return 'Aucune caméra détectée sur cet appareil.';
  if (err?.name === 'NotReadableError') return 'La caméra est déjà utilisée par une autre application. Fermez-la puis réessayez.';
  return "Impossible d'accéder à la caméra.";
}

export default function CameraModal({ open, onClose, onCapture }) {
  const videoRef = useRef(null);
  const [cameras, setCameras] = useState([]);
  const [deviceId, setDeviceId] = useState(null);
  const [activeId, setActiveId] = useState(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    let stream = null;
    let cancelled = false;
    setReady(false);
    setError('');
    const source = deviceId ? { deviceId: { exact: deviceId } } : { facingMode: { ideal: 'environment' } };
    navigator.mediaDevices
      .getUserMedia({ video: { ...source, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false })
      .then(async (s) => {
        stream = s;
        if (cancelled) return s.getTracks().forEach((t) => t.stop());
        videoRef.current.srcObject = s;
        const track = s.getVideoTracks()[0];
        const cams = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'videoinput');
        if (cancelled) return;
        setCameras(cams);
        setActiveId(track.getSettings().deviceId);
        // Sur Windows, « caméra arrière » n'est pas toujours reconnu : on la cherche par son nom
        if (!deviceId && !REAR.test(track.label)) {
          const rear = cams.find((c) => REAR.test(c.label));
          if (rear) setDeviceId(rear.deviceId);
        }
      })
      .catch((err) => !cancelled && setError(cameraError(err)));
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [open, deviceId]);

  const switchCamera = () => {
    const i = cameras.findIndex((c) => c.deviceId === activeId);
    setDeviceId(cameras[(i + 1) % cameras.length].deviceId);
  };

  const capture = () => {
    const v = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    canvas.getContext('2d').drawImage(v, 0, 0);
    canvas.toBlob((blob) => blob && onCapture(new File([blob], 'photo.jpg', { type: 'image/jpeg' })), 'image/jpeg', 0.92);
  };

  return (
    <Modal open={open} onClose={onClose} title="Prendre une photo">
      {error ? (
        <p className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm font-medium text-red-700">{error}</p>
      ) : (
        <>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            onLoadedMetadata={() => setReady(true)}
            className="max-h-[60vh] w-full rounded-2xl bg-slate-900"
          />
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2.5">
            {cameras.length > 1 && (
              <button type="button" className="btn-ghost" onClick={switchCamera}>
                <SwitchCamera size={18} /> Changer de caméra
              </button>
            )}
            <button type="button" className="btn-primary" disabled={!ready} onClick={capture}>
              <Camera size={18} /> Prendre la photo
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
