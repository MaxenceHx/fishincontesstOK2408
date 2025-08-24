// src/lib/supabase.js
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./env.js";

// ⚠️ sessionStorage = session par onglet (isole les tabs)
// En prod tu pourras repasser sur localStorage si tu veux persister entre onglets.
const storage = typeof window !== "undefined" ? window.sessionStorage : undefined;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    multiTab: false,              // pas de BroadcastChannel inter-onglets
    storage,                      // 👉 par onglet (pas partagé)
    storageKey: "fc_auth_dev_v1", // clé de session (namespace)
  },
});

console.log("SUPABASE_URL:", SUPABASE_URL ? "✅ OK" : "❌ MISSING");
console.log("SUPABASE_KEY:", SUPABASE_ANON_KEY ? "✅ OK" : "❌ MISSING");
