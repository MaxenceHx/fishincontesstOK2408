import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export default function Leaderboard({ contestId, refreshKey }) {
  const [leaderboard, setLeaderboard] = useState([]);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      const { data, error } = await supabase
        .from('catches')
        .select('user_id, points, profiles(username, email)')
        .eq('contest_code', contestId);

      if (error) {
        console.error('Erreur leaderboard:', error);
        return;
      }

      // Agréger par user_id
      const scores = {};
      data.forEach((row) => {
        if (!scores[row.user_id]) {
          scores[row.user_id] = {
            username: row.profiles.username ?? row.profiles.email,
            points: 0,
          };
        }
        scores[row.user_id].points += row.points;
      });

      // Transformer en tableau trié
      const sorted = Object.values(scores).sort((a, b) => b.points - a.points);
      setLeaderboard(sorted);
    };

    fetchLeaderboard();
  }, [contestId, refreshKey]);

  return (
    <div>
      <h2>Leaderboard</h2>
      <ul>
        {leaderboard.map((entry, index) => (
          <li key={index}>
            {index + 1}. {entry.username} – {entry.points} pts
          </li>
        ))}
      </ul>
    </div>
  );
}
