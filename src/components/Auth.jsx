// src/components/Auth.jsx
import React, { useState } from "react";
import { supabase } from "../lib/supabase";

export default function Auth({ onLogin }) {
  const [mode, setMode] = useState("password"); // 'password' | 'magic'
  const [isSignup, setIsSignup] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [desiredUsername, setDesiredUsername] = useState("");

  const [busy, setBusy] = useState(false);

  const toast = (type, message) =>
    window.dispatchEvent(new CustomEvent("app:toast", { detail: { type, message } }));

  async function handleSubmit(e) {
    e.preventDefault();
    if (!email.trim()) {
      toast("error", "Entre ton email.");
      return;
    }
    setBusy(true);
    try {
      if (mode === "magic") {
        const { error } = await supabase.auth.signInWithOtp({
          email: email.trim(),
          options: { emailRedirectTo: window.location.origin + "/" },
        });
        if (error) throw error;
        toast("success", "Lien magique envoyé ✉️. Vérifie ta boîte mail.");
        return;
      }

      // mode password
      if (isSignup) {
        if (!password) {
          toast("error", "Choisis un mot de passe.");
          return;
        }
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { desired_username: desiredUsername || null },
            emailRedirectTo: window.location.origin + "/",
          },
        });
        if (error) throw error;
        if (data.session) {
          toast("success", "Compte créé ✅");
          onLogin?.(data.session.user);
        } else {
          toast("success", "Inscription réussie. Confirme l’email pour te connecter.");
        }
        return;
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
        toast("success", "Connexion réussie ✅");
        onLogin?.(data.user);
      }
    } catch (e) {
      console.error(e);
      toast("error", e.message || "Échec de l’authentification.");
    } finally {
      setBusy(false);
    }
  }

  async function handleReset() {
    if (!email.trim()) {
      toast("error", "Entre ton email d’abord.");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: window.location.origin + "/",
      });
      if (error) throw error;
      toast("success", "Email de réinitialisation envoyé ✉️");
    } catch (e) {
      toast("error", e.message || "Impossible d’envoyer l’email.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container" style={{ maxWidth: 520 }}>
      <div className="card">
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <span className="badge" style={{ background: "#dbeafe", color: "#1e3a8a" }}>🎣</span>
          <h1 style={{ margin: 0 }}>FishingContest</h1>
        </div>

        {/* Tabs */}
        <div className="btn-group" style={{ marginBottom: 12 }}>
          <button
            className={`btn ${mode === "password" ? "btn-soft" : "btn-ghost"}`}
            onClick={() => setMode("password")}
          >
            Email + mot de passe
          </button>
          <button
            className={`btn ${mode === "magic" ? "btn-soft" : "btn-ghost"}`}
            onClick={() => setMode("magic")}
          >
            Lien magique
          </button>
        </div>

        <form onSubmit={handleSubmit} className="grid" style={{ gap: 12 }}>
          <div>
            <label>Email</label>
            <input
              className="input"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ton@email.com"
            />
          </div>

          {mode === "password" && (
            <>
              {isSignup && (
                <div>
                  <label>Nom d’utilisateur (optionnel)</label>
                  <input
                    className="input"
                    value={desiredUsername}
                    onChange={(e) => setDesiredUsername(e.target.value)}
                    placeholder="pseudo"
                  />
                </div>
              )}
              <div>
                <label>Mot de passe</label>
                <input
                  className="input"
                  type="password"
                  autoComplete={isSignup ? "new-password" : "current-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </div>

              <div className="btn-group" style={{ justifyContent: "space-between" }}>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setIsSignup((v) => !v)}
                >
                  {isSignup ? "J’ai déjà un compte" : "Créer un compte"}
                </button>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={handleReset}
                  disabled={busy}
                >
                  Mot de passe oublié ?
                </button>
              </div>
            </>
          )}

          <div className="btn-group" style={{ justifyContent: "flex-end" }}>
            <button
              className={`btn btn-primary ${busy ? "is-loading" : ""}`}
              disabled={busy}
              type="submit"
            >
              {mode === "magic"
                ? "Envoyer le lien"
                : isSignup
                ? "Créer le compte"
                : "Se connecter"}
            </button>
          </div>
        </form>
      </div>

      <p className="kpi" style={{ textAlign: "center", marginTop: 12 }}>
        En te connectant, tu acceptes notre fonctionnement. Aucune donnée sensible n’est collectée.
      </p>
    </div>
  );
}
