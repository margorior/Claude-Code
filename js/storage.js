// Couche de stockage enfichable.
// Expose une interface commune, quel que soit le backend choisi dans config.js :
//   load()                -> Promise<Set<string>>  (ids des chantiers terminés)
//   setCompleted(id, done)-> Promise<void>
//   subscribe(onChange)   -> écoute les changements distants (temps réel, si dispo)

import { config } from "./config.js";

const LOCAL_KEY = "chantiers-status";

function localAdapter() {
  const read = () => {
    const raw = localStorage.getItem(LOCAL_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  };

  return {
    async load() {
      return read();
    },
    async setCompleted(id, done) {
      const set = read();
      done ? set.add(id) : set.delete(id);
      localStorage.setItem(LOCAL_KEY, JSON.stringify([...set]));
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
      const { data, error } = await client
        .from(table)
        .select("id")
        .eq("done", true);
      if (error) throw error;
      return new Set(data.map((row) => row.id));
    },
    async setCompleted(id, done) {
      const { error } = await client.from(table).upsert({ id, done });
      if (error) throw error;
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
