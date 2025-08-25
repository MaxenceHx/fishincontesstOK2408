// src/pages/ContestConfig.jsx
import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

/**
 * Structure des règles (version 5)
 * rules = {
 *   version: 5,
 *   window: { start_at, end_at },
 *   moderation_enabled: boolean,
 *   // Choix global :
 *   kind: "official" | "custom",
 *
 *   // OFFICIAL
 *   mode: "carnassier" | "carp" | "coup" | "expert",
 *   scoring_mode: "total_points" | "count" | "biggest_fish", // pour carnassier
 *   species_points: [{name, points}], // pour carnassier
 *   carp: { min_weight_kg?: number },
 *   coup: { method: "weight" | "count", unit?: "g" }, // unit utilisé si weight
 *   expert: { weights: { carnassier: number, carp: number, coup: number } },
 *
 *   // CUSTOM
 *   custom?: {
 *     metric: "points" | "weight" | "count" | "biggest",
 *     weight_unit?: "g" | "kg",
 *     species_points?: [{name, points}] // si metric=points
 *   }
 * }
 */

const PRESETS = {
  carnassier: {
    species_points: [
      { name: "Brochet", points: 1000 },
      { name: "Sandre", points: 800 },
      { name: "Perche", points: 400 },
      { name: "Black-bass", points: 600 },
      { name: "Silure", points: 1200 },
    ],
    scoring_mode: "total_points",
  },
  carp: {
    carp: { min_weight_kg: 0 },
  },
  coup: {
    coup: { method: "weight", unit: "g" }, // par défaut au poids en grammes
  },
  expert: {
    species_points: [
      { name: "Brochet", points: 1000 },
      { name: "Sandre", points: 800 },
      { name: "Perche", points: 400 },
    ],
    scoring_mode: "total_points",
    expert: { weights: { carnassier: 1, carp: 1, coup: 1 } },
    coup: { method: "weight", unit: "g" },
  },
};

