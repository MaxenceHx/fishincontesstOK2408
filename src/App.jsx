// src/App.jsx
import React, { useEffect, useState } from 'react';
import { supabase } from './lib/supabase';

// Tes pages/composants (chemins à adapter si besoin)
import Auth from './components/Auth';
import ContestPage from './pages/ContestPage';
import InvitePage from './pages/InvitePage';
import ProfilePage from './pages/ProfilePage';

export default function App() {
  // --- Auth & navigation ---
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [currentPage, setCurrentPage] = useState('home'); // 'home' | 'invite' | 'profile'

  // --- Concours ---
  const [contests, setContests] = useState([]);
  const [activeContest, setActiveContest] = useState(null);
  const [newContestName, setNewContestName] = useState('');
  const [joinContestName, setJoinContestName] = useState('');

  // --- Debug (optionnel) ---
  const [debug, setDebug] = useState([]);
  const dlog = (label, payload) => {
    try {
      // eslint-disable-next-line no-console
      console.log(label, payload);
      setDebug((prev) => [
        ...prev.slice(-30),
        `[${new Date().toLocaleTimeString()}] ${label}: ${
          typeof payload === 'string' ? payload : JSON.stringify(payload)
        }`,
      ]);
    } catch {}
  };

  // ---------------------------
  // Helpers
  // ---------------------------

  // S'assure qu'une ligne existe dans `profiles` + fixe le pseudo si présent en metadata
  // helper à garder dans App.jsx
  async function ensureProfile(sessionUser) {
    if (!sessionUser) return;

    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', sessionUser.id)
      .single();

    if (!profile) {
      // crée la ligne profil
      const desired = sessionUser.user_metadata?.desired_username ?? null;
      const { error: insErr } = await supabase.from('profiles').insert([
        {
          id: sessionUser.id,
          email: sessionUser.email,
          username: desired, // peut être null
        },
      ]);
      if (insErr) {
        console.warn('Insert profile warn:', insErr.message);
      }
    }
  }

  const generateContestCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let out = '';
    for (let i = 0; i < 6; i++)
      out += chars[Math.floor(Math.random() * chars.length)];
    return out;
  };

  const hardResetSession = () => {
    try {
      if (typeof window !== 'undefined') {
        // ⚠️ storageKey doit matcher celui utilisé dans supabase.js
        sessionStorage.removeItem('fc_auth_dev_v1');
      }
    } catch {}
    window.location.reload();
  };

  // ---------------------------
  // Auth init + listeners + watchdog
  // ---------------------------
  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      //dlog('init start', null);
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) dlog('getSession error', error);
        const u = data?.session?.user ?? null;
        if (u) await ensureProfile(u);
        if (!cancelled) setUser(u);
      } catch (e) {
        dlog('getSession crash', e?.message || String(e));
      } finally {
        if (!cancelled) {
          // Nettoie le hash après magic link (#access_token)
          if (window.location.hash) {
            window.history.replaceState(
              {},
              '',
              window.location.pathname + window.location.search
            );
          }
          setAuthReady(true); // on débloque l'UI dans tous les cas
        }
      }
    };

    const { data: sub } = supabase.auth.onAuthStateChange(
      async (evt, session) => {
        //dlog('onAuthStateChange', evt);
        const u = session?.user ?? null;
        if (u) await ensureProfile(u);
        if (!cancelled) {
          setUser(u);
          setAuthReady(true);
        }
      }
    );

    init();
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Rafraîchir la session quand l'onglet redevient visible
  useEffect(() => {
    const onVis = async () => {
      if (document.visibilityState === 'visible') {
        const { data } = await supabase.auth.getSession();
        setUser(data?.session?.user ?? null);
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    fetchContests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Rafraîchissement proactif du token avant expiration (TOP-LEVEL)
  useEffect(() => {
    let timer;
    const schedule = async () => {
      const { data } = await supabase.auth.getSession();
      const sess = data?.session;
      if (!sess?.expires_at) return;

      // marge de 2 minutes
      const ms = Math.max(5000, sess.expires_at * 1000 - Date.now() - 120000);
      timer = setTimeout(async () => {
        await supabase.auth.getSession(); // déclenche un refresh si nécessaire
        schedule(); // reprogramme
      }, ms);
    };
    schedule();
    return () => clearTimeout(timer);
  }, []);

  // ⛔️ pas de useEffect ici !
  const fetchContests = async () => {
    if (!user?.id) return;

    try {
      const { data, error } = await supabase
        .from('contest_members')
        .select('contest_code')
        .eq('user_id', user.id);

      if (error) {
        dlog('fetchContests error', error);
        return;
      }

      const withNames = await Promise.all(
        (data || []).map(async (row) => {
          const { data: c, error: e2 } = await supabase
            .from('contests')
            .select('name, code')
            .eq('code', row.contest_code)
            .single();
          if (e2) dlog('fetch contest name error', e2);
          return c ? c : { name: 'Nom inconnu', code: row.contest_code };
        })
      );

      setContests(withNames);
    } catch (e) {
      dlog('fetchContests crash', e?.message || String(e));
    }
  };

  // ---------------------------
  // Actions
  // ---------------------------
  const createContest = async () => {
    if (!newContestName) return;
    try {
      const code = generateContestCode();

      const { data: contest, error: createErr } = await supabase
        .from('contests')
        .insert([{ name: newContestName, created_by: user.id, code }])
        .select()
        .single();
      if (createErr) throw createErr;

      const { error: memErr } = await supabase
        .from('contest_members')
        .insert([{ contest_code: contest.code, user_id: user.id }]);
      if (memErr) throw memErr;

      setNewContestName('');
      fetchContests();
    } catch (e) {
      dlog('Create contest error', e);
      alert(e.message || 'Erreur création concours');
    }
  };

  const joinContest = async () => {
    if (!joinContestName) return;
    try {
      const { data: contest, error: findErr } = await supabase
        .from('contests')
        .select('code, name')
        .eq('name', joinContestName)
        .single();
      if (findErr || !contest) throw new Error('Concours introuvable');

      const { error: insErr } = await supabase
        .from('contest_members')
        .insert([{ contest_code: contest.code, user_id: user.id }]);
      if (insErr) throw insErr;

      setJoinContestName('');
      fetchContests();
    } catch (e) {
      dlog('Join contest error', e);
      alert(e.message || 'Erreur rejoindre concours');
    }
  };

  const logout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      // noop
    } finally {
      try {
        if (typeof window !== 'undefined') {
          sessionStorage.removeItem('fc_auth_dev_v1'); // doit matcher supabase.js
        }
      } catch {}
      setUser(null);
      setActiveContest(null);
      setCurrentPage('home');
    }
  };

  const goHome = () => {
    setActiveContest(null);
    setCurrentPage('home');
  };

  // ---------------------------
  // UI
  // ---------------------------
  const Nav = () => (
    <nav
      style={{
        marginBottom: 20,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}
    >
      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={goHome}>Accueil</button>
        <button
          onClick={() => {
            setActiveContest(null);
            setCurrentPage('invite');
          }}
        >
          Inviter
        </button>
        <button
          onClick={() => {
            setActiveContest(null);
            setCurrentPage('profile');
          }}
        >
          Profil
        </button>
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button
          onClick={hardResetSession}
          style={{
            background: 'transparent',
            color: '#666',
            border: '1px solid #ddd',
            padding: '6px 10px',
            borderRadius: 6,
            cursor: 'pointer',
          }}
          title="Efface la session de l'onglet et recharge"
        >
          Réinit. session
        </button>
        <button
          onClick={logout}
          style={{
            background: '#dc3545',
            color: '#fff',
            padding: '8px 16px',
            border: 'none',
            borderRadius: '6px',
            fontWeight: 'bold',
            cursor: 'pointer',
          }}
        >
          Déconnexion
        </button>
      </div>
    </nav>
  );

  // Écran d'init
  if (!authReady) {
    return (
      <div style={{ padding: 20 }}>
        <h3>Initialisation…</h3>
        <pre>{debug.join('\n')}</pre>
      </div>
    );
  }

  // Non connecté
  if (!user) {
    return (
      <div>
        <Auth onLogin={setUser} />
        <div style={{ padding: 10 }}>
          <h4>Debug</h4>
          <pre>{debug.join('\n')}</pre>
        </div>
      </div>
    );
  }

  // Page Inviter
  if (currentPage === 'invite' && !activeContest) {
    return (
      <div className="app-container" style={{ padding: 20 }}>
        <Nav />
        <InvitePage user={user} />
        <pre style={{ marginTop: 10 }}>{debug.join('\n')}</pre>
      </div>
    );
  }

  // Page Profil
  if (currentPage === 'profile' && !activeContest) {
    return (
      <div className="app-container" style={{ padding: 20 }}>
        <Nav />
        <ProfilePage user={user} />
        <pre style={{ marginTop: 10 }}>{debug.join('\n')}</pre>
      </div>
    );
  }

  // Page d'un concours
  if (activeContest) {
    return (
      <div className="app-container" style={{ padding: 20 }}>
        <Nav />
        <button onClick={goHome} style={{ marginBottom: 10 }}>
          ← Retour
        </button>
        {/* IMPORTANT : passer le CODE (string) du concours */}
        <ContestPage user={user} contest_code={activeContest.code} />
        <pre style={{ marginTop: 10 }}>{debug.join('\n')}</pre>
      </div>
    );
  }

  // Accueil
  return (
    <div className="app-container" style={{ padding: 20 }}>
      <Nav />

      <h1>Bonjour {user.email}</h1>

      <div style={{ marginBottom: 20 }}>
        <h2>Créer un concours</h2>
        <input
          placeholder="Nom du concours"
          value={newContestName}
          onChange={(e) => setNewContestName(e.target.value)}
        />
        <button onClick={createContest} style={{ marginLeft: 8 }}>
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
        <button onClick={joinContest} style={{ marginLeft: 8 }}>
          Rejoindre
        </button>
      </div>

      <div>
        <h2>Mes concours</h2>
        {contests.length === 0 && <p>Aucun concours pour l’instant</p>}
        <ul>
          {contests.map((c) => (
            <li key={c.code} style={{ marginBottom: 6 }}>
              <button onClick={() => setActiveContest(c)}>{c.name}</button>
            </li>
          ))}
        </ul>
      </div>

      <pre style={{ marginTop: 10 }}>{debug.join('\n')}</pre>
    </div>
  );
}
