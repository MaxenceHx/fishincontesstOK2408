// src/App.jsx
import React, { useEffect, useState } from 'react';
import { supabase } from './lib/supabase';

// Composants / Pages
import Auth from './components/Auth';
import NavBar from './components/NavBar.jsx';
import ContestPage from './pages/ContestPage';
import InvitePage from './pages/InvitePage';
import ProfilePage from './pages/ProfilePage';
import ContestConfig from './pages/ContestConfig';
import MyCatches from './pages/MyCatches';

export default function App() {
  // --- Auth & navigation ---
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [currentPage, setCurrentPage] = useState('home'); // 'home' | 'invite' | 'profile' | 'config' | 'mycatches'

  // --- Concours ---
  const [contests, setContests] = useState([]); // [{name, code, rules, category}]
  const [activeContest, setActiveContest] = useState(null);
  const [newContestName, setNewContestName] = useState('');
  const [draftContestName, setDraftContestName] = useState('');
  const [joinContestName, setJoinContestName] = useState('');

  // --- Profil ---
  const [profile, setProfile] = useState(null);

  // --- Toasts (globaux) ---
  const [toasts, setToasts] = useState([]);
  useEffect(() => {
    const handler = (e) => {
      const { type = 'info', message = '' } = e.detail || {};
      const id = Date.now() + Math.random();
      setToasts((prev) => [...prev, { id, type, message }]);
      setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 2600);
    };
    window.addEventListener('app:toast', handler);
    return () => window.removeEventListener('app:toast', handler);
  }, []);
  const toast = (type, message) =>
    window.dispatchEvent(new CustomEvent('app:toast', { detail: { type, message } }));

  // ---------------------------
  // Helpers
  // ---------------------------
  async function ensureProfile(sessionUser) {
    if (!sessionUser) return;
    const { data: existing } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', sessionUser.id)
      .single();

    if (!existing) {
      const desired = sessionUser.user_metadata?.desired_username ?? null;
      const { error: insErr } = await supabase.from('profiles').insert([
        { id: sessionUser.id, email: sessionUser.email, username: desired },
      ]);
      if (insErr) console.warn('Insert profile warn:', insErr.message);
    }
  }

  const hardResetSession = () => {
    try {
      if (typeof window !== 'undefined') sessionStorage.removeItem('fc_auth_dev_v1');
    } catch {}
    window.location.reload();
  };

  // ---------------------------
  // Auth init + listeners
  // ---------------------------
  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) console.log('getSession error', error);
        const u = data?.session?.user ?? null;
        if (u) await ensureProfile(u);
        if (!cancelled) setUser(u);
      } catch (e) {
        console.log('getSession crash', e?.message || String(e));
      } finally {
        if (!cancelled) {
          // Nettoie le hash OAuth si présent
          if (window.location.hash) {
            window.history.replaceState({}, '', window.location.pathname + window.location.search);
          }
          setAuthReady(true);
        }
      }
    };

    const { data: sub } = supabase.auth.onAuthStateChange(async (_evt, session) => {
      const u = session?.user ?? null;
      if (u) await ensureProfile(u);
      if (!cancelled) {
        setUser(u);
        setAuthReady(true);
      }
    });

    init();
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    fetchContests();
    loadProfile();
  }, [user?.id]);

  const fetchContests = async () => {
    if (!user?.id) return;
    try {
      const { data, error } = await supabase
        .from('contest_members')
        .select('contest_code')
        .eq('user_id', user.id);
      if (error) return;

      const withNames = await Promise.all(
        (data || []).map(async (row) => {
          const { data: c } = await supabase
            .from('contests')
            .select('name, code, rules, category')
            .eq('code', row.contest_code)
            .single();
          return c ? c : { name: 'Nom inconnu', code: row.contest_code, rules: {}, category: 'custom' };
        })
      );
      setContests(withNames);
    } catch (e) {
      // noop
    }
  };

  const loadProfile = async () => {
    if (!user?.id) return;
    const { data } = await supabase
      .from('profiles')
      .select('username, email')
      .eq('id', user.id)
      .single();
    if (data) setProfile(data);
  };

  // ---------------------------
  // Deep-link JOIN = ?join=CODE
  // ---------------------------
  const [joinHandledCode, setJoinHandledCode] = useState(null);
  useEffect(() => {
    if (!authReady || !user) return;
    const url = new URL(window.location.href);
    const code = url.searchParams.get('join');
    if (!code || joinHandledCode === code) return;

    (async () => {
      try {
        const { data: exists } = await supabase
          .from('contest_members')
          .select('contest_code')
          .eq('contest_code', code)
          .eq('user_id', user.id)
          .limit(1);

        if (!exists || exists.length === 0) {
          const { error: insErr } = await supabase
            .from('contest_members')
            .insert([{ contest_code: code, user_id: user.id }]);
          if (insErr) throw insErr;
        }

        const { data: contest, error: cErr } = await supabase
          .from('contests')
          .select('name, code, rules')
          .eq('code', code)
          .single();
        if (cErr || !contest) throw new Error('Concours introuvable');

        toast('success', `Rejoint : ${contest.name}`);
        setActiveContest(contest);
        fetchContests();

        url.searchParams.delete('join');
        const clean = url.pathname + (url.searchParams.toString() ? '?' + url.searchParams.toString() : '');
        window.history.replaceState({}, '', clean);
      } catch (e) {
        toast('error', e.message || 'Impossible de rejoindre le concours');
      } finally {
        setJoinHandledCode(code);
      }
    })();
  }, [authReady, user, joinHandledCode]);

  // ---------------------------
  // Actions
  // ---------------------------
  const joinContest = async () => {
    if (!joinContestName) return;
    try {
      const { data: contest, error: findErr } = await supabase
        .from('contests')
        .select('code, name, rules')
        .eq('name', joinContestName)
        .single();
      if (findErr || !contest) throw new Error('Concours introuvable');

      const { error: insErr } = await supabase
        .from('contest_members')
        .insert([{ contest_code: contest.code, user_id: user.id }]);
      if (insErr) throw insErr;

      setJoinContestName('');
      fetchContests();
      toast('success', `Rejoint : ${contest.name}`);
    } catch (e) {
      toast('error', e.message || 'Erreur rejoindre concours');
    }
  };

  const logout = async () => {
    try {
      await supabase.auth.signOut();
    } finally {
      try {
        if (typeof window !== 'undefined') sessionStorage.removeItem('fc_auth_dev_v1');
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
  // Utils: statut du concours + rang utilisateur (aperçu)
  // ---------------------------
  const contestStatus = (rules) => {
    const now = new Date();
    const start = rules?.window?.start_at ? new Date(rules.window.start_at) : null;
    const end = rules?.window?.end_at ? new Date(rules.window.end_at) : null;
    if (start && now < start) return { key: 'upcoming', label: '🟠 Prochainement' };
    if (end && now > end) return { key: 'ended', label: '🔴 Terminé' };
    return { key: 'live', label: '🟢 Live' };
  };

  function MyContestCard({ contest }) {
    const [meRank, setMeRank] = useState(null);
    const [total, setTotal] = useState(null);

    useEffect(() => {
      let cancelled = false;
      const loadRank = async () => {
        try {
          const { data: c } = await supabase
            .from('contests')
            .select('rules')
            .eq('code', contest.code)
            .single();
          const mode = c?.rules?.scoring_mode || 'total_points';
          const moderation = !!c?.rules?.moderation_enabled;

          let q = supabase
            .from('catches')
            .select('user_id, points, size_cm, fish_name')
            .eq('contest_code', contest.code);
          if (moderation) q = q.eq('status', 'approved');
          const { data: rows } = await q;

          const by = new Map();
          for (const r of rows || []) {
            if (!by.has(r.user_id)) by.set(r.user_id, { points: 0, count: 0, max: null, sum: 0, n: 0 });
            const u = by.get(r.user_id);
            u.points += Number(r.points || 0);
            u.count += 1;
            const s = r.size_cm == null ? null : Number(r.size_cm);
            if (s != null && !Number.isNaN(s)) {
              u.max = u.max == null ? s : Math.max(u.max, s);
              u.sum += s;
              u.n += 1;
            }
          }
          const arr = Array.from(by.entries()).map(([uid, v]) => ({
            uid,
            points: v.points,
            count: v.count,
            max: v.max == null ? -1 : v.max,
            avg: v.n > 0 ? v.sum / v.n : -1,
          }));

          let sorted;
          if (mode === 'biggest_fish') {
            sorted = arr.sort(
              (a, b) =>
                b.max - a.max ||
                b.avg - a.avg ||
                b.points - a.points ||
                b.count - a.count
            );
          } else if (mode === 'count') {
            sorted = arr.sort((a, b) => b.count - a.count || b.points - a.points);
          } else {
            sorted = arr.sort((a, b) => b.points - a.points || b.count - a.count);
          }

          const rank = sorted.findIndex((x) => x.uid === user.id);
          if (!cancelled) {
            setTotal(sorted.length);
            setMeRank(rank === -1 ? null : rank + 1);
          }
        } catch {
          /* noop */
        }
      };
      loadRank();
      return () => {
        cancelled = true;
      };
    }, [contest.code]);

    return (
      <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ display: 'grid' }}>
          <div style={{ fontWeight: 700 }}>{contest.name}</div>
          <div className="kpi">{contestStatus(contest.rules).label}</div>
        </div>
        <div className="kpi">
          {meRank ? (
            <>
              Ta position : <strong>#{meRank}</strong> {total ? <>/ {total}</> : null}
            </>
          ) : (
            'Pas encore classé'
          )}
        </div>
        <div className="btn-group">
          <button className="btn btn-primary" onClick={() => setActiveContest(contest)}>Ouvrir</button>
        </div>
      </div>
    );
  }

  // ---------------------------
  // UI helpers
  // ---------------------------
  const Toasts = () => (
    <div style={{ position: 'fixed', top: 16, right: 16, display: 'grid', gap: 8, zIndex: 9999, width: 'min(92vw, 360px)' }}>
      {toasts.map((t) => {
        const cls =
          t.type === 'success'
            ? 'alert alert-success'
            : t.type === 'error'
            ? 'alert alert-error'
            : 'alert';
        return (
          <div key={t.id} className={cls}>
            {t.message}
          </div>
        );
      })}
    </div>
  );

  const HomeHeader = () => (
    <NavBar
      onHome={goHome}
      onCatches={() => setCurrentPage('mycatches')}
      onInvite={() => setCurrentPage('invite')}
      onProfile={() => setCurrentPage('profile')}
      onReset={hardResetSession}
      onLogout={logout}
    />
  );

  // ---------------------------
  // Rendus conditionnels
  // ---------------------------
  if (!authReady) return <div className="container"><h3>Initialisation…</h3></div>;

  if (!user) {
    return (
      <div>
        <Auth onLogin={setUser} />
        <Toasts />
      </div>
    );
  }

  if (currentPage === 'config') {
    return (
      <>
        <HomeHeader />
        <div className="container">
          <ContestConfig
            user={user}
            draftName={draftContestName}
            onCancel={() => setCurrentPage('home')}
            onCreated={() => {
              setNewContestName('');
              setDraftContestName('');
              setCurrentPage('home');
              fetchContests();
              loadProfile();
              toast('success', 'Concours créé ✅');
            }}
          />
        </div>
        <Toasts />
      </>
    );
  }

  if (currentPage === 'mycatches') {
    return (
      <>
        <HomeHeader />
        <div className="container">
          <MyCatches user={user} />
        </div>
        <Toasts />
      </>
    );
  }

  if (currentPage === 'invite') {
    return (
      <>
        <HomeHeader />
        <div className="container">
          <InvitePage user={user} />
        </div>
        <Toasts />
      </>
    );
  }

  if (currentPage === 'profile') {
    return (
      <>
        <HomeHeader />
        <div className="container">
          <ProfilePage user={user} />
        </div>
        <Toasts />
      </>
    );
  }

  if (activeContest) {
    return (
      <>
        <HomeHeader />
        <div className="container">
          <button className="btn btn-ghost" onClick={goHome}>← Retour</button>
          <div style={{ height: 8 }} />
          <ContestPage user={user} contest_code={activeContest.code} />
        </div>
        <Toasts />
      </>
    );
  }

  // Accueil (Mes concours + Créer/Rejoindre)
  const withStatus = contests.map((c) => ({ ...c, _status: contestStatus(c.rules).key }));
  const order = { live: 0, upcoming: 1, ended: 2 };
  const sorted = withStatus.sort((a, b) => order[a._status] - order[b._status] || a.name.localeCompare(b.name));

  return (
    <>
      <HomeHeader />
      <div className="container">
        <h1>Bonjour {profile?.username ? profile.username : user.email}</h1>

        <div className="grid grid-2">
          {/* Créer un concours */}
          <div className="card">
            <h2 style={{ marginTop: 0 }}>Créer un concours</h2>
            <div className="grid">
              <input
                className="input"
                placeholder="Nom du concours"
                value={newContestName}
                onChange={(e) => setNewContestName(e.target.value)}
              />
              <div className="btn-group">
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    if (!newContestName.trim()) {
                      toast('error', 'Indique un nom de concours.');
                      return;
                    }
                    setDraftContestName(newContestName.trim());
                    setCurrentPage('config');
                  }}
                >
                  Configurer
                </button>
              </div>
            </div>
          </div>

          {/* Rejoindre un concours */}
          <div className="card">
            <h2 style={{ marginTop: 0 }}>Rejoindre un concours</h2>
            <div className="grid">
              <input
                className="input"
                placeholder="Nom du concours"
                value={joinContestName}
                onChange={(e) => setJoinContestName(e.target.value)}
              />
              <div className="btn-group">
                <button className="btn btn-outline" onClick={joinContest}>Rejoindre</button>
              </div>
            </div>
          </div>
        </div>

        {/* Mes concours */}
        <div style={{ height: 12 }} />
        <h2>Mes concours</h2>
        {sorted.length === 0 ? (
          <p className="kpi">Aucun concours pour l’instant</p>
        ) : (
          <div className="grid" style={{ gap: 12 }}>
            {sorted.map((c) => (
              <MyContestCard key={c.code} contest={c} />
            ))}
          </div>
        )}
      </div>
      <Toasts />
    </>
  );
}
