// src/pages/ProfilePage.jsx
import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export default function ProfilePage({ user }) {
  const [email, setEmail] = useState(user?.email || "");
  const [username, setUsername] = useState("");
  const [initialUsername, setInitialUsername] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
  
    const loadProfile = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("email, username")
          .eq("id", user.id)
          .single();
  
        if (cancelled) return;
  
        if (error && error.code !== "PGRST116") {
          // 116 = no rows; on ne considère pas ça bloquant
          console.error("Profile load error:", error);
        }
  
        if (data) {
          setEmail(data.email ?? user.email ?? "");
          setUsername(data.username ?? "");
          setInitialUsername(data.username ?? null);
        } else {
          // pas de ligne → on affiche quand même le formulaire (username vide)
          setEmail(user.email ?? "");
          setUsername("");
          setInitialUsername(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
  
    loadProfile();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);
  

  const checkAvailable = async (name) => {
    if (!name) return false;
    const { data, error } = await supabase
      .from("profiles")
      .select("id")
      .eq("username", name)
      .limit(1);

    if (error) return false;
    return (data?.length || 0) === 0;
  };

  const saveUsername = async () => {
    setMessage("");
    const name = username.trim();

    if (!name) {
      setMessage("Choisis un pseudo.");
      return;
    }
    if (initialUsername) {
      setMessage("Le pseudo a déjà été défini et ne peut pas être modifié.");
      return;
    }

    setSaving(true);

    // Vérif disponibilité avant UPDATE
    const available = await checkAvailable(name);
    if (!available) {
      setSaving(false);
      setMessage("Ce pseudo est déjà pris.");
      return;
    }

    const { error } = await supabase
      .from("profiles")
      .update({ username: name })
      .eq("id", user.id);

    setSaving(false);

    if (error) {
      if (error.code === "23505") {
        setMessage("Ce pseudo est déjà pris.");
      } else if (error.message?.includes("cannot be changed")) {
        setMessage("Le pseudo ne peut plus être modifié.");
      } else {
        console.error("Erreur sauvegarde pseudo:", error);
        setMessage("Impossible d’enregistrer le pseudo.");
      }
    } else {
      setInitialUsername(name);
      setMessage("Pseudo enregistré ✅");
    }
  };

  if (loading) return <p>Chargement…</p>;

  return (
    <div className="app-container" style={{ padding: 20 }}>
      <h1>Profil</h1>

      <div
        style={{
          marginTop: 16,
          background: "#fff",
          padding: 16,
          borderRadius: 10,
          boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
          display: "grid",
          gap: 12,
          maxWidth: 520,
        }}
      >
        <div>
          <label style={{ display: "block", fontWeight: 600, marginBottom: 6 }}>
            Email
          </label>
          <input
            value={email}
            readOnly
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 8,
              border: "1px solid #ccc",
              background: "#f5f5f5",
            }}
          />
        </div>

        <div>
          <label style={{ display: "block", fontWeight: 600, marginBottom: 6 }}>
            Pseudo {initialUsername ? "(défini — non modifiable)" : ""}
          </label>
          <div style={{ display: "flex", gap: 10 }}>
            <input
              placeholder="Ex: BigFisher42"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={!!initialUsername}
              style={{
                flex: 1,
                padding: "10px 12px",
                borderRadius: 8,
                border: "1px solid #ccc",
                background: initialUsername ? "#f5f5f5" : "#fff",
              }}
            />
            {!initialUsername && (
              <button
                onClick={saveUsername}
                disabled={saving}
                style={{
                  padding: "10px 12px",
                  borderRadius: 8,
                  border: "none",
                  background: "#007bff",
                  color: "#fff",
                  fontWeight: 600,
                  cursor: "pointer",
                  opacity: saving ? 0.7 : 1,
                }}
              >
                {saving ? "Enregistrement..." : "Enregistrer"}
              </button>
            )}
          </div>
        </div>

        {!!message && (
          <div style={{ color: message.includes("✅") ? "#22c55e" : "#d00" }}>
            {message}
          </div>
        )}
      </div>
    </div>
  );
}
