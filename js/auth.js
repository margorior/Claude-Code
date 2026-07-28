// Protection par mot de passe (volontairement simple : empêche un accès accidentel).
// La session reste ouverte tant que l'onglet n'est pas fermé.

import { config } from "./config.js";

const SESSION_KEY = "chantiers-auth";

// Certains navigateurs intégrés (Messenger, Instagram…) ou modes privés
// bloquent sessionStorage : on bascule alors sur une mémoire volatile.
let memoryFallback = null;

function readSession() {
  try {
    return sessionStorage.getItem(SESSION_KEY);
  } catch {
    return memoryFallback;
  }
}

function writeSession(value) {
  memoryFallback = value;
  try {
    value === null
      ? sessionStorage.removeItem(SESSION_KEY)
      : sessionStorage.setItem(SESSION_KEY, value);
  } catch {
    // mémoire volatile déjà à jour
  }
}

export function isAuthenticated() {
  return readSession() === "ok";
}

export function login(password) {
  // trim : espaces parasites fréquents sur mobile (autocomplétion, copier-coller)
  if (password.trim() === config.password) {
    writeSession("ok");
    return true;
  }
  return false;
}

export function logout() {
  writeSession(null);
}
