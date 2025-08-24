import React, { useState } from "react";
import { supabase } from "../lib/supabase";

export default function JoinContest({ user, onJoin }) {
  const [code, setCode] = useState("");

  const handleJoin = async () => {
    const { data, error } = await supabase
      .from("contest_members")
      .insert({ contest_code: code, user_id: user.id });
    if (error) return alert(error.message);
    onJoin(code);
  };

  return (
    <div>
      <input
        placeholder="Code du concours"
        value={code}
        onChange={(e) => setCode(e.target.value)}
      />
      <button onClick={handleJoin}>Rejoindre</button>
    </div>
  );
}
