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
    multiTab: true, // meilleure stabilité si l'user ouvre plusieurs vues
    storage: typeof window !== "undefined" ? window.localStorage : undefined,
    storageKey: "fc_auth_v1", // 👈 garde cette clé partout (web + mobile)
  },
});

// Keep-alive léger pour forcer un refresh si nécessaire (toutes les 5 min)
let _keepAliveTimer;
export function startAuthKeepAlive() {
  clearInterval(_keepAliveTimer);
  _keepAliveTimer = setInterval(() => {
    supabase.auth.getSession().catch(() => {});
  }, 5 * 60 * 1000);
}

console.log("SUPABASE_URL:", SUPABASE_URL ? "✅ OK" : "❌ MISSING");
console.log("SUPABASE_KEY:", SUPABASE_ANON_KEY ? "✅ OK" : "❌ MISSING");
