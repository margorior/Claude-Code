// Pile des fenêtres ouvertes, reliée au bouton « retour » du téléphone ou du
// navigateur : un retour (ou la touche Échap) ne ferme que la fenêtre du dessus,
// jamais celles qui sont en dessous.
const stack = [];
let ignore = 0;
let pending = 0;

window.addEventListener('popstate', () => {
  if (ignore > 0) {
    ignore--;
    return;
  }
  const top = stack.pop();
  if (top) top.close();
});

window.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape' || !stack.length) return;
  e.preventDefault();
  window.history.back();
});

export const hasLayers = () => stack.length > 0;

// Déclare une fenêtre ouverte ; renvoie la fonction à appeler à sa fermeture.
export function openLayer(close) {
  const entry = { close };
  stack.push(entry);
  window.history.pushState({ ...(window.history.state || {}), layer: stack.length }, '');
  return () => {
    const i = stack.indexOf(entry);
    if (i === -1) return; // déjà fermée par le bouton retour
    stack.splice(i, 1);
    // On retire l'entrée d'historique correspondante, sauf si l'utilisateur a
    // changé de page entre-temps
    if (!window.history.state?.layer) return;
    pending++;
    if (pending > 1) return;
    queueMicrotask(() => {
      const n = pending;
      pending = 0;
      ignore++;
      window.history.go(-n);
    });
  };
}
