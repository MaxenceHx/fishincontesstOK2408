// src/pages/JoinContest.jsx
import React, { useState } from "react";
import { supabase } from "../lib/supabase";

export default function JoinContest({ user, onJoined, onCancel }) {
  const [byName, setByName] = useState("");
  const [byCode, setByCode] = useState("");
  const [busy, setBusy] = useState(false);

  const toast = (type, message) =>
    window.dispatchEvent(new CustomEvent("app:toast", { detail: { type, message } }));

  async function joinWithCode() {
    if (!user?.id) return;
    if (!byCode.trim()) {
      toast("error", "Entre le code du concours.");
      return;
    }
    setBusy(true);
    try {
      const code = byCode.trim().toUpperCase();
      const { data: contest, error } = await supabase
        .from("contests")
        .select("code, name")
        .eq("code", code)
        .single();
      if (error || !contest) throw new Error("Concours introuvable.");

      // Membre déjà ?
      const { data: exists } = await supabase
        .from("contest_members")
        .select("contest_code")
        .eq("contest_code", contest.code)
        .eq("user_id", user.id)
        .limit(1);
      if (!exists || exists.length === 0) {
        const { error: insErr } = await supabase
          .from("contest_members")
          .insert([{ contest_code: contest.code, user_id: user.id }]);
        if (insErr) throw insErr;
      }
      toast("success", `Rejoint : ${contest.name}`);
      onJoined?.(contest);
    } catch (e) {
      toast("error", e.message || "Impossible de rejoindre.");
    } finally {
      setBusy(false);
    }
  }

  async function joinWithName() {
    if (!user?.id) return;
    if (!byName.trim()) {
      toast("error", "Entre le nom du concours.");
      return;
    }
    setBusy(true);
    try {
      const { data: contest, error } = await supabase
        .from("contests")
        .select("code, name")
        .eq("name", byName.trim())
        .single();
      if (error || !contest) throw new Error("Concours introuvable.");

      const { data: exists } = await supabase
        .from("contest_members")
        .select("contest_code")
        .eq("contest_code", contest.code)
        .eq("user_id", user.id)
        .limit(1);
      if (!exists || exists.length === 0) {
        const { error: insErr } = await supabase
          .from("contest_members")
          .insert([{ contest_code: contest.code, user_id: user.id }]);
        if (insErr) throw insErr;
      }
      toast("success", `Rejoint : ${contest.name}`);
      onJoined?.(contest);
    } catch (e) {
      toast("error", e.message || "Impossible de rejoindre.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container" style={{ maxWidth: 640 }}>
      <div className="card">
        <h1 style={{ marginTop: 0 }}>Rejoindre un concours</h1>

        <div className="grid grid-2" style={{ gap: 16 }}>
          <div className="card" style={{ background: "#f8fafc", borderColor: "#e2e8f0" }}>
            <h3 style={{ marginTop: 0 }}>Par code</h3>
            <input
              className="input"
              placeholder="Ex: 4M2J9Q"
              value={byCode}
              onChange={(e) => setByCode(e.target.value)}
            />
            <div className="btn-group" style={{ marginTop: 8 }}>
              <button className={`btn btn-primary ${busy ? "is-loading" : ""}`} onClick={joinWithCode} disabled={busy}>
                Rejoindre
              </button>
            </div>
          </div>

          <div className="card" style={{ background: "#f8fafc", borderColor: "#e2e8f0" }}>
            <h3 style={{ marginTop: 0 }}>Par nom</h3>
            <input
              className="input"
              placeholder="Nom exact du concours"
              value={byName}
              onChange={(e) => setByName(e.target.value)}
            />
            <div className="btn-group" style={{ marginTop: 8 }}>
              <button className={`btn btn-outline ${busy ? "is-loading" : ""}`} onClick={joinWithName} disabled={busy}>
                Rejoindre
              </button>
            </div>
          </div>
        </div>

        <div className="btn-group" style={{ justifyContent: "flex-end", marginTop: 12 }}>
          <button className="btn btn-ghost" onClick={onCancel}>Annuler</button>
        </div>
      </div>
    </div>
  );
}