export default function ContestConfig({ user, draftName, onCancel, onCreated }) {
  // Sélecteur global : officiel vs personnalisé
  const [kind, setKind] = useState("official"); // "official" | "custom"

  // Commun
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [moderationEnabled, setModerationEnabled] = useState(false);

  // ---- OFFICIAL ----
  const [mode, setMode] = useState("carnassier"); // carnassier|carp|coup|expert
  const [carnassierScoring, setCarnassierScoring] = useState("total_points");
  const [species, setSpecies] = useState([{ name: "", points: "" }]);
  const [carpMinKg, setCarpMinKg] = useState(0);
  const [coupMethod, setCoupMethod] = useState("weight"); // "weight" | "count"
  const [expertWeights, setExpertWeights] = useState({ carnassier: 1, carp: 1, coup: 1 });

  // ---- CUSTOM ----
  const [customMetric, setCustomMetric] = useState("points"); // points|weight|count|biggest
  const [customWeightUnit, setCustomWeightUnit] = useState("g"); // g|kg
  const [customSpecies, setCustomSpecies] = useState([{ name: "", points: "" }]);

  // Chargement de presets quand le mode change (OFFICIAL)
  useEffect(() => {
    if (kind !== "official") return;
    const p = PRESETS[mode] || {};
    if (mode === "carnassier") {
      setCarnassierScoring(p.scoring_mode || "total_points");
      setSpecies(p.species_points || [{ name: "", points: "" }]);
    }
    if (mode === "carp") {
      setCarpMinKg(p.carp?.min_weight_kg ?? 0);
    }
    if (mode === "coup") {
      setCoupMethod(p.coup?.method || "weight");
    }
    if (mode === "expert") {
      setCarnassierScoring(p.scoring_mode || "total_points");
      setSpecies(p.species_points || [{ name: "", points: "" }]);
      setExpertWeights(p.expert?.weights || { carnassier: 1, carp: 1, coup: 1 });
      setCoupMethod(p.coup?.method || "weight");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, kind]);

  // Helpers table espèces
  const addRow = (setter) => setter((s) => [...s, { name: "", points: "" }]);
  const removeRow = (setter, idx) => setter((s) => s.filter((_, i) => i !== idx));
  const editRow = (setter, idx, key, value) =>
    setter((s) => s.map((r, i) => (i === idx ? { ...r, [key]: value } : r)));

  const toast = (type, message) => window.dispatchEvent(new CustomEvent("app:toast", { detail: { type, message } }));

  const generateCode = useMemo(() => {
    return () => {
      const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
      let out = "";
      for (let i = 0; i < 6; i++) out += chars[(Math.random() * chars.length) | 0];
      return out;
    };
  }, []);

  async function save() {
    if (!user?.id) return;
    if (!draftName?.trim()) {
      toast("error", "Indique un nom de concours.");
      return;
    }

    const base = {
      version: 5,
      kind, // "official" | "custom"
      window: { start_at: startAt || null, end_at: endAt || null },
      moderation_enabled: moderationEnabled,
    };

    let rules = { ...base };

    if (kind === "official") {
      rules.mode = mode;
      if (mode === "carnassier") {
        rules.scoring_mode = carnassierScoring;
        rules.species_points = (species || [])
          .map((r) => ({ name: r.name.trim(), points: Number(r.points || 0) }))
          .filter((r) => r.name);
      } else if (mode === "carp") {
        rules.carp = { min_weight_kg: Number(carpMinKg || 0) };
      } else if (mode === "coup") {
        rules.coup = { method: coupMethod, unit: "g" };
      } else if (mode === "expert") {
        rules.scoring_mode = carnassierScoring; // pour la partie carnassier
        rules.species_points = (species || [])
          .map((r) => ({ name: r.name.trim(), points: Number(r.points || 0) }))
          .filter((r) => r.name);
        rules.expert = { weights: expertWeights };
        rules.coup = { method: coupMethod, unit: "g" }; // le sous-mode coup de l'expert suivra cette méthode
      }
    } else {
      // CUSTOM
      rules.mode = "custom";
      rules.custom = {
        metric: customMetric,
        weight_unit: customMetric === "weight" ? customWeightUnit : undefined,
        species_points:
          customMetric === "points"
            ? (customSpecies || [])
                .map((r) => ({ name: r.name.trim(), points: Number(r.points || 0) }))
                .filter((r) => r.name)
            : undefined,
      };
    }

    try {
      const code = generateCode();
      const { data: contest, error: createErr } = await supabase
        .from("contests")
        .insert([{ name: draftName.trim(), created_by: user.id, code, rules, category: rules.mode }])
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
      toast("error", e.message || "Impossible d’enregistrer.");
    }
  }

  // Textes d’aide
  const helpText = (() => {
    if (kind === "custom") {
      if (customMetric === "points") return "Barème par espèce : le total des points classe le concours.";
      if (customMetric === "weight") return "Le classement se fait au poids total (unité choisie).";
      if (customMetric === "count") return "Le classement se fait au nombre de poissons capturés.";
      return "Le classement se fait au plus gros poisson (taille en cm).";
    } else {
      if (mode === "coup") return coupMethod === "weight"
        ? "Coup (poids) : saisis des pesées en grammes. Classement au poids total."
        : "Coup (nombre) : saisis des comptes de poissons. Classement au nombre total (ajustement du leaderboard à faire).";
      if (mode === "carp") return "Carpe : saisis le poids en kg (stocké en grammes). Classement au poids total.";
      if (mode === "expert") return "Expert : mixe Carnassier, Carpe, Coup (pondérations).";
      if (mode === "carnassier") {
        if (carnassierScoring === "biggest_fish") return "Carnassier : plus gros poisson, taille (cm) obligatoire.";
        if (carnassierScoring === "count") return "Carnassier : classement au nombre de prises (points ignorés).";
        return "Carnassier : total des points selon le barème espèces.";
      }
      return "";
    }
  })();

  return (
    <div className="grid" style={{ gap: 12 }}>
      <h1 style={{ margin: 0 }}>Configurer le concours</h1>
      <div className="kpi" style={{ marginTop: -6 }}>
        Nom : <strong>{draftName || "(sans nom)"}</strong>
      </div>

      {/* Sélecteur officiel / personnalisé */}
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Type de règles</h2>
        <div className="btn-group" style={{ marginBottom: 10 }}>
          <button className={`btn ${kind === "official" ? "btn-soft" : "btn-ghost"}`} onClick={() => setKind("official")}>
            Règles officielles
          </button>
          <button className={`btn ${kind === "custom" ? "btn-soft" : "btn-ghost"}`} onClick={() => setKind("custom")}>
            Règles personnalisées
          </button>
        </div>

        {/* Fenêtre + modération (commun) */}
        <div className="grid grid-2">
          <div>
            <label>Début (optionnel)</label>
            <input className="input" type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} />
          </div>
          <div>
            <label>Fin (optionnel)</label>
            <input className="input" type="datetime-local" value={endAt} onChange={(e) => setEndAt(e.target.value)} />
          </div>
        </div>
        <label style={{ fontWeight: 400, marginTop: 8 }}>
          <input type="checkbox" checked={moderationEnabled} onChange={(e) => setModerationEnabled(e.target.checked)} style={{ marginRight: 8 }} />
          Activer la modération des captures
        </label>
      </div>

      {/* RÈGLES OFFICIELLES */}
      {kind === "official" && (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Règles officielles</h2>

          <div className="grid grid-2">
            <div>
              <label>Discipline</label>
              <select className="select" value={mode} onChange={(e) => setMode(e.target.value)}>
                <option value="carnassier">Carnassier (du bord)</option>
                <option value="carp">Carpe (poids)</option>
                <option value="coup">Pêche au coup (poids ou nombre)</option>
                <option value="expert">Expert multi-pêche</option>
              </select>
            </div>

            {mode === "carnassier" && (
              <div>
                <label>Mode de scoring</label>
                <select className="select" value={carnassierScoring} onChange={(e) => setCarnassierScoring(e.target.value)}>
                  <option value="total_points">Total des points (barème espèces)</option>
                  <option value="count">Nombre de prises</option>
                  <option value="biggest_fish">Plus gros poisson (taille max)</option>
                </select>
              </div>
            )}

            {mode === "coup" && (
              <div>
                <label>Méthode de classement (Coup)</label>
                <select className="select" value={coupMethod} onChange={(e) => setCoupMethod(e.target.value)}>
                  <option value="weight">Au poids (g)</option>
                  <option value="count">Au nombre de poissons</option>
                </select>
              </div>
            )}

            {mode === "carp" && (
              <div>
                <label>Poids minimum (kg) — optionnel</label>
                <input className="input" type="number" step="0.1" value={carpMinKg} onChange={(e) => setCarpMinKg(e.target.value)} />
              </div>
            )}

            {mode === "expert" && (
              <div>
                <label>Pondérations (mix)</label>
                <div className="grid grid-2">
                  <input className="input" type="number" step="0.1" value={expertWeights.carnassier} onChange={(e) => setExpertWeights({ ...expertWeights, carnassier: Number(e.target.value) })} placeholder="Carnassier (x1)" />
                  <input className="input" type="number" step="0.1" value={expertWeights.carp} onChange={(e) => setExpertWeights({ ...expertWeights, carp: Number(e.target.value) })} placeholder="Carpe (x1)" />
                  <input className="input" type="number" step="0.1" value={expertWeights.coup} onChange={(e) => setExpertWeights({ ...expertWeights, coup: Number(e.target.value) })} placeholder="Coup (x1)" />
                </div>
              </div>
            )}
          </div>

          {/* Barème (carnassier & expert) */}
          {(mode === "carnassier" || mode === "expert") && (
            <div style={{ marginTop: 10 }}>
              <label>Barème par espèce</label>
              <div className="grid" style={{ gap: 8 }}>
                {species.map((row, i) => (
                  <div key={i} className="card" style={{ padding: 10, background: "#f8fafc", borderColor: "#e2e8f0", display: "grid", gap: 8 }}>
                    <div className="grid grid-2">
                      <input className="input" placeholder="Espèce (ex: brochet)" value={row.name} onChange={(e) => editRow(setSpecies, i, "name", e.target.value)} />
                      <input className="input" type="number" placeholder="Points" value={row.points}
                        onChange={(e) => editRow(setSpecies, i, "points", e.target.value)}
                        disabled={carnassierScoring !== "total_points"}
                        style={{ background: carnassierScoring === "total_points" ? "#fff" : "#f5f5f5", color: carnassierScoring === "total_points" ? "#111827" : "#6b7280" }}
                      />
                    </div>
                    <div className="btn-group">
                      <button className="btn btn-ghost" onClick={() => removeRow(setSpecies, i)} disabled={species.length === 1}>Supprimer</button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="btn-group" style={{ marginTop: 8 }}>
                <button className="btn btn-outline" onClick={() => addRow(setSpecies)}>+ Ajouter une espèce</button>
              </div>
            </div>
          )}

          {/* Aide */}
          <div className="alert" style={{ marginTop: 10 }}>{helpText}</div>
        </div>
      )}

      {/* RÈGLES PERSONNALISÉES */}
      {kind === "custom" && (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Règles personnalisées</h2>

          <div className="grid grid-2">
            <div>
              <label>Métrique principale</label>
              <select className="select" value={customMetric} onChange={(e) => setCustomMetric(e.target.value)}>
                <option value="points">Barème (points)</option>
                <option value="weight">Poids total</option>
                <option value="count">Nombre total</option>
                <option value="biggest">Plus gros poisson (cm)</option>
              </select>
            </div>

            {customMetric === "weight" && (
              <div>
                <label>Unité du poids</label>
                <select className="select" value={customWeightUnit} onChange={(e) => setCustomWeightUnit(e.target.value)}>
                  <option value="g">Grammes (g)</option>
                  <option value="kg">Kilogrammes (kg)</option>
                </select>
              </div>
            )}
          </div>

          {customMetric === "points" && (
            <div style={{ marginTop: 10 }}>
              <label>Barème par espèce</label>
              <div className="grid" style={{ gap: 8 }}>
                {customSpecies.map((row, i) => (
                  <div key={i} className="card" style={{ padding: 10, background: "#f8fafc", borderColor: "#e2e8f0", display: "grid", gap: 8 }}>
                    <div className="grid grid-2">
                      <input className="input" placeholder="Espèce (ex: brochet)" value={row.name} onChange={(e) => editRow(setCustomSpecies, i, "name", e.target.value)} />
                      <input className="input" type="number" placeholder="Points" value={row.points} onChange={(e) => editRow(setCustomSpecies, i, "points", e.target.value)} />
                    </div>
                    <div className="btn-group">
                      <button className="btn btn-ghost" onClick={() => removeRow(setCustomSpecies, i)} disabled={customSpecies.length === 1}>Supprimer</button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="btn-group" style={{ marginTop: 8 }}>
                <button className="btn btn-outline" onClick={() => addRow(setCustomSpecies)}>+ Ajouter une espèce</button>
              </div>
            </div>
          )}

          <div className="alert" style={{ marginTop: 10 }}>{helpText}</div>
        </div>
      )}

      {/* Actions */}
      <div className="btn-group" style={{ justifyContent: "flex-end" }}>
        <button className="btn btn-warning" onClick={onCancel}>Annuler</button>
        <button className="btn btn-success" onClick={save}>Enregistrer & créer</button>
      </div>
    </div>
  );
}
