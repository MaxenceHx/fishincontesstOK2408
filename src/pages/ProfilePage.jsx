// src/pages/ProfilePage.jsx
import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export default function ProfilePage({ user }) {
  const [profile, setProfile] = useState(null);
  const [username, setUsername] = useState("");
  const [saving, setSaving] = useState(false);

  const toast = (type, message) =>
    window.dispatchEvent(new CustomEvent("app:toast", { detail: { type, message } }));

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("username, email")
        .eq("id", user.id)
        .single();
      if (!cancelled) {
        setProfile(data || null);
        setUsername(data?.username || "");
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  async function save() {
    setSaving(true);
    try {
      const clean = username.trim() || null;
      const { error } = await supabase
        .from("profiles")
        .update({ username: clean })
        .eq("id", user.id);
      if (error) throw error;
      toast("success", "Profil mis à jour ✅");
      setProfile((p) => (p ? { ...p, username: clean } : p));
    } catch (e) {
      toast("error", e.message || "Impossible de mettre à jour.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid" style={{ gap: 12, maxWidth: 640 }}>
      <div className="card">
        <h1 style={{ marginTop: 0 }}>Profil</h1>
        <div className="grid" style={{ gap: 12 }}>
          <div>
            <label>Email</label>
            <input className="input" value={profile?.email || user?.email || ""} readOnly />
          </div>
          <div>
            <label>Nom d’utilisateur</label>
            <input
              className="input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Ton pseudo"
            />
          </div>
          <div className="btn-group" style={{ justifyContent: "flex-end" }}>
            <button
              className={`btn btn-success ${saving ? "is-loading" : ""}`}
              onClick={save}
              disabled={saving}
            >
              Enregistrer
            </button>
          </div>
        </div>
      </div>

      {/* Stats rapides */}
      <UserQuickStats userId={user.id} />
    </div>
  );
}

function UserQuickStats({ userId }) {
  const [stats, setStats] = useState({ count: 0, points: 0, max: null, avg: null });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("catches")
        .select("points, size_cm")
        .eq("user_id", userId)
        .eq("status", "approved");

      const rows = data || [];
      let count = 0, points = 0, max = null, sum = 0, n = 0;
      for (const r of rows) {
        count += 1;
        points += Number(r.points || 0);
        const s = r.size_cm == null ? null : Number(r.size_cm);
        if (s != null && !Number.isNaN(s)) {
          max = max == null ? s : Math.max(max, s);
          sum += s; n += 1;
        }
      }
      const avg = n > 0 ? sum / n : null;
      if (!cancelled) setStats({ count, points, max, avg });
    })();
    return () => { cancelled = true; };
  }, [userId]);

  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>Mes stats</h2>
      <div className="grid grid-2">
        <div className="kpi">Prises approuvées : <strong>{stats.count}</strong></div>
        <div className="kpi">Total points : <strong>{stats.points}</strong></div>
        <div className="kpi">Taille max : <strong>{stats.max != null ? stats.max.toFixed(1) + " cm" : "-"}</strong></div>
        <div className="kpi">Taille moyenne : <strong>{stats.avg != null ? stats.avg.toFixed(1) + " cm" : "-"}</strong></div>
      </div>
    </div>
  );
}
