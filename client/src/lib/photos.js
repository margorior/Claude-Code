// Seuls les téléphones/tablettes Android et Apple ouvrent l'appareil photo via
// l'attribut capture ; sur PC (Windows…) il ouvre l'explorateur de fichiers.
export const NATIVE_CAPTURE = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
  || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);

// Vrai si « Prendre une photo » doit passer par la caméra intégrée à l'appli
export const inAppCamera = () => !NATIVE_CAPTURE && !!navigator.mediaDevices?.getUserMedia;

// Réduit la photo côté client et la convertit en WebP (format très léger)
// pour garder la base rapide et économe.
export async function resizeImage(file, max = 900) {
  try {
    const bmp = await createImageBitmap(file);
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
