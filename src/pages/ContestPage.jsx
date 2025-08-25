// src/pages/ContestPage.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import Leaderboard from '../components/Leaderboard';
import AddCatch from '../components/AddCatch';
import ContestAdmin from '../components/ContestAdmin';

export default function ContestPage({ contest_code, user }) {
  const [contest, setContest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('contests')
          .select('name, code, rules, created_by')
          .eq('code', contest_code)
          .single();
        if (!cancelled && !error) setContest(data);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    if (contest_code) load();
    return () => { cancelled = true; };
  }, [contest_code]);

  const handleCatchAdded = () => setRefreshKey((k) => k + 1);

  const isWindowOpen = useMemo(() => {
    const start = contest?.rules?.window?.start_at || null;
    const end = contest?.rules?.window?.end_at || null;
    const now = new Date();
    const okStart = !start || now >= new Date(start);
    const okEnd = !end || now <= new Date(end);
    return okStart && okEnd;
  }, [contest]);

  if (loading) return <div>Chargement du concours…</div>;
  if (!contest) return <div>Concours introuvable.</div>;

  const startAt = contest?.rules?.window?.start_at || null;
  const endAt = contest?.rules?.window?.end_at || null;
  const mode = contest?.rules?.mode || "carnassier";
  const isOwner = contest?.created_by === user?.id;

  const modeLabel = (() => {
    if (mode === "carp") return "Carpe (poids cumulé)";
    if (mode === "coup") return "Pêche au coup (poids cumulé)";
    if (mode === "expert") return "Expert multi-pêche (mix)";
    if (mode === "custom") return "Personnalisé";
    return "Carnassier";
  })();

  return (
    <div>
      <h1 style={{ marginBottom: 10 }}>{contest.name}</h1>

      {/* Bandeau d’état */}
      <div className={`alert ${isWindowOpen ? 'alert-success' : 'alert-warning'}`} style={{ marginBottom: 12 }}>
        <div style={{ fontWeight: 700, marginBottom: 4 }}>
          {isWindowOpen ? 'Captures ouvertes ✅' : 'Captures bloquées ⛔️'}
        </div>
        <div style={{ fontSize: 13, opacity: 0.9 }}>
          {startAt ? `Début : ${new Date(startAt).toLocaleString()}` : 'Début : libre'} —{' '}
          {endAt ? `Fin : ${new Date(endAt).toLocaleString()}` : 'Fin : libre'} — Mode : {modeLabel}
        </div>
      </div>

      {/* Ajouter une capture */}
      <div className="card" style={{ marginBottom: 16 }}>
        {isWindowOpen ? (
          <AddCatch contestId={contest.code} user={user} onCatchAdded={handleCatchAdded} />
        ) : (
          <div className="alert" style={{ margin: 0 }}>
            L’ajout de captures est désactivé pour le moment.
          </div>
        )}
      </div>

      {/* Leaderboard */}
      <div className="card" style={{ marginBottom: 16 }}>
        <Leaderboard contestId={contest.code} refreshKey={refreshKey} />
      </div>

      {/* Administration */}
      {isOwner && (
        <div className="card" style={{ marginTop: 16 }}>
          <h2 style={{ marginTop: 0, marginBottom: 10 }}>Administration</h2>
          <ContestAdmin contestCode={contest.code} user={user} />
        </div>
      )}
    </div>
  );
}
