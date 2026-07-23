# ⚡ Gestion de Stock — matériel électrique

Application web complète pour gérer **deux stocks** de matériel, avec comptes utilisateurs à trois niveaux, alertes de stock bas, historique des mouvements, sauvegarde/restauration et mode application mobile (PWA).

## ✨ Fonctionnalités

- **3 niveaux d'accès**
  - 👑 **Administrateur** : tout faire — valider les inscriptions, gérer les rôles, les paramètres, les sauvegardes
  - 🔧 **Gestionnaire** : gérer le stock (ajouter/modifier/supprimer des produits, catégories, zones)
  - 👁️ **Lecteur** : consultation seule
- **Inscription protégée** : un mot de passe d'accès (défini par l'admin) est demandé pour créer un compte, puis l'admin valide chaque compte dans l'onglet *Utilisateurs*
- **Produits** : photo, nom, unité (pièce, mètre, …), quantité, catégorie, zone de rangement, stock 1 ou 2, seuil d'alerte, code-barres
- **Boutons + / −** pour prendre ou remettre du matériel en deux clics
- **Recherche** par nom ou code-barres, **filtres** par stock / catégorie / zone, **tri** par nom, quantité, etc.
- **Onglet Alertes** : tous les produits sous leur seuil, avec badge dans le menu
- **Catégories & zones** entièrement modifiables
- **Historique** : qui a pris/remis quoi, quand
- **Sauvegarde complète** (ZIP : données + photos) téléchargeable et **restaurable sur un autre serveur**
- **Export Excel/CSV** de l'inventaire
- **PWA** : installable sur téléphone, **scan de code-barres** avec la caméra
- Conçu pour tenir **des milliers de références** sans ralentir (pagination + index SQLite)

## 🚀 Installation

Prérequis : [Node.js](https://nodejs.org) 18 ou plus récent.

```bash
npm run setup    # installe tout et compile l'interface (à faire une seule fois)
npm start        # démarre l'application
```

Puis ouvrez **http://localhost:3000**

> Pour changer le port : `PORT=8080 npm start`

### Première connexion

| | |
|---|---|
| Utilisateur | `admin` |
| Mot de passe | `admin123` |
| Mot de passe d'accès à l'inscription | `bienvenue` |

⚠️ **Changez ces deux mots de passe immédiatement** dans *Paramètres* après la première connexion.

### Avec Docker (optionnel)

```bash
docker build -t gestion-stock .
docker run -d -p 3000:3000 -v stock-data:/app/data --name stock gestion-stock
```

## 💾 Vos données & migration de serveur

Toutes les données (base, photos, clé de session) vivent dans le dossier **`data/`**.

Deux façons de migrer vers un autre serveur :

1. **Copier le dossier `data/`** vers la nouvelle installation, ou
2. *Paramètres → Télécharger la sauvegarde* sur l'ancien serveur, puis *Importer une sauvegarde* sur le nouveau.

Pensez à télécharger une sauvegarde régulièrement : c'est votre assurance.

## 📱 Utilisation sur téléphone

Ouvrez l'application dans le navigateur du téléphone, puis « Ajouter à l'écran d'accueil » : elle s'installe comme une vraie application.

> Le scan de code-barres nécessite un accès caméra, qui n'est autorisé par les navigateurs qu'en **HTTPS** (ou sur `localhost`). Si vous hébergez l'appli sur un serveur, mettez-la derrière un reverse-proxy HTTPS (Caddy le fait automatiquement, par exemple).

## 🛠️ Technique

- **Backend** : Node.js + Express + SQLite (`better-sqlite3`) — aucune base de données à installer
- **Frontend** : React + Vite + Tailwind CSS
- **Auth** : sessions JWT en cookie httpOnly, mots de passe hachés (bcrypt)

```
server/    API Express (auth, produits, catégories, zones, utilisateurs, sauvegardes)
client/    Interface React (compilée dans client/dist, servie par le serveur)
data/      Vos données (créé au premier lancement — jamais dans git)
```
