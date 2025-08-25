// src/pages/MyCatches.jsx
import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

export default function MyCatches({ user }) {
  const [rows, setRows] = useState([]);
  const [contests, setContests] = useState([]); // [{code,name,mode}]
  const [loading, setLoading] = useState(true);

  // Filtres
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all"); // all | approved | pending | rejected
  const [contest, setContest] = useState("all");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        // 1) Toutes mes captures
        const { data: catches, error } = await supabase
          .from("catches")
          .select("contest_code, fish_name, size_cm, points, photo_url, status, created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });
        if (error) throw error;
        const items = catches || [];

        // 2) Récupère noms & modes des concours
        const codes = [...new Set(items.map((c) => c.contest_code))];
        let contestMap = new Map();
        if (codes.length) {
          const { data: contestsData } = await supabase
            .from("contests")
            .select("code, name, rules")
            .in("code", codes);
          for (const c of contestsData || []) {
            const mode = c?.rules?.mode || "carnassier";
            contestMap.set(c.code, { name: c.name, mode });
          }
        }

        // 3) Range en mémoire (et parse type Expert)
        const parsed = items.map((r) => {
          const info = contestMap.get(r.contest_code) || { name: r.contest_code, mode: "carnassier" };
          const { type: expertType, name: cleanFishName } = parseExpertType(r.fish_name);
          return {
            ...r,
            contest_name: info.name,
            contest_mode: info.mode,
            expert_type: expertType,           // "carnassier" | "carpe" | "coup" | null
            fish_name_clean: cleanFishName,    // nom sans le préfixe EXPERT:
          };
        });

        if (!cancelled) {
          setRows(parsed);
          setContests(codes.map((code) => ({
            code,
            name: (contestMap.get(code)?.name) || code,
          })));
        }
      } catch (e) {
        console.error("MyCatches load error:", e);
        if (!cancelled) {
          setRows([]);
          setContests([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    if (user?.id) load();
    return () => { cancelled = true; };
  }, [user?.id]);

  // Helpers
  function parseExpertType(fish_name) {
    const s = String(fish_name || "");
    if (s.startsWith("EXPERT:carnassier|")) return { type: "carnassier", name: s.split("|")[1] || "" };
    if (s.startsWith("EXPERT:carpe|")) return { type: "carpe", name: s.split("|")[1] || "" };
    if (s.startsWith("EXPERT:coup|")) return { type: "coup", name: s.split("|")[1] || "" };
    return { type: null, name: s };
  }
  function kgFromPoints(row) {
    // Carpe/Coup: points = grammes ; Expert: dépend du sous-type
    if (row.contest_mode === "carp" || row.contest_mode === "coup") return (Number(row.points || 0) / 1000);
    if (row.contest_mode === "expert" && (row.expert_type === "carpe" || row.expert_type === "coup"))
      return (Number(row.points || 0) / 1000);
    return null;
  }
  function typeLabel(row) {
    if (row.contest_mode !== "expert") {
      // normalise libellé
      if (row.contest_mode === "carp") return "Carpe";
      if (row.contest_mode === "coup") return "Coup";
      return "Carnassier";
    }
    // expert
    if (row.expert_type === "carpe") return "Expert / Carpe";
    if (row.expert_type === "coup") return "Expert / Coup";
    return "Expert / Carnassier";
  }

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (status !== "all") {
        const st = r.status || "approved";
        if (st !== status) return false;
      }
      if (contest !== "all" && r.contest_code !== contest) return false;
      if (q) {
        const s = q.trim().toLowerCase();
        const hay = `${r.fish_name_clean || ""} ${r.contest_name || ""} ${typeLabel(r)}`.toLowerCase();
        if (!hay.includes(s)) return false;
      }
      return true;
    });
  }, [rows, q, status, contest]);

  const counts = useMemo(() => {
    const c = { all: rows.length, approved: 0, pending: 0, rejected: 0 };
    for (const r of rows) {
      const st = r.status || "approved";
      if (st in c) c[st] += 1;
    }
    return c;
  }, [rows]);

  return (
    <div>
      <h1 style={{ marginTop: 0 }}>Mes captures</h1>

      {/* Filtres */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="grid" style={{ gap: 12 }}>
          <div className="grid grid-2">
            <div>
              <label>Recherche</label>
              <input
                className="input"
                placeholder="Espèce, type ou nom du concours…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
            <div>
              <label>Concours</label>
              <select className="select" value={contest} onChange={(e) => setContest(e.target.value)}>
                <option value="all">Tous</option>
                {contests.map((c) => (
                  <option key={c.code} value={c.code}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="btn-group">
            <button className={`btn ${status === "all" ? "btn-soft" : "btn-ghost"}`} onClick={() => setStatus("all")}>
              Toutes ({counts.all})
            </button>
            <button className={`btn ${status === "approved" ? "btn-soft" : "btn-ghost"}`} onClick={() => setStatus("approved")}>
              Approuvées ({counts.approved})
            </button>
            <button className={`btn ${status === "pending" ? "btn-soft" : "btn-ghost"}`} onClick={() => setStatus("pending")}>
              En attente ({counts.pending})
            </button>
            <button className={`btn ${status === "rejected" ? "btn-soft" : "btn-ghost"}`} onClick={() => setStatus("rejected")}>
              Refusées ({counts.rejected})
            </button>
          </div>
        </div>
      </div>

      {/* Liste */}
      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Concours</th>
                <th>Type</th>
                <th>Espèce / Libellé</th>
                <th className="t-right hide-sm">Taille (cm)</th>
                <th className="t-right">Poids (kg)</th>
                <th className="t-right hide-sm">Points</th>
                <th className="t-center">Statut</th>
                <th className="t-center">Photo</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} style={{ padding: 16 }}>Chargement…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={9} style={{ padding: 16 }}>Aucune capture pour ces filtres.</td></tr>
              ) : (
                filtered.map((r, i) => {
                  const kg = kgFromPoints(r);
                  const sizeStr = r.size_cm != null ? Number(r.size_cm).toFixed(1) : "-";
                  const ptsStr =
                    (r.contest_mode === "carp" || r.contest_mode === "coup" || (r.contest_mode === "expert" && (r.expert_type === "carpe" || r.expert_type === "coup")))
                      ? "-" // on n'affiche pas les grammes comme "points"
                      : (r.points ?? 0);

                  return (
                    <tr key={`${r.contest_code}-${i}-${r.created_at}`}>
                      <td>{new Date(r.created_at).toLocaleString()}</td>
                      <td>{r.contest_name}</td>
                      <td>{typeLabel(r)}</td>
                      <td>{r.fish_name_clean || "-"}</td>
                      <td className="t-right hide-sm">{sizeStr}</td>
                      <td className="t-right">{kg != null ? kg.toFixed(2) : "-"}</td>
                      <td className="t-right hide-sm">{ptsStr}</td>
                      <td className="t-center"><StatusPill status={r.status || "approved"} /></td>
                      <td className="t-center">
                        {r.photo_url ? (
                          <a href={r.photo_url} target="_blank" rel="noreferrer" className="btn btn-outline btn-sm">
                            Voir
                          </a>
                        ) : (
                          <span className="kpi">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="kpi" style={{ marginTop: 10 }}>
        Astuce : en Carpe/Coup, le poids est saisi en kg/g et converti en grammes (stockés dans <b>points</b>) pour le classement.
      </p>
    </div>
  );
}

function StatusPill({ status }) {
  const map = {
    approved: { label: "Approuvée", bg: "#dcfce7", fg: "#14532d" },
    pending: { label: "En attente", bg: "#fffbeb", fg: "#78350f" },
    rejected: { label: "Refusée", bg: "#fee2e2", fg: "#7f1d1d" },
  };
  const s = map[status] || map.approved;
  return (
    <span className="badge" style={{ background: s.bg, color: s.fg }}>
      {s.label}
    </span>
  );
}
