// src/App.jsx
import React, { useState, useEffect } from 'react';
import Auth from './components/Auth';
import ContestPage from './pages/ContestPage';
import { supabase } from './lib/supabase';

export default function App() {
  const [user, setUser] = useState(null);
  const [contests, setContests] = useState([]);
  const [activeContest, setActiveContest] = useState(null);
  const [newContestName, setNewContestName] = useState('');
  const [joinContestName, setJoinContestName] = useState('');

  // Générateur de code unique
  const generateContestCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  // Vérifie la session et écoute les changements d’auth
  useEffect(() => {
    const getSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session?.user) setUser(data.session.user);
    };

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (session?.user) setUser(session.user);
        else setUser(null);
      }
    );

    getSession();
    return () => listener.subscription.unsubscribe();
  }, []);

  // Récupère la liste des concours de l’utilisateur
  useEffect(() => {
    if (!user) return;
    fetchContests();
  }, [user]);

  const fetchContests = async () => {
    const { data, error } = await supabase
      .from('contest_members')
      .select('contest_code, contests(name)')
      .eq('user_id', user.id)
      .order('joined_at', { ascending: true });

    if (error) console.log('Fetch contests error:', error);
    else setContests(data);
  };

  // Créer un concours
  const createContest = async () => {
    if (!newContestName) return;

    try {
      
      await ensureProfile(user)
      
      const contestCode = generateContestCode();

      const { data: contest, error: createErr } = await supabase
        .from('contests')
        .insert([
          {
            name: newContestName,
            created_by: user.id,
            code: contestCode,
          },
        ])
        .select()
        .single();

      if (createErr) throw createErr;

      await supabase
        .from('contest_members')
        .insert([{ contest_code: contest.id, user_id: user.id }]);

      setNewContestName('');
      fetchContests();
    } catch (err) {
      console.error('Erreur création concours:', err);
      alert('Impossible de créer le concours. Vérifie la console !');
    }
  };

  // Rejoindre un concours existant
  const joinContest = async () => {
    if (!joinContestName) return;

    try {
      const { data: contest, error: findErr } = await supabase
        .from('contests')
        .select('*')
        .eq('name', joinContestName)
        .single();

      if (findErr || !contest) {
        alert('Concours introuvable !');
        return;
      }

      await supabase
        .from('contest_members')
        .insert([{ contest_code: contest.id, user_id: user.id }]);

      setJoinContestName('');
      fetchContests();
    } catch (err) {
      console.error('Erreur rejoindre concours:', err);
    }
  };

  // Interface
  if (!user) return <Auth onLogin={setUser} />;
  if (activeContest) return <ContestPage user={user} contest={activeContest} />;

  return (
    <div className="container" style={{ padding: 20 }}>
      <h1>Bonjour {user.email}</h1>

      <div style={{ marginBottom: 20 }}>
        <h2>Créer un concours</h2>
        <input
          placeholder="Nom du concours"
          value={newContestName}
          onChange={(e) => setNewContestName(e.target.value)}
        />
        <button className="create" onClick={createContest}>
          Créer
        </button>
      </div>

      <div style={{ marginBottom: 20 }}>
        <h2>Rejoindre un concours</h2>
        <input
          placeholder="Nom du concours"
          value={joinContestName}
          onChange={(e) => setJoinContestName(e.target.value)}
        />
        <button className="join" onClick={joinContest}>
          Rejoindre
        </button>
      </div>

      <div>
        <h2>Mes concours</h2>
        {contests.length === 0 && <p>Aucun concours pour l’instant</p>}
        <ul>
          {contests.map((c) => (
            <li key={c.contest_code} style={{ marginBottom: 5 }}>
              <button
                onClick={() =>
                  setActiveContest({ id: c.contest_code, name: c.contests.name })
                }
              >
                {c.contests.name}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
