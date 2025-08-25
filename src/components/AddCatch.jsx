// src/components/AddCatch.jsx
import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

/**
 * Saisie par mode (OFFICIAL) + CUSTOM:
 * - carnassier : espèce (+ taille optionnelle / obligatoire si biggest_fish), points depuis barème si total_points
 * - carp : poids kg -> stocké en grammes (points)
 * - coup :
 *    - method=weight : poids g -> stocké en grammes (points)
 *    - method=count  : nombre -> stocké en "points" (le leaderboard devra afficher un nombre)
 * - expert : sous-type (carnassier | carpe | coup) ; coup hérite de la méthode coup.method
 * - custom :
 *    - metric=points  : table espèces + points
 *    - metric=weight  : poids en g ou kg (stocké en grammes dans points si kg choisi → points = kg*1000)
 *    - metric=count   : nombre (stocké dans points)
 *    - metric=biggest : taille cm obligatoire (points ignorés)
 */

export default function AddCatch({ contestId, user, onCatchAdded }) {
  const [rules, setRules] = useState(null);
  const [busy, setBusy] = useState(false);

  // Champs génériques
  const [fishName, setFishName] = useState("");
  const [sizeCm, setSizeCm] = useState("");
  const [points, setPoints] = useState("");
  const [photoFile, setPhotoFile] = useState(null);

  // Poids / Nombre
  const [weightKg, setWeightKg] = useState("");
  const [weightG, setWeightG] = useState("");
  const [countN, setCountN] = useState("");

  // Expert
  const [expertType, setExpertType] = useState("carnassier");

  const toast = (type, message) =>
    window.dispatchEvent(new CustomEvent("app:toast", { detail: { type, message } }));

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("contests")
        .select("rules")
        .eq("code", contestId)
        .single();
      if (!cancelled) setRules(data?.rules || {});
    })();
    return () => { cancelled = true; };
  }, [contestId]);

  const kind = rules?.kind || "official";
  const mode = rules?.mode || "carnassier";
  const scoringMode = rules?.scoring_mode || "total_points";
  const moderationEnabled = !!rules?.moderation_enabled;

  // Barème espèces (selon mode OFFICIAL carnassier ou CUSTOM points)
  const speciesPoints = useMemo(() => {
    const src =
      kind === "custom" && rules?.custom?.metric === "points"
        ? rules.custom.species_points
        : rules?.species_points;
    const arr = Array.isArray(src) ? src : [];
    return arr.map((s) => ({ name: (s.name || "").trim(), points: Number(s.points || 0) }));
  }, [rules, kind]);

  // Auto points (carnassier OFFICIAL, ou custom points)
  useEffect(() => {
    const isCarnassierPoints =
      (kind === "official" && (mode === "carnassier" || (mode === "expert" && expertType === "carnassier")) && scoringMode === "total_points") ||
      (kind === "custom" && rules?.custom?.metric === "points");

    if (!isCarnassierPoints) {
      setPoints("");
      return;
    }
    const match = speciesPoints.find(
      (s) => s.name.toLowerCase() === (fishName || "").trim().toLowerCase()
    );
    if (match) setPoints(String(match.points));
  }, [fishName, speciesPoints, kind, mode, expertType, scoringMode, rules?.custom?.metric]);

  // Upload photo (optionnel)
  async function uploadPhotoIfAny() {
    if (!photoFile) return null;
    const file = photoFile;
    if (!file.type.startsWith("image/")) throw new Error("Le fichier doit être une image.");
    if (file.size > 12 * 1024 * 1024) throw new Error("Image trop lourde (max 12 Mo).");

    const ts = Date.now();
    const safe = file.name.replace(/[^\w.\-]+/g, "_");
    const path = `${contestId}/${user.id}/${ts}_${safe}`;

    const { error: upErr } = await supabase.storage.from("catches").upload(path, file, {
      contentType: file.type,
      upsert: true,
    });
    if (upErr) throw upErr;

    const { data: pub } = supabase.storage.from("catches").getPublicUrl(path);
    return pub?.publicUrl || null;
  }

  function canSubmit() {
    if (kind === "custom") {
      const metric = rules?.custom?.metric || "points";
      if (metric === "points") return !!fishName.trim();
      if (metric === "weight") {
        return rules?.custom?.weight_unit === "kg"
          ? Number(weightKg) > 0
          : Number(weightG) > 0;
      }
      if (metric === "count") return Number(countN) > 0;
      // biggest
      return sizeCm !== "" && !Number.isNaN(Number(sizeCm));
    }

    // OFFICIAL
    if (mode === "carp") return Number(weightKg) > 0 && Number(weightKg) >= Number(rules?.carp?.min_weight_kg || 0);
    if (mode === "coup") {
      return rules?.coup?.method === "count" ? Number(countN) > 0 : Number(weightG) > 0;
    }
    if (mode === "expert") {
      if (expertType === "carpe") return Number(weightKg) > 0 && Number(weightKg) >= Number(rules?.carp?.min_weight_kg || 0);
      if (expertType === "coup") return rules?.coup?.method === "count" ? Number(countN) > 0 : Number(weightG) > 0;
      // carnassier dans expert :
      if (!fishName.trim()) return false;
      if (scoringMode === "biggest_fish") return sizeCm !== "" && !Number.isNaN(Number(sizeCm));
      return true;
    }
    // carnassier
    if (!fishName.trim()) return false;
    if (scoringMode === "biggest_fish") return sizeCm !== "" && !Number.isNaN(Number(sizeCm));
    return true;
  }

  async function submit(e) {
    e.preventDefault();
    if (!canSubmit()) return;
    setBusy(true);

    try {
      let finalPoints = 0;
      let finalFishName = (fishName || "").trim();
      let finalSize = sizeCm === "" ? null : Number(sizeCm);

      if (kind === "custom") {
        const metric = rules?.custom?.metric || "points";
        if (metric === "weight") {
          if ((rules?.custom?.weight_unit || "g") === "kg") {
            finalPoints = Math.round(Number(weightKg) * 1000);
          } else {
            finalPoints = Math.round(Number(weightG));
          }
          if (!finalFishName) finalFishName = "Poids";
          finalSize = null;
        } else if (metric === "count") {
          finalPoints = Math.round(Number(countN));
          if (!finalFishName) finalFishName = "Comptage";
          finalSize = null;
        } else if (metric === "biggest") {
          // points ignorés
          finalPoints = 0;
          if (!finalFishName) finalFishName = "Poisson";
        } else {
          // points (barème)
          finalPoints = Number(points || 0);
        }
      } else {
        // OFFICIAL
        if (mode === "carp") {
          finalPoints = Math.round(Number(weightKg) * 1000); // grammes
          if (!finalFishName) finalFishName = "Carpe";
          finalSize = null;
        } else if (mode === "coup") {
          if ((rules?.coup?.method || "weight") === "count") {
            finalPoints = Math.round(Number(countN)); // nombre stocké dans points
            if (!finalFishName) finalFishName = "Poissons (compte)";
            finalSize = null;
          } else {
            finalPoints = Math.round(Number(weightG)); // grammes
            if (!finalFishName) finalFishName = "Poissons";
            finalSize = null;
          }
        } else if (mode === "expert") {
          if (expertType === "carpe") {
            finalPoints = Math.round(Number(weightKg) * 1000);
            finalFishName = `EXPERT:carpe|${finalFishName || "Carpe"}`;
            finalSize = null;
          } else if (expertType === "coup") {
            if ((rules?.coup?.method || "weight") === "count") {
              finalPoints = Math.round(Number(countN));
              finalFishName = `EXPERT:coup|${finalFishName || "Comptage"}`;
              finalSize = null;
            } else {
              finalPoints = Math.round(Number(weightG));
              finalFishName = `EXPERT:coup|${finalFishName || "Poissons"}`;
              finalSize = null;
            }
          } else {
            // carnassier dans expert
            if (scoringMode === "total_points") finalPoints = Number(points || 0);
            finalFishName = `EXPERT:carnassier|${finalFishName || "Poisson"}`;
          }
        } else {
          // carnassier
          if (scoringMode === "total_points") finalPoints = Number(points || 0);
        }
      }

      const photo_url = await uploadPhotoIfAny();

      const payload = {
        contest_code: contestId,
        user_id: user.id,
        fish_name: finalFishName,
        size_cm: finalSize,
        points: finalPoints, // grammes pour poids ; nombre pour count ; barème sinon
        photo_url: photo_url || null,
        status: moderationEnabled ? "pending" : "approved",
        created_at: new Date().toISOString(),
      };

      const { error: insErr } = await supabase.from("catches").insert([payload]);
      if (insErr) throw insErr;

      // reset
      setFishName(""); setSizeCm(""); setPoints("");
      setPhotoFile(null); setWeightKg(""); setWeightG(""); setCountN("");

      toast("success", moderationEnabled ? "Capture envoyée (en attente) ✅" : "Capture ajoutée ✅");
      onCatchAdded?.();
    } catch (e) {
      console.error(e);
      toast("error", e.message || "Impossible d’ajouter la capture.");
    } finally {
      setBusy(false);
    }
  }

  // ============== UI ==============

  const speciesNames = speciesPoints.map((s) => s.name).filter(Boolean);
  const sizeLabel = (kind === "custom" && rules?.custom?.metric === "biggest") || scoringMode === "biggest_fish"
    ? "Taille (cm) — obligatoire"
    : "Taille (cm) — optionnel";

  return (
    <form onSubmit={submit} className="grid" style={{ gap: 12 }}>
      {/* Bandeau contexte */}
      <div className="alert">
        {kind === "custom" ? (
          <>Mode <b>Personnalisé</b> — métrique : <b>{rules?.custom?.metric || "points"}</b></>
        ) : (
          <>Mode <b>{mode === "carp" ? "Carpe" : mode === "coup" ? "Coup" : mode === "expert" ? "Expert" : "Carnassier"}</b></>
        )}
      </div>

      {/* Expert : choix du sous-type */}
      {kind === "official" && mode === "expert" && (
        <div className="card" style={{ background: "#f8fafc", borderColor: "#e2e8f0" }}>
          <label>Type de prise (Expert)</label>
          <select className="select" value={expertType} onChange={(e) => setExpertType(e.target.value)}>
            <option value="carnassier">Carnassier</option>
            <option value="carpe">Carpe</option>
            <option value="coup">Pêche au coup</option>
          </select>
          <div className="kpi" style={{ marginTop: 6 }}>
            {rules?.coup?.method === "count"
              ? "Coup (Expert) : saisie au nombre de poissons."
              : "Coup (Expert) : saisie au poids en grammes."}
          </div>
        </div>
      )}

      {/* Bloc A — Carnassier (OFFICIAL) ou CUSTOM(points/biggest) ou Expert/carnassier */}
      {(
        (kind === "official" && (mode === "carnassier" || (mode === "expert" && expertType === "carnassier"))) ||
        (kind === "custom" && (rules?.custom?.metric === "points" || rules?.custom?.metric === "biggest"))
      ) && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Saisie — Carnassier / Barème / Plus gros</h3>
          <div className="grid grid-2">
            <div>
              <label>Espèce</label>
              {speciesNames.length > 0 ? (
                <select className="select" value={fishName} onChange={(e) => setFishName(e.target.value)}>
                  <option value="">— Choisir —</option>
                  {speciesNames.map((n) => (<option key={n} value={n}>{n}</option>))}
                </select>
              ) : (
                <input className="input" placeholder="Ex: Brochet" value={fishName} onChange={(e) => setFishName(e.target.value)} />
              )}
            </div>
            <div>
              <label>{sizeLabel}</label>
              <input className="input" type="number" step="0.1" placeholder="Ex: 74.5"
                value={sizeCm} onChange={(e) => setSizeCm(e.target.value)}
                required={(kind === "custom" && rules?.custom?.metric === "biggest") || scoringMode === "biggest_fish"} />
            </div>
          </div>

          {( (kind === "official" && scoringMode === "total_points" && (mode === "carnassier" || (mode === "expert" && expertType === "carnassier"))) ||
             (kind === "custom" && rules?.custom?.metric === "points") ) && (
            <div>
              <label>Points (barème)</label>
              <input className="input" type="number" value={points} onChange={(e) => setPoints(e.target.value)} placeholder="Ex: 100"
                disabled
                style={{ background: "#f5f5f5", color: "#6b7280" }} />
              <div className="kpi">Les points se pré-remplissent selon l’espèce définie dans le barème.</div>
            </div>
          )}
        </div>
      )}

      {/* Bloc B — Carpe (OFFICIAL) ou Expert/carpe ou CUSTOM(weight) */}
      {(
        (kind === "official" && (mode === "carp" || (mode === "expert" && expertType === "carpe"))) ||
        (kind === "custom" && rules?.custom?.metric === "weight" && (rules?.custom?.weight_unit || "g") === "kg")
      ) && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Saisie — Carpe (poids en kg)</h3>
          <div className="grid grid-2">
            <div>
              <label>Poids (kg)</label>
              <input className="input" type="number" step="0.01" placeholder="Ex: 7.85" value={weightKg} onChange={(e) => setWeightKg(e.target.value)} />
            </div>
            <div>
              <label>Libellé (optionnel)</label>
              <input className="input" placeholder="Carpe commune, miroir…" value={fishName} onChange={(e) => setFishName(e.target.value)} />
            </div>
          </div>
          <div className="kpi">Le poids est converti en grammes et stocké dans “points”.</div>
        </div>
      )}

      {/* Bloc C — Coup (OFFICIAL) ou Expert/coup (hérite de coup.method) ou CUSTOM(weight g) */}
      {(
        (kind === "official" && (mode === "coup" || (mode === "expert" && expertType === "coup"))) ||
        (kind === "custom" && rules?.custom?.metric === "weight" && (rules?.custom?.weight_unit || "g") === "g")
      ) && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>
            Saisie — Coup {kind === "official" ? (rules?.coup?.method === "count" ? "(nombre)" : "(poids g)") : "(poids g)"}
          </h3>

          {(kind === "official" && rules?.coup?.method === "count") ? (
            <div className="grid grid-2">
              <div>
                <label>Nombre de poissons</label>
                <input className="input" type="number" step="1" placeholder="Ex: 37" value={countN} onChange={(e) => setCountN(e.target.value)} />
              </div>
              <div>
                <label>Libellé (optionnel)</label>
                <input className="input" placeholder="Gardons/Brèmes…" value={fishName} onChange={(e) => setFishName(e.target.value)} />
              </div>
            </div>
          ) : (
            <div className="grid grid-2">
              <div>
                <label>Poids (g)</label>
                <input className="input" type="number" step="1" placeholder="Ex: 1350" value={weightG} onChange={(e) => setWeightG(e.target.value)} />
              </div>
              <div>
                <label>Libellé (optionnel)</label>
                <input className="input" placeholder="Gardons/Brèmes…" value={fishName} onChange={(e) => setFishName(e.target.value)} />
              </div>
            </div>
          )}

          {kind === "official" && rules?.coup?.method === "count" && (
            <div className="alert" style={{ marginTop: 8 }}>
              Classement au <b>nombre</b>. (Le leaderboard devra être ajusté pour l’affichage du “compte”.)
            </div>
          )}
          {kind === "custom" && (
            <div className="kpi">Le poids en grammes est stocké dans “points”.</div>
          )}
        </div>
      )}

      {/* Bloc D — CUSTOM (count) */}
      {(kind === "custom" && rules?.custom?.metric === "count") && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Saisie — Nombre de poissons</h3>
          <div className="grid grid-2">
            <div>
              <label>Nombre</label>
              <input className="input" type="number" step="1" placeholder="Ex: 10" value={countN} onChange={(e) => setCountN(e.target.value)} />
            </div>
            <div>
              <label>Libellé (optionnel)</label>
              <input className="input" placeholder="Espèce/lot…" value={fishName} onChange={(e) => setFishName(e.target.value)} />
            </div>
          </div>
        </div>
      )}

      {/* Photo */}
      <div className="card" style={{ background: "#f8fafc", borderColor: "#e2e8f0" }}>
        <label>Photo (optionnel)</label>
        <input className="input" type="file" accept="image/*" capture="environment" onChange={(e) => setPhotoFile(e.target.files?.[0] || null)} />
      </div>

      <div className="btn-group" style={{ justifyContent: "flex-end" }}>
        <button type="submit" className={`btn btn-primary ${busy ? "is-loading" : ""}`} disabled={busy || !canSubmit()}>
          {busy ? "Envoi…" : "Ajouter la capture"}
        </button>
      </div>
    </form>
  );
}
