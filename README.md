# Suivi des chantiers

Petite application web pour suivre l'état des chantiers (terminés ou non),
organisés par **Commune → Catégorie → Chantier**.

- Interface propre et responsive (mobile, tablette, ordinateur)
- Accès protégé par mot de passe
- Cases à cocher : une ligne validée devient verte et affiche un ✓
- Décoche sécurisée (confirmation obligatoire)
- Sauvegarde automatique
- Aucune dépendance, aucun build : du HTML/CSS/JavaScript pur

## Lancer l'application

### En local

Un simple serveur statique suffit (les modules JavaScript exigent `http://`,
pas d'ouverture directe du fichier) :

```bash
python3 -m http.server 8000
# puis ouvrir http://localhost:8000
```

### En ligne, gratuitement (GitHub Pages)

1. Dépôt GitHub → **Settings → Pages**
2. **Source** : branche à publier, dossier `/ (root)`
3. L'application est en ligne à l'adresse indiquée par GitHub Pages.

## Configuration

Tout se règle dans **`js/config.js`**.

### Changer le mot de passe

```js
password: "chantiers2026",   // remplacez par le mot de passe souhaité
```

> Protection volontairement simple, côté navigateur : elle empêche un accès
> accidentel, ce n'est pas une sécurité de niveau bancaire.

## Modifier les chantiers

Toutes les données sont dans **`js/data.js`**, sous la forme
`Commune → Catégorie → liste de chantiers`. Il suffit d'éditer cet objet.

### Ajouter un chantier

Ajoutez une entrée dans la liste de la catégorie voulue :

```js
École: [
  "IT École Plateau",
  "IT École Plateau Préscolaire",
  "IT École Plateau Vieille",
  "IT Nouveau chantier",        // ← nouvelle ligne
],
```

### Ajouter une catégorie

Ajoutez une nouvelle clé dans la commune, avec sa liste de chantiers :

```js
Itzig: {
  Logement: ["IT rue de l'Orphelinat"],
  École: [ /* ... */ ],
  Divers: [ /* ... */ ],
  Voirie: ["IT Nouvelle rue"],   // ← nouvelle catégorie
},
```

### Ajouter une commune

Ajoutez une nouvelle clé de premier niveau :

```js
export const chantiers = {
  Itzig: { /* ... */ },
  // ...
  Roeser: {                       // ← nouvelle commune
    Logement: ["RO Résidence du Parc"],
    Divers: ["RO Cimetière"],
  },
};
```

L'affichage (titres, cartes, compteurs) se met à jour automatiquement.

> Astuce : l'état « terminé » est mémorisé par la position d'un chantier dans
> sa liste. Ajouter des chantiers **à la fin** d'une liste ne dérange aucune
> validation existante. Réordonner ou supprimer des lignes existantes peut en
> revanche décaler les états déjà enregistrés.

## Sauvegarde : local ou partagé

Réglé par le champ `storage` de `js/config.js`.

### `"local"` (par défaut)

Aucune configuration. L'état est mémorisé dans le navigateur
(`localStorage`) : idéal pour un usage simple, mais **propre à chaque
appareil** (les validations ne sont pas partagées entre plusieurs personnes).

### `"supabase"` (partagé entre tous les utilisateurs, gratuit)

Pour que **tout le monde voie le même état en temps réel**, activez Supabase
(offre gratuite largement suffisante) :

1. Créez un projet sur [supabase.com](https://supabase.com).
2. Dans **SQL Editor**, créez la table :

   ```sql
   create table chantiers_status (
     id text primary key,
     done boolean not null default false
   );
   alter table chantiers_status enable row level security;

   -- Accès simple en lecture/écriture via la clé publique (anon).
   create policy "lecture publique" on chantiers_status
     for select using (true);
   create policy "écriture publique" on chantiers_status
     for insert with check (true);
   create policy "mise à jour publique" on chantiers_status
     for update using (true);
   ```

3. Dans **Database → Replication**, activez le temps réel sur la table
   `chantiers_status` (facultatif, pour la synchronisation instantanée).
4. Dans `js/config.js`, renseignez :

   ```js
   storage: "supabase",
   supabase: {
     url: "https://VOTRE-PROJET.supabase.co",
     anonKey: "VOTRE_CLE_ANON",
     table: "chantiers_status",
   },
   ```

En cas d'indisponibilité de Supabase, l'application bascule automatiquement
sur le stockage local pour rester utilisable.

## Structure du projet

```
index.html          Structure de la page (connexion, application, dialogue)
css/styles.css      Styles (design sobre, responsive)
js/config.js        Mot de passe et mode de stockage
js/data.js          Données des chantiers (à éditer)
js/auth.js          Protection par mot de passe
js/storage.js       Couche de stockage (local / Supabase)
js/app.js           Affichage et interactions
```
