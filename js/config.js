// Configuration de l'application.
// Modifiez ce fichier pour changer le mot de passe ou activer le stockage partagé.

export const config = {
  // Mot de passe d'accès. Changez simplement cette valeur.
  password: "1234",

  // Mode de stockage :
  //   "local"    -> propre à chaque navigateur (aucune configuration, marche tout de suite)
  //   "supabase" -> partagé entre tous les utilisateurs (nécessite les clés ci-dessous)
  storage: "supabase",

  // À renseigner uniquement si storage vaut "supabase".
  // Voir le README pour la création (gratuite) du projet et de la table.
  supabase: {
    url: "https://plbboyfzjtyuxcxdiaqb.supabase.co",
    anonKey: "sb_publishable_FIkziFCMcPgwiTvbj-qQhQ_Lw6xUyRB",
    table: "chantiers_status",
  },
};
