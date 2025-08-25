// src/pages/InvitePage.jsx
import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export default function InvitePage({ user }) {
  const [contests, setContests] = useState([]);
  const [busyCode, setBusyCode] = useState(null);

  const toast = (type, message) =>
    window.dispatchEvent(new CustomEvent("app:toast", { detail: { type, message } }));

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // récupère tous les concours où l'utilisateur est membre
      const { data: memberships } = await supabase
        .from("contest_members")
        .select("contest_code")
        .eq("user_id", user.id);

      const codes = (memberships || []).map((m) => m.contest_code);
      if (!codes.length) {
        setContests([]);
        return;
      }

      const { data: items } = await supabase
        .from("contests")
        .select("name, code, created_by")
        .in("code", codes);

      if (!cancelled) setContests(items || []);
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  function linkFor(code) {
    return `${window.location.origin}/?join=${code}`;
  }

  async function copyLink(code) {
    try {
      setBusyCode(code);
      await navigator.clipboard.writeText(linkFor(code));
      toast("success", "Lien copié ✅");
    } catch {
      toast("error", "Impossible de copier le lien.");
    } finally {
      setBusyCode(null);
    }
  }

  async function nativeShare(code) {
    const url = linkFor(code);
    try {
      if (navigator.share) {
        await navigator.share({
          title: "Rejoins mon concours de pêche",
          text: "Clique pour rejoindre le concours 👇",
          url,
        });
      } else {
        await copyLink(code);
      }
    } catch {
      /* cancel */
    }
  }

  return (
    <div>
      <h1 style={{ marginTop: 0 }}>Inviter des amis</h1>
      {contests.length === 0 ? (
        <div className="alert">Tu n’as pas encore de concours à partager.</div>
      ) : (
        <div className="grid" style={{ gap: 12 }}>
          {contests.map((c) => (
            <div className="card" key={c.code} style={{ display: "grid", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{c.name}</div>
                  <div className="kpi">Code: <code>{c.code}</code></div>
                </div>
                {c.created_by === user.id ? (
                  <span className="badge">Organisateur</span>
                ) : null}
              </div>

              <div className="grid" style={{ gap: 8 }}>
                <input className="input" readOnly value={linkFor(c.code)} />
                <div className="btn-group">
                  <button
                    className={`btn btn-outline ${busyCode === c.code ? "is-loading" : ""}`}
                    onClick={() => copyLink(c.code)}
                    disabled={busyCode === c.code}
                  >
                    Copier le lien
                  </button>
                  <button className="btn btn-primary" onClick={() => nativeShare(c.code)}>
                    Partager
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      <p className="kpi" style={{ marginTop: 10 }}>
        Le lien contient le code <b>?join=CODE</b>. Quand ton ami l’ouvre connecté, il rejoint automatiquement.
      </p>
    </div>
  );
}
