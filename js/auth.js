// Protection par mot de passe (volontairement simple : empêche un accès accidentel).
// La session reste ouverte tant que l'onglet n'est pas fermé.

import { config } from "./config.js";

const SESSION_KEY = "chantiers-auth";

export function isAuthenticated() {
  return sessionStorage.getItem(SESSION_KEY) === "ok";
}

export function login(password) {
  if (password === config.password) {
    sessionStorage.setItem(SESSION_KEY, "ok");
    return true;
  }
  return false;
}

export function logout() {
  sessionStorage.removeItem(SESSION_KEY);
}
