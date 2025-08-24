import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import Leaderboard from '../components/Leaderboard';
import AddCatch from '../components/AddCatch';

export default function ContestPage({ contest_code, user }) {
  const [refreshKey, setRefreshKey] = useState(0);

  const handleCatchAdded = () => {
    // Incrémente la clé => Leaderboard va se rafraîchir
    setRefreshKey((prev) => prev + 1);
  };

  return (
    <div>
      <AddCatch
        contestId={contest_code}
        user={user}
        onCatchAdded={handleCatchAdded}
      />
      <Leaderboard contestId={contest_code} refreshKey={refreshKey} />
    </div>
  );
}
