// src/components/Leaderboard.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase.js';

export default function Leaderboard({ contestId, refreshKey }) {
  const [rows, setRows] = useState([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('catches')
        .select('user_id, points')
        .eq('contest_code', contestId)
        .eq('status', 'approved');

      if (!cancelled) {
        if (error) { console.warn(error); setRows([]); }
        else setRows(data || []);
      }
    })();
    return () => { cancelled = true; };
  }, [contestId, refreshKey]);

  const board = useMemo(() => {
    const map = new Map();
    for (const r of rows) {
      map.set(r.user_id, (map.get(r.user_id) || 0) + (r.points || 0));
    }
    return [...map.entries()]
      .map(([user_id, total]) => ({ user_id, total }))
      .sort((a, b) => b.total - a.total);
  }, [rows]);

  return (
    <div style={{ display:'grid', gap:8 }}>
      {board.length === 0 && <div style={{ opacity: 0.7 }}>Pas encore de scores validés.</div>}
      {board.map((r, i) => (
        <div key={r.user_id} className="discover-card" style={{ padding: 10 }}>
          <div style={{ display:'flex', justifyContent:'space-between' }}>
            <div><b>#{i+1}</b> — {r.user_id.slice(0,8)}…</div>
            <div style={{ fontWeight:700 }}>{r.total} pts</div>
          </div>
        </div>
      ))}
    </div>
  );
}
