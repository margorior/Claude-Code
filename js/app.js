import { chantiers } from "./data.js";
import { createStorage } from "./storage.js";
import { isAuthenticated, login, logout } from "./auth.js";

// Identifiant stable d'un chantier (indépendant de son libellé, gère les doublons).
const chantierId = (commune, categorie, index) =>
  `${commune}::${categorie}::${index}`;

let storage;
let done = new Map(); // id du chantier -> date ISO de validation (ou null)

const formatDate = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("fr-FR");
};

// --- Écran de connexion --------------------------------------------------

const loginView = document.getElementById("login");
const appView = document.getElementById("app");
const loginForm = document.getElementById("login-form");
const passwordInput = document.getElementById("password");
const loginError = document.getElementById("login-error");

function showApp() {
  loginView.hidden = true;
  appView.hidden = false;
}

loginForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (login(passwordInput.value)) {
    passwordInput.value = "";
    loginError.hidden = true;
    showApp();
    start();
  } else {
    loginError.hidden = false;
    passwordInput.select();
  }
});

document.getElementById("logout").addEventListener("click", () => {
  logout();
  appView.hidden = true;
  loginView.hidden = false;
});

// --- Dialogue de confirmation de décoche ---------------------------------

const dialog = document.getElementById("confirm-dialog");
const confirmInput = document.getElementById("confirm-input");
const confirmValidate = document.getElementById("confirm-validate");
const CONFIRM_WORD = "CONFIRMER";

// Demande la confirmation. Résout à true seulement si l'utilisateur tape le mot exact.
function askConfirmation() {
  return new Promise((resolve) => {
    confirmInput.value = "";
    confirmValidate.disabled = true;
    dialog.returnValue = "cancel";
    dialog.showModal();
    confirmInput.focus();

    const onInput = () => {
      confirmValidate.disabled = confirmInput.value !== CONFIRM_WORD;
    };
    const onClose = () => {
      confirmInput.removeEventListener("input", onInput);
      dialog.removeEventListener("close", onClose);
      resolve(dialog.returnValue === "confirm");
    };
    confirmInput.addEventListener("input", onInput);
    dialog.addEventListener("close", onClose);
  });
}

// --- Rendu de l'application -----------------------------------------------

const communesEl = document.getElementById("communes");

function makeRow(commune, categorie, nom, index) {
  const id = chantierId(commune, categorie, index);
  const isDone = done.has(id);

  const li = document.createElement("li");
  li.className = "chantier" + (isDone ? " is-done" : "");

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = isDone;
  checkbox.id = id;

  const label = document.createElement("label");
  label.htmlFor = id;
  label.className = "chantier-label";
  label.textContent = nom;

  const date = document.createElement("span");
  date.className = "done-date";
  date.textContent = formatDate(done.get(id));

  checkbox.addEventListener("change", async () => {
    if (checkbox.checked) {
      await setDone(id, li, date, true);
      return;
    }
    // Décoche : on annule visuellement puis on demande confirmation.
    checkbox.checked = true;
    const confirmed = await askConfirmation();
    if (confirmed) {
      checkbox.checked = false;
      await setDone(id, li, date, false);
    }
  });

  li.append(checkbox, label, date);
  return li;
}

async function setDone(id, li, dateEl, value) {
  const when = value ? new Date().toISOString() : null;
  li.classList.toggle("is-done", value);
  value ? done.set(id, when) : done.delete(id);
  dateEl.textContent = formatDate(when);
  updateCounts();
  try {
    await storage.setCompleted(id, value, when);
  } catch (error) {
    console.error("Échec de la sauvegarde.", error);
  }
}

function render() {
  communesEl.replaceChildren();

  for (const [commune, categories] of Object.entries(chantiers)) {
    const section = document.createElement("section");
    section.className = "commune";

    const title = document.createElement("h2");
    title.className = "commune-title";
    title.textContent = commune;
    section.append(title);

    const grid = document.createElement("div");
    grid.className = "cards";

    for (const [categorie, noms] of Object.entries(categories)) {
      const card = document.createElement("article");
      card.className = "card";

      const header = document.createElement("div");
      header.className = "card-header";

      const h3 = document.createElement("h3");
      h3.textContent = categorie;

      const count = document.createElement("span");
      count.className = "count";
      count.dataset.commune = commune;
      count.dataset.categorie = categorie;

      header.append(h3, count);
      card.append(header);

      const list = document.createElement("ul");
      list.className = "chantiers";
      noms.forEach((nom, index) => {
        list.append(makeRow(commune, categorie, nom, index));
      });
      card.append(list);
      grid.append(card);
    }

    section.append(grid);
    communesEl.append(section);
  }

  updateCounts();
}

// Met à jour les compteurs "terminés / total" de chaque catégorie.
function updateCounts() {
  for (const count of communesEl.querySelectorAll(".count")) {
    const { commune, categorie } = count.dataset;
    const noms = chantiers[commune][categorie];
    const total = noms.length;
    const finished = noms.reduce(
      (n, _, index) => n + (done.has(chantierId(commune, categorie, index)) ? 1 : 0),
      0
    );
    count.textContent = `${finished}/${total}`;
    count.classList.toggle("is-complete", finished === total && total > 0);
  }
}

// --- Démarrage ------------------------------------------------------------

async function start() {
  storage = await createStorage();
  try {
    done = await storage.load();
  } catch (error) {
    console.error("Impossible de charger l'état, démarrage à vide.", error);
    done = new Map();
  }
  render();

  // Synchronisation temps réel si le backend le supporte (mode partagé).
  storage.subscribe(async () => {
    try {
      done = await storage.load();
      render();
    } catch (error) {
      console.error("Échec de la synchronisation.", error);
    }
  });
}

if (isAuthenticated()) {
  showApp();
  start();
}
