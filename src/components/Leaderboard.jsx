// src/components/Leaderboard.jsx
import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

/**
 * Affichages :
 * - carnassier/custom : tableau espèces + points/prises (comme avant)
 * - carp : poids total (kg) + nb prises
 * - coup : poids total (kg) + nb prises  (version simple, sans secteurs)
 * - expert : colonnes Carnassier pts / Carpe kg / Coup kg / Total
 */

export default function Leaderboard({ contestId, refreshKey = 0 }) {
  const [rules, setRules] = useState(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const { data: contest } = await supabase
          .from("contests")
          .select("rules")
          .eq("code", contestId)
          .single();
        const r = contest?.rules || {};
        const mode = r.mode || "carnassier";
        const moderation = !!r.moderation_enabled;
        const baseSpecies =
          Array.isArray(r.species_points) && r.species_points.length
            ? r.species_points.map((s) => s.name).filter(Boolean)
            : [];

        let q = supabase
          .from("catches")
          .select("user_id, points, size_cm, fish_name")
          .eq("contest_code", contestId);
        if (moderation) q = q.eq("status", "approved");
        const { data: catches } = await q;

        const userIds = [...new Set((catches || []).map((c) => c.user_id))];
        let profiles = [];
        if (userIds.length) {
          const { data: profs } = await supabase
            .from("profiles")
            .select("id, username, email")
            .in("id", userIds);
          profiles = profs || [];
        }

        const norm = (s) => (s || "").trim().toLowerCase();

        // EXPERT: détecte type via préfixe fish_name "EXPERT:<type>|..."
        function parseExpertType(fish_name) {
          const s = String(fish_name || "");
          if (s.startsWith("EXPERT:carnassier|")) return { type: "carnassier", name: s.split("|")[1] || "" };
          if (s.startsWith("EXPERT:carpe|")) return { type: "carpe", name: s.split("|")[1] || "" };
          if (s.startsWith("EXPERT:coup|")) return { type: "coup", name: s.split("|")[1] || "" };
          return { type: null, name: s };
        }

        // Détermine les espèces (carnassier)
        let species = baseSpecies.length ? baseSpecies : [];
        if (!baseSpecies.length && (mode === "carnassier" || mode === "custom" || mode === "expert")) {
          const setSp = new Set();
          for (const c of catches || []) {
            const parsed = mode === "expert" ? parseExpertType(c.fish_name) : { type: null, name: c.fish_name };
            if (mode === "expert" && parsed.type && parsed.type !== "carnassier") continue;
            if (parsed.name) setSp.add(parsed.name);
          }
          species = [...setSp];
        }
        const speciesNorm = species.map(norm);

        const by = new Map();
        for (const c of catches || []) {
          const uid = c.user_id;
          const parsed = mode === "expert" ? parseExpertType(c.fish_name) : { type: null, name: c.fish_name };

          if (!by.has(uid)) {
            by.set(uid, {
              uid,
              username: null,
              email: "",
              // carnassier
              counts: {},
              points: 0,
              count: 0,
              max: null,
              sum: 0,
              n: 0,
              // carp/coup grams
              weight_g: 0,
              // expert breakdown
              expert: { carnassier_pts: 0, carp_g: 0, coup_g: 0 },
            });
          }
          const u = by.get(uid);

          // Join profile later
          // Dispatch per mode
          if (mode === "carp") {
            const grams = Number(c.points || 0);
            u.weight_g += grams;
            u.count += 1;
          } else if (mode === "coup") {
            const grams = Number(c.points || 0);
            u.weight_g += grams;
            u.count += 1;
          } else if (mode === "expert") {
            if (parsed.type === "carpe") {
              const grams = Number(c.points || 0);
              u.expert.carp_g += grams;
              u.count += 1;
            } else if (parsed.type === "coup") {
              const grams = Number(c.points || 0);
              u.expert.coup_g += grams;
              u.count += 1;
            } else {
              // carnassier part
              const spKey = norm(parsed.name);
              if (spKey) u.counts[spKey] = (u.counts[spKey] || 0) + 1;
              u.points += Number(c.points || 0);
              u.count += 1;
              const s = c.size_cm == null ? null : Number(c.size_cm);
              if (s != null && !Number.isNaN(s)) {
                u.max = u.max == null ? s : Math.max(u.max, s);
                u.sum += s; u.n += 1;
              }
            }
          } else {
            // carnassier / custom
            const spKey = norm(c.fish_name);
            if (spKey) u.counts[spKey] = (u.counts[spKey] || 0) + 1;

            u.points += Number(c.points || 0);
            u.count += 1;
            const s = c.size_cm == null ? null : Number(c.size_cm);
            if (s != null && !Number.isNaN(s)) {
              u.max = u.max == null ? s : Math.max(u.max, s);
              u.sum += s; u.n += 1;
            }
          }
        }

        // Finalise lignes + profils
        const arr = Array.from(by.values()).map((v) => {
          const p = profiles.find((x) => x.id === v.uid);
          const avg = v.n > 0 ? v.sum / v.n : -1;
          return { ...v, username: p?.username || null, email: p?.email || "", avg };
        });

        // Tri selon le mode
        let sorted = [...arr];
        if (mode === "carp" || mode === "coup") {
          sorted.sort((a, b) => b.weight_g - a.weight_g || b.count - a.count);
        } else if (mode === "expert") {
          const w = (rules?.expert?.weights) || { carnassier: 1, carp: 1, coup: 1 };
          for (const r of sorted) {
            r.expertTotal = (r.points * (w.carnassier || 1)) + (r.expert.carp_g * (w.carp || 1)) + (r.expert.coup_g * (w.coup || 1));
          }
          sorted.sort((a, b) =>
            b.expertTotal - a.expertTotal ||
            b.points - a.points ||
            b.expert.carp_g - a.expert.carp_g ||
            b.expert.coup_g - a.expert.coup_g ||
            b.count - a.count
          );
        } else {
          // carnassier/custom
          const modeC = rules?.scoring_mode || "total_points";
          if (modeC === "biggest_fish") {
            sorted.sort(
              (a, b) =>
                (b.max ?? -1) - (a.max ?? -1) ||
                (b.avg ?? -1) - (a.avg ?? -1) ||
                b.points - a.points ||
                b.count - a.count
            );
          } else if (modeC === "count") {
            sorted.sort((a, b) => b.count - a.count || b.points - a.points);
          } else {
            sorted.sort((a, b) => b.points - a.points || b.count - a.count);
          }
        }

        if (!cancelled) {
          setRules({ ...r, mode, species });
          setRows(sorted);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    if (contestId) load();
    return () => { cancelled = true; };
  }, [contestId, refreshKey]);

  // Colonnes pour carnassier
  const columns = useMemo(() => {
    const sp = rules?.species || [];
    const norm = (s) => (s || "").trim().toLowerCase();
    return sp.map((name) => ({ label: name, key: norm(name) }));
  }, [rules]);

  const mode = rules?.mode || "carnassier";
  const headerLabel = (() => {
    if (mode === "carp") return "Poids cumulé (Carpe)";
    if (mode === "coup") return "Poids cumulé (Coup)";
    if (mode === "expert") return "Mix Expert (Carnassier + Carpe + Coup)";
    const sm = rules?.scoring_mode;
    return sm === "count" ? "Nb de prises" : sm === "biggest_fish" ? "Plus gros poisson" : "Total des points";
  })();

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <strong>Classement</strong>
        <span className="badge">{headerLabel}</span>
        {rules?.moderation_enabled ? <span className="badge">Modération active</span> : null}
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th className="t-center" style={{ width: 68 }}>Position</th>
              <th>Utilisateur</th>

              {mode === "expert" ? (
                <>
                  <th className="t-right">Carnassier pts</th>
                  <th className="t-right">Carpe (kg)</th>
                  <th className="t-right">Coup (kg)</th>
                  <th className="t-right">Total (mix)</th>
                </>
              ) : mode === "carp" || mode === "coup" ? (
                <>
                  <th className="t-right">Poids (kg)</th>
                  <th className="t-right hide-sm">Nb prises</th>
                </>
              ) : (
                <>
                  {columns.map((c) => (<th key={c.key} className="t-right hide-sm">Nb {c.label}</th>))}
                  {rules?.scoring_mode === "biggest_fish" ? (
                    <>
                      <th className="t-right">Max (cm)</th>
                      <th className="t-right hide-sm">Moy. (cm)</th>
                    </>
                  ) : (
                    <>
                      <th className="t-right hide-sm">Nb prises</th>
                      <th className="t-right">Nb points</th>
                    </>
                  )}
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} style={{ padding: 16 }}>Chargement…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={8} style={{ padding: 16 }}>Pas encore de captures.</td></tr>
            ) : (
              rows.map((r, i) => (
                <tr key={r.uid}>
                  <td className="t-center">#{i + 1}</td>
                  <td>{r.username ? r.username : r.email}</td>

                  {mode === "expert" ? (
                    <>
                      <td className="t-right">{r.points}</td>
                      <td className="t-right">{(r.expert.carp_g / 1000).toFixed(2)}</td>
                      <td className="t-right">{(r.expert.coup_g / 1000).toFixed(2)}</td>
                      <td className="t-right"><strong>{Math.round(r.expertTotal)}</strong></td>
                    </>
                  ) : mode === "carp" || mode === "coup" ? (
                    <>
                      <td className="t-right"><strong>{(r.weight_g / 1000).toFixed(2)}</strong></td>
                      <td className="t-right hide-sm">{r.count}</td>
                    </>
                  ) : rules?.scoring_mode === "biggest_fish" ? (
                    <>
                      <td className="t-right">{r.max != null && r.max >= 0 ? r.max.toFixed(1) : "-"}</td>
                      <td className="t-right hide-sm">{r.avg != null && r.avg >= 0 ? r.avg.toFixed(1) : "-"}</td>
                    </>
                  ) : (
                    <>
                      {columns.map((c) => (<td key={c.key} className="t-right hide-sm">{r.counts?.[c.key] || 0}</td>))}
                      <td className="t-right hide-sm">{r.count}</td>
                      <td className="t-right"><strong>{r.points}</strong></td>
                    </>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="kpi" style={{ marginTop: 8 }}>
        {mode === "expert"
          ? "Total mix = (pts carnassier × w1) + (kg carpe × 1000 × w2) + (kg coup × 1000 × w3)."
          : mode === "carp" || mode === "coup"
          ? "Classement au poids cumulé (kg)."
          : rules?.scoring_mode === "biggest_fish"
          ? "Classement par taille max, puis moyenne."
          : rules?.scoring_mode === "count"
          ? "Classement par nombre total de prises."
          : "Classement par total des points, puis nombre de prises."}
      </div>
    </div>
  );
}
