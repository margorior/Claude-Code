import { useEffect, useRef, useState } from 'react';
import { Camera, SwitchCamera } from 'lucide-react';
import { Modal } from './ui';
import { listCameras, preferredCamera, nextCamera, cameraError } from '../lib/cameras';

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
        const id = s.getVideoTracks()[0].getSettings().deviceId;
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
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [open, deviceId]);

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
              <button type="button" className="btn-ghost" onClick={() => setDeviceId(nextCamera(cameras, activeId))}>
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
