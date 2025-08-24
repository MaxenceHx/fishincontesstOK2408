import React, { useState } from 'react';
import { supabase } from '../lib/supabase';

export default function AddCatch({ contestId, user, onCatchAdded }) {
  const [fishName, setFishName] = useState('');
  const [points, setPoints] = useState('');

  const addCatch = async () => {
    if (!fishName || !points) return;

    if (!contestId) {
      console.error('Pas de contest_code défini !');
      return;
    }

    const { error } = await supabase.from('catches').insert([
      {
        contest_code: contestId,
        user_id: user.id,
        fish_name: fishName,
        points: parseInt(points),
      },
    ]);

    if (error) {
      console.error('Erreur ajout capture:', error);
      alert('Impossible d’ajouter la capture. Vérifie la console !');
    } else {
      setFishName('');
      setPoints('');
      if (onCatchAdded) onCatchAdded(); // 🔄 Notifie ContestPage
    }
  };

  return (
    <div style={{ marginTop: 20, marginBottom: 20 }}>
      <h2>Ajouter une capture</h2>
      <input
        placeholder="Nom du poisson"
        value={fishName}
        onChange={(e) => setFishName(e.target.value)}
      />
      <input
        placeholder="Points"
        type="number"
        value={points}
        onChange={(e) => setPoints(e.target.value)}
        style={{ marginLeft: 10 }}
      />
      <button onClick={addCatch} style={{ marginLeft: 10 }}>
        Ajouter
      </button>
    </div>
  );
}
