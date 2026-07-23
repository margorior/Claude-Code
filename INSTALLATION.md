# 🚀 Mise en ligne — guide pas-à-pas (~10 minutes)

L'application fonctionne avec **deux services gratuits** :

- **Supabase** → héberge la base de données, les comptes utilisateurs et les photos
- **GitHub Pages** → héberge le site (déjà lié à ce dépôt, rien à installer)

Il n'y a **rien à payer** et **aucun serveur à entretenir**. Suivez les étapes dans l'ordre.

---

## Étape 1 — Créer le projet Supabase (~3 min)

1. Allez sur **https://supabase.com** → *Start your project* → créez un compte (gratuit, possible avec votre compte GitHub).
2. Cliquez **New project** :
   - *Name* : `gestion-stock` (ou ce que vous voulez)
   - *Database Password* : choisissez-en un et notez-le (il ne sert que pour l'administration Supabase)
   - *Region* : choisissez **Europe (Paris ou Francfort)**
3. Attendez ~1 minute que le projet soit prêt.

## Étape 2 — Installer la base de données (~2 min)

1. Dans le menu de gauche de Supabase, ouvrez **SQL Editor**.
2. Ouvrez le fichier [`supabase/schema.sql`](supabase/schema.sql) de ce dépôt, copiez **tout** son contenu.
3. Collez-le dans l'éditeur SQL et cliquez **Run**.
4. Vous devez voir *Success. No rows returned* (les messages "NOTICE … skipping" sont normaux).

## Étape 3 — Autoriser la connexion par identifiant (~1 min)

L'application utilise des **noms d'utilisateur simples** (pas de vraies adresses email), il faut donc désactiver la confirmation par email :

1. Menu **Authentication** → **Sign In / Providers** (ou *Providers* selon la version).
2. Cliquez sur **Email**.
3. **Décochez « Confirm email »** et enregistrez.

## Étape 4 — Relier le site à votre base (~2 min)

1. Dans Supabase : **Project Settings** (roue dentée) → **API** (ou *Data API*). Copiez :
   - la **Project URL** (ressemble à `https://xxxx.supabase.co`)
   - la clé **anon public** (longue suite de caractères — selon la version elle s'appelle *anon key* ou *publishable key*)
2. Sur GitHub, ouvrez le fichier **`client/src/config.js`** de ce dépôt → cliquez le **crayon** (Edit) :
   - remplacez le premier `REMPLACEZ-MOI` par la Project URL
   - remplacez le second par la clé anon
3. Cliquez **Commit changes**.

> 🔓 Cette clé « anon » est faite pour être publique : toute la sécurité (rôles, validation des comptes) est appliquée par les règles installées à l'étape 2.

## Étape 5 — Activer GitHub Pages (~1 min)

1. Sur GitHub : **Settings** (du dépôt) → **Pages**.
2. Sous *Build and deployment* → **Source** : choisissez **GitHub Actions**.
3. Allez dans l'onglet **Actions** → workflow **« Déployer sur GitHub Pages »** → s'il n'est pas déjà en train de tourner (déclenché par votre commit de l'étape 4), cliquez **Run workflow**.
4. Après ~1 minute, l'adresse de votre site apparaît dans le workflow (généralement `https://<votre-nom>.github.io/<nom-du-depot>/`).

## Étape 6 — Créer votre compte administrateur (~1 min)

1. Ouvrez votre site → onglet **Créer un compte**.
2. Mot de passe d'accès : **`bienvenue`** (celui installé par défaut à l'étape 2).
3. ⭐ **Le tout premier compte créé devient automatiquement administrateur.** Connectez-vous.
4. Allez immédiatement dans **Paramètres** et **changez le mot de passe d'accès à l'inscription**.

Ensuite, les autres personnes créent leur compte de la même façon, et vous les validez dans l'onglet **Utilisateurs** (elles arrivent en « Lecteur », vous choisissez leur rôle).

---

## 📱 Installer sur téléphone

Ouvrez le site dans le navigateur du téléphone → menu → **« Ajouter à l'écran d'accueil »**. L'appli s'installe avec son icône, et le scan de code-barres fonctionne (le site est en HTTPS).

## 💾 Sauvegardes & migration

- **Paramètres → Télécharger la sauvegarde** : fichier ZIP contenant produits, catégories, zones, historique, paramètres **et photos**. Faites-le régulièrement.
- Pour **changer de serveur** (nouveau projet Supabase, ou n'importe quel hébergeur) : refaites les étapes 1 à 4 sur le nouveau projet, créez votre compte admin, puis **Importer une sauvegarde**.
- Les **comptes utilisateurs** sont gérés par Supabase et ne sont pas inclus dans la sauvegarde : sur un nouveau projet, chacun recrée son compte (2 minutes) et vous les revalidez.

## ❓ Limites du gratuit (largement suffisantes ici)

Supabase gratuit : 500 Mo de base de données, 1 Go de photos, 50 000 utilisateurs actifs/mois — soit des dizaines de milliers de références. Seule contrainte : un projet inactif pendant 7 jours est mis en pause ; il se réactive en un clic dans le tableau de bord Supabase (et un usage régulier l'empêche de se mettre en pause).

## 🆘 Problèmes fréquents

| Symptôme | Cause / solution |
|---|---|
| Écran « Configuration requise » | `client/src/config.js` pas rempli, ou le déploiement de l'étape 5 n'a pas tourné après votre commit |
| « Compte non confirmé » à la connexion | Étape 3 oubliée : décochez *Confirm email* dans Supabase |
| Page blanche après mise à jour | Rechargez en vidant le cache (Ctrl+Maj+R) |
| « Votre compte est en attente de validation » | Normal : un admin doit accepter le compte dans l'onglet Utilisateurs |
