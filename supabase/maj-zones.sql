-- ============================================================================
-- MISE À JOUR PONCTUELLE DES ZONES — à coller dans Supabase → SQL Editor → Run
-- Remplace les zones d'exemple (Étagère A, Étagère B, Réserve)
-- par les lettres A à Z.
-- Les produits qui utilisaient une zone supprimée se retrouvent « sans zone »
-- (ils ne sont pas supprimés).
-- ============================================================================

delete from public.zones where name in ('Étagère A', 'Étagère B', 'Réserve');

insert into public.zones (name)
  select chr(64 + g) from generate_series(1, 26) as g
on conflict (name) do nothing;
