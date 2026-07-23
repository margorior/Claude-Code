# ⚡ Gestion de Stock — matériel électrique

Application web complète pour gérer **deux stocks** de matériel, avec comptes utilisateurs à trois niveaux, alertes de stock bas, historique des mouvements, sauvegarde/restauration et mode application mobile (PWA).

**100 % gratuite à héberger** : le site est servi par **GitHub Pages**, les données et les comptes par **Supabase** (offre gratuite).

➡️ **Pour la mettre en ligne : suivez [INSTALLATION.md](INSTALLATION.md)** (~10 minutes, aucune compétence technique requise).

## ✨ Fonctionnalités

- **3 niveaux d'accès**
  - 👑 **Administrateur** : tout faire — valider les inscriptions, gérer les rôles, les paramètres, les sauvegardes
  - 🔧 **Gestionnaire** : gérer le stock (produits, catégories, zones)
  - 👁️ **Lecteur** : consultation seule
- **Inscription protégée** : un mot de passe d'accès (défini par l'admin) est demandé pour créer un compte, puis l'admin valide chaque compte dans l'onglet *Utilisateurs* — le tout premier compte créé devient automatiquement administrateur
- **Produits** : photo, nom, unité (pièce, mètre, …), quantité, catégorie, zone de rangement, stock 1 ou 2, seuil d'alerte, code-barres
- **Boutons + / −** pour prendre ou remettre du matériel en deux clics
- **Recherche** par nom ou code-barres, **filtres** par stock / catégorie / zone, **tri**, pagination
- **Onglet Alertes** : produits sous leur seuil, avec badge dans le menu
- **Catégories & zones** entièrement modifiables
- **Historique** : qui a pris/remis quoi, quand
- **Sauvegarde complète** (ZIP : données + photos) téléchargeable et restaurable — pratique pour migrer
- **Export Excel/CSV** de l'inventaire
- **PWA** : installable sur téléphone, **scan de code-barres** avec la caméra
- Conçu pour tenir **des milliers de références** sans ralentir

## 🔧 Architecture

```
client/            Interface React + Vite + Tailwind (site statique)
  src/config.js    ← les 2 seules valeurs à remplir (URL + clé Supabase)
supabase/
  schema.sql       Base de données complète : tables, règles de sécurité
                   par rôle (RLS), fonctions (ajustements, restauration…)
.github/workflows/ Déploiement automatique sur GitHub Pages à chaque commit
```

- La sécurité des rôles est appliquée **côté Supabase** (Row Level Security) : même en bidouillant le site, un lecteur ne peut pas modifier le stock et un compte non validé n'a accès à rien.
- Les mots de passe sont gérés par Supabase Auth ; le site ne stocke aucun secret.

## 💻 Développement en local

```bash
cd client
npm install
npm run dev        # http://localhost:5173
```

Remplissez d'abord `client/src/config.js` avec les valeurs de votre projet Supabase (voir [INSTALLATION.md](INSTALLATION.md)).

> ℹ️ Une ancienne version autonome (serveur Node.js + SQLite, sans Supabase) existe dans l'historique git si vous préférez un jour héberger vous-même sur votre propre machine.
