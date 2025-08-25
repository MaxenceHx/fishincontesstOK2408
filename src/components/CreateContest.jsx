// src/pages/CreateContest.jsx
import React, { useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

export default function CreateContest({ user, onCreated, onCancel }) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  const toast = (type, message) =>
    window.dispatchEvent(new CustomEvent("app:toast", { detail: { type, message } }));

  const generateContestCode = useMemo(() => {
    return () => {
      const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
      let out = "";
      for (let i = 0; i < 6; i++) out += chars[Math.floor(Math.random() * chars.length)];
      return out;
    };
  }, []);

  const create = async () => {
    if (!user?.id) return;
    if (!name.trim()) {
      toast("error", "Indique un nom de concours.");
      return;
    }
    setSaving(true);
    try {
      const rules = {
        version: 3,
        moderation_enabled: false,
        scoring_mode: "total_points",
        window: { start_at: null, end_at: null },
        species_points: [],
      };
      const code = generateContestCode();

      const { data: contest, error: createErr } = await supabase
        .from("contests")
        .insert([{ name: name.trim(), created_by: user.id, code, rules, category: "custom" }])
        .select()
        .single();
      if (createErr) throw createErr;

      const { error: memErr } = await supabase
        .from("contest_members")
        .insert([{ contest_code: contest.code, user_id: user.id }]);
      if (memErr) throw memErr;

      toast("success", "Concours créé ✅");
      onCreated?.(contest);
    } catch (e) {
      console.error(e);
      toast("error", e.message || "Impossible de créer le concours.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="container" style={{ maxWidth: 640 }}>
      <div className="card">
        <h1 style={{ marginTop: 0 }}>Créer un concours</h1>
        <div className="grid" style={{ gap: 12 }}>
          <div>
            <label>Nom du concours</label>
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Open Carnassier 2025"
            />
          </div>
          <div className="btn-group" style={{ justifyContent: "flex-end" }}>
            <button className="btn btn-warning" onClick={onCancel}>Annuler</button>
            <button
              className={`btn btn-success ${saving ? "is-loading" : ""}`}
              onClick={create}
              disabled={saving}
            >
              Créer
            </button>
          </div>
        </div>
        <p className="kpi" style={{ marginTop: 12 }}>
          Les règles pourront être configurées ensuite dans la page <b>Configurer</b>.
        </p>
      </div>
    </div>
  );
}
