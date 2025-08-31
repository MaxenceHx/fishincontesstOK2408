// src/components/AddCatch.jsx
import React, { useMemo, useState } from 'react';
import { supabase } from '../lib/supabase.js';

export default function AddCatch({ contestId, contestType, user, onCatchAdded }) {
  const [fishName, setFishName] = useState('');
  const [points, setPoints] = useState('');
  const [photoUrl, setPhotoUrl] = useState(''); // optionnel (URL directe)
  const [capturedAt, setCapturedAt] = useState(() =>
    new Date().toISOString().slice(0, 16) // valeur pour <input type="datetime-local">
  );
  const [loading, setLoading] = useState(false);

  const isCarna = useMemo(() => (contestType || '').toLowerCase() === 'carna', [contestType]);

  const addCatch = async () => {
    if (!fishName) return alert("Nom du poisson ?");
    const pts = isCarna ? 100 : parseInt(points, 10);
    if (!isCarna && (!Number.isFinite(pts) || pts <= 0)) {
      alert('Renseigne un nombre de points valide.');
      return;
    }
    if (!contestId) return;

    setLoading(true);
    try {
      const payload = {
        contest_code: contestId,
        user_id: user.id,
        fish_name: fishName,
        points: pts,
        // status: laissé au trigger (pending si modération activée, sinon approved)
        photo_path: photoUrl?.trim() || null,
        captured_at: capturedAt ? new Date(capturedAt).toISOString() : null,
      };

      const { error } = await supabase.from('catches').insert([payload]);
      if (error) throw error;

      alert("Capture envoyée !");
      setFishName(''); setPoints(''); setPhotoUrl('');
      onCatchAdded && onCatchAdded();
    } catch (e) {
      console.error(e);
      alert(e.message || "Erreur lors de l'ajout.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ marginTop: 4, marginBottom: 8 }}>
      <div style={{ display: 'grid', gap: 8 }}>
        <input
          placeholder="Nom du poisson"
          value={fishName}
          onChange={(e) => setFishName(e.target.value)}
        />

        {isCarna ? (
          <div style={{ fontSize: 14, opacity: 0.85 }}>
            Mode <b>carnassier</b> : <b>100 pts</b> par capture (temporaire, règles à affiner).
          </div>
        ) : (
          <input
            placeholder="Points"
            type="number"
            value={points}
            onChange={(e) => setPoints(e.target.value)}
          />
        )}

        <input
          placeholder="URL de photo (optionnel)"
          value={photoUrl}
          onChange={(e) => setPhotoUrl(e.target.value)}
        />

        <div>
          <label style={{ display: 'block', fontSize: 12, opacity: 0.8 }}>Date/heure de capture</label>
          <input type="datetime-local" value={capturedAt} onChange={(e) => setCapturedAt(e.target.value)} />
        </div>

        <button className="btn primary" onClick={addCatch} disabled={loading}>
          {loading ? 'Envoi…' : 'Ajouter'}
        </button>
      </div>
    </div>
  );
}
