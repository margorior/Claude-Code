const REAR = /rear|back|arri[eè]re|environment/i;
// Caméra infrarouge (Windows Hello sur Surface) : image inutilisable
const INFRARED = /\bIR\b|infra/i;

export async function listCameras() {
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices.filter((d) => d.kind === 'videoinput' && !INFRARED.test(d.label));
}

// Sur Windows, « caméra arrière » n'est pas toujours compris par le navigateur :
// si la caméra ouverte n'est pas l'arrière, on renvoie celle à ouvrir à la place.
export function preferredCamera(cameras, activeId) {
  const active = cameras.find((c) => c.deviceId === activeId);
  if (active && REAR.test(active.label)) return null;
  const target = cameras.find((c) => REAR.test(c.label)) || (active ? null : cameras[0]);
  return target && target.deviceId !== activeId ? target.deviceId : null;
}

export function nextCamera(cameras, activeId) {
  const i = cameras.findIndex((c) => c.deviceId === activeId);
  return cameras[(i + 1) % cameras.length]?.deviceId ?? null;
}

export function cameraError(err) {
  const msg = `${err?.name || ''} ${err?.message || err || ''}`;
  if (/NotAllowed|Permission/i.test(msg)) return "Accès à la caméra refusé. Autorisez la caméra pour ce site (icône à gauche de l'adresse), puis réessayez.";
  if (/NotFound|DevicesNotFound/i.test(msg)) return 'Aucune caméra détectée sur cet appareil.';
  if (/NotReadable|TrackStart|Could not start/i.test(msg)) return 'La caméra est déjà utilisée par une autre application. Fermez-la puis réessayez.';
  return "Impossible d'accéder à la caméra.";
}
