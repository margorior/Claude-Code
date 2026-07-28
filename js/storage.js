// Couche de stockage enfichable.
// Expose une interface commune, quel que soit le backend choisi dans config.js :
//   load()                        -> Promise<Map<string, string|null>>
//                                    (id des chantiers terminés -> date ISO de validation, ou null)
//   setCompleted(id, done, when)  -> Promise<void>
//   subscribe(onChange)           -> écoute les changements distants (temps réel, si dispo)

import { config } from "./config.js";

const LOCAL_KEY = "chantiers-status";

function localAdapter() {
  const read = () => {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return new Map();
    const parsed = JSON.parse(raw);
    // Ancien format : simple tableau d'ids, sans dates.
    if (Array.isArray(parsed)) return new Map(parsed.map((id) => [id, null]));
    return new Map(Object.entries(parsed));
  };

  return {
    async load() {
      return read();
    },
    async setCompleted(id, done, when) {
      const map = read();
      done ? map.set(id, when) : map.delete(id);
      localStorage.setItem(LOCAL_KEY, JSON.stringify(Object.fromEntries(map)));
    },
    subscribe() {
      // Pas de temps réel en mode local (état propre à chaque navigateur).
    },
  };
}

async function supabaseAdapter() {
  const { createClient } = await import(
    "https://esm.sh/@supabase/supabase-js@2"
  );
  const client = createClient(config.supabase.url, config.supabase.anonKey);
  const table = config.supabase.table;

  return {
    async load() {
      let { data, error } = await client
        .from(table)
        .select("id, done_at")
        .eq("done", true);
      if (error) {
        // Base sans la colonne done_at (créée avant l'ajout des dates).
        ({ data, error } = await client.from(table).select("id").eq("done", true));
        if (error) throw error;
      }
      return new Map(data.map((row) => [row.id, row.done_at ?? null]));
    },
    async setCompleted(id, done, when) {
      let { error } = await client
        .from(table)
        .upsert({ id, done, done_at: done ? when : null });
      if (error) {
        // Base sans la colonne done_at : on sauvegarde au moins l'état coché.
        ({ error } = await client.from(table).upsert({ id, done }));
        if (error) throw error;
      }
    },
    subscribe(onChange) {
      client
        .channel("chantiers")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table },
          onChange
        )
        .subscribe();
    },
  };
}

export async function createStorage() {
  const { storage, supabase } = config;
  if (storage === "supabase" && supabase.url && supabase.anonKey) {
    try {
      return await supabaseAdapter();
    } catch (error) {
      console.error(
        "Stockage Supabase indisponible, repli sur le stockage local.",
        error
      );
    }
  }
  return localAdapter();
}
