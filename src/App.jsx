// src/App.jsx
import React, { useEffect, useState } from 'react';
import { supabase } from './lib/supabase.js';

import Auth from './components/Auth.jsx';
import ContestPage from './pages/ContestPage.jsx';
import DiscoverPage from './pages/DiscoverPage.jsx';
import ActivityPage from './pages/ActivityPage.jsx';
import ProfilePage from './pages/ProfilePage.jsx';
import BottomNav from './components/BottomNav.jsx';
import Modal from './components/Modal.jsx';
import CreateContestWizard from './components/CreateContestWizard.jsx';

// --- helpers UI ---
const Card = ({ children }) => (
  <div
    style={{
      background: '#fff',
      borderRadius: 12,
      padding: 14,
      boxShadow: '0 2px 10px rgba(0,0,0,0.06)',
    }}
  >
    {children}
  </div>
);

export default function App() {
  // auth
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);

  // nav
  const [tab, setTab] = useState('home'); // 'home' | 'discover' | 'activity' | 'profile'
  const [activeContest, setActiveContest] = useState(null); // {code,name}

  // data
  const [contests, setContests] = useState([]);

  // modales
  const [openCreate, setOpenCreate] = useState(false);
  const [openJoin, setOpenJoin] = useState(false);
  const [openInvite, setOpenInvite] = useState(false);

  // forms
  const [joinContestName, setJoinContestName] = useState('');

  // états liste concours
  const [joinedCodes, setJoinedCodes] = useState(new Set()); // Set des codes auxquels je participe
  const [isLoadingContests, setIsLoadingContests] = useState(false);

  // ---------------------------
  // Auth init + listener
  // ---------------------------
  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const u = data?.session?.user ?? null;
        if (!cancelled) setUser(u);
      } finally {
        if (typeof window !== 'undefined' && window.location.hash) {
          window.history.replaceState({}, '', window.location.pathname + window.location.search);
        }
        if (!cancelled) setAuthReady(true);
      }
    };
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
      setUser(session?.user ?? null);
      setAuthReady(true);
    });
    init();
    return () => sub.subscription.unsubscribe();
  }, []);

  // fetch mes concours
  const fetchMyContests = async () => {
    try {
      setIsLoadingContests(true);

      // 1) Mes adhésions -> codes
      const { data: memberships, error: memErr } = await supabase
        .from('contest_members')
        .select('contest_code')
        .eq('user_id', user.id);
      if (memErr) throw memErr;

      const codes = (memberships || []).map((m) => m.contest_code);
      setJoinedCodes(new Set(codes));

      if (codes.length === 0) {
        setContests([]);
        return;
      }

      // 2) Détails concours (⚠️ SANS "contest_members(count)")
      const { data: list, error: cErr } = await supabase
        .from('contests')
        .select('name, code, type, region, max_participants, starts_at, ends_at')
        .in('code', codes);
      if (cErr) throw cErr;

      // 3) Comptes "participants" via RPC (bypasse RLS)
      const { data: counts, error: rcErr } = await supabase
        .rpc('members_count_bulk', { p_codes: codes });
      if (rcErr) throw rcErr;

      const countMap = new Map((counts || []).map((r) => [r.contest_code, r.members]));
      const hydrated = (list || []).map((c) => ({
        ...c,
        _members: countMap.get(c.code) ?? 0,
      }));
      setContests(hydrated);
    } catch (e) {
      console.warn('fetch contests error', e);
      try {
        const { data: sess } = await supabase.auth.getSession();
        if (!sess?.session) await supabase.auth.signOut();
      } catch {}
    } finally {
      setIsLoadingContests(false);
    }
  };

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      if (!cancelled) await fetchMyContests();
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  // utils
  const generateContestCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let out = '';
    for (let i = 0; i < 6; i++) out += chars[Math.floor(Math.random() * chars.length)];
    return out;
  };

  const logout = async () => {
    try {
      await supabase.auth.signOut();
    } finally {
      try {
        if (typeof window !== 'undefined') {
          sessionStorage.removeItem('fc_auth_dev_v1'); // purge (fusion reset)
        }
      } catch {}
      setUser(null);
      setActiveContest(null);
      setTab('home');
    }
  };

  // actions
  const createContest = async (form) => {
    const name = form?.name?.trim();
    if (!name) return;

    try {
      const code = generateContestCode();
      const insert = {
        name,
        created_by: user.id,
        code,
        // nouveaux champs
        type: form?.type || null,
        region: form?.region || null,
        is_public: !!form?.isPublic,
        max_participants: form?.maxParticipants ?? null,
        starts_at: form?.startsAt || null,
        ends_at: form?.endsAt || null,
        description: form?.description || null,
        region_scope: form.regionScope,
        region_label: form.regionScope === 'custom' ? form.regionLabel : null,
        aappma_code: form.regionScope === 'aappma' ? form.aappmaCode : null,
        max_participants: form.maxParticipants ?? null,
        allow_join_before: !!form.allowJoinBefore,
        allow_join_during: !!form.allowJoinDuring,
      };

      const { data: contest, error: createErr } = await supabase
        .from('contests')
        .insert([insert])
        .select()
        .single();
      if (createErr) throw createErr;

      const { error: memErr } = await supabase
        .from('contest_members')
        .insert([{ contest_code: contest.code, user_id: user.id }]);
      if (memErr) throw memErr;

      setOpenCreate(false);
      setContests((prev) => [{ name: contest.name, code: contest.code }, ...prev]);
      setActiveContest({ name: contest.name, code: contest.code });
    } catch (e) {
      alert(e.message || 'Erreur création concours');
    }
  };

  const joinContest = async () => {
    if (!joinContestName.trim()) return;
    try {
      const { data: contest, error: findErr } = await supabase
        .from('contests')
        .select('code, name, ends_at')
        .eq('name', joinContestName.trim())
        .single();
      if (findErr || !contest) throw new Error('Concours introuvable');

      // Blocage si terminé
      if (contest.ends_at && Date.now() > new Date(contest.ends_at).getTime()) {
        alert('Concours terminé : impossible de rejoindre.');
        return;
      }

      const { error: insErr } = await supabase
        .from('contest_members')
        .insert([{ contest_code: contest.code, user_id: user.id }]);
      if (insErr) throw insErr;

      setJoinContestName('');
      setOpenJoin(false);
      setContests((prev) => [{ name: contest.name, code: contest.code }, ...prev]);
      setActiveContest(contest);
    } catch (e) {
      alert(e.message || 'Erreur rejoindre concours');
    }
  };

  // ---------------------------
  // UI
  // ---------------------------
  if (!authReady) return <div style={{ padding: 20 }}>Initialisation…</div>;
  if (!user) return <Auth onLogin={setUser} />;

  const HomeScreen = () => (
    <div className="app-container" style={{ paddingBottom: 84 }}>
      <header style={{ marginBottom: 14 }}>
        <h1 style={{ fontSize: 26, lineHeight: '1.1' }}>
          Bonjour {user.user_metadata?.desired_username || user.email}
        </h1>
        <div style={{ opacity: 0.8, marginTop: 6 }}>Qu’avez-vous pêché aujourd’hui ?</div>
      </header>

      <div style={{ display: 'grid', gap: 10 }}>
        {contests.length === 0 && <div style={{ opacity: 0.7 }}>Aucun concours pour l’instant.</div>}

        {contests.map((c) => {
          const now = Date.now();
          const s = c.starts_at ? new Date(c.starts_at).getTime() : null;
          const e = c.ends_at ? new Date(c.ends_at).getTime() : null;

          // état réel
          const live =
            (s && e && now >= s && now <= e) ||
            (s && !e && now >= s) ||
            (!s && e && now <= e);
          const soon = !!(s && now < s);
          const ended = !!(e && now > e);
          const label = ended ? 'Terminé' : live ? 'Live' : soon ? 'Bientôt' : 'Ouvert';

          const cap = c.max_participants ?? null;
          const members = c._members ?? 0;

          return (
            <Card key={c.code}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                <div style={{ fontWeight: 700, fontSize: 16 }}>{c.name}</div>
                <div
                  style={{
                    color: ended ? '#6b7280' : live ? '#16a34a' : soon ? '#f59e0b' : '#16a34a',
                    fontWeight: 700,
                  }}
                >
                  {label}
                </div>
              </div>
              <div style={{ marginTop: 6, fontSize: 13, opacity: 0.85 }}>
                {c.type ? `Type : ${labelType(c.type)} · ` : ''}
                {c.region || 'Région N/A'}
              </div>
              <div style={{ marginTop: 4, fontSize: 13, opacity: 0.9 }}>
                {cap ? `${members}/${cap} inscrits` : `${members} inscrits`}
              </div>
              <div style={{ marginTop: 10, display: 'flex', gap: 10 }}>
                <button onClick={() => setActiveContest(c)} className="btn primary">
                  Ouvrir
                </button>
                <button onClick={() => setOpenInvite(true)} className="btn" title="Inviter">
                  👤➕ Inviter
                </button>
              </div>
            </Card>
          );
        })}
      </div>

      <div className="home-cta-bar">
        <button className="btn primary" onClick={() => setOpenCreate(true)}>
          Créer +
        </button>
        <button className="btn" onClick={() => setOpenJoin(true)}>
          Rejoindre
        </button>
      </div>
    </div>
  );

  // util local pour les labels (même mapping que Discover/Contest)
  function labelType(t) {
    switch ((t || '').toLowerCase()) {
      case 'carna':
        return 'Carnassier';
      case 'carpe':
        return 'Carpe';
      case 'blanc':
        return 'Blanc';
      case 'expert':
        return 'Pro Multi-espèces';
      default:
        return 'Perso';
    }
  }

  // Bouton Déconnexion (affiché UNIQUEMENT sur Profil)
  const topRightLogout = (
    <div style={{ position: 'fixed', right: 14, top: 14, zIndex: 5 }}>
      <button className="btn danger" onClick={logout}>
        Déconnexion
      </button>
    </div>
  );

  return (
    <>
      {/* 🔒 N’AFFICHE PAS le bouton ici globalement */}
      {/* {topRightLogout} */}

      {!activeContest && tab === 'home' && <HomeScreen />}

      {!activeContest && tab === 'discover' && (
        <div className="app-container" style={{ paddingBottom: 84 }}>
          <DiscoverPage
            user={user}
            joinedCodes={new Set(contests.map((c) => c.code))}
            onJoined={async () => {
              await fetchMyContests();
              setTab('home');
            }}
            onOpenCreate={() => setOpenCreate(true)}
          />
        </div>
      )}

      {!activeContest && tab === 'activity' && (
        <div className="app-container" style={{ paddingBottom: 84 }}>
          <ActivityPage />
        </div>
      )}

      {!activeContest && tab === 'profile' && (
        <div className="app-container" style={{ paddingBottom: 84 }}>
          {/* ✅ Bouton visible UNIQUEMENT sur l’onglet Profil */}
          {topRightLogout}
          <ProfilePage user={user} />
        </div>
      )}

      {activeContest && (
        <div className="app-container" style={{ paddingBottom: 84 }}>
          <button className="btn" onClick={() => setActiveContest(null)} style={{ marginBottom: 10 }}>
            ← Retour
          </button>
          <ContestPage
            user={user}
            contest_code={activeContest.code}
            onLeftContest={async () => {
              setActiveContest(null);
              await fetchMyContests();
              setTab('home');
            }}
          />
        </div>
      )}

      {/* Bottom nav */}
      <BottomNav
        tab={tab}
        onChange={(id) => {
          setActiveContest(null);
          setTab(id);
        }}
      />

      {/* Modales */}
      <Modal open={openCreate} title="Créer un concours" onClose={() => setOpenCreate(false)}>
        <CreateContestWizard onCancel={() => setOpenCreate(false)} onSubmit={createContest} />
      </Modal>

      <Modal open={openJoin} title="Rejoindre un concours" onClose={() => setOpenJoin(false)}>
        <div style={{ display: 'grid', gap: 10 }}>
          <input
            placeholder="Nom du concours"
            value={joinContestName}
            onChange={(e) => setJoinContestName(e.target.value)}
          />
          <button className="btn primary" onClick={joinContest}>
            Rejoindre
          </button>
        </div>
      </Modal>

      <Modal open={openInvite} title="Inviter des amis" onClose={() => setOpenInvite(false)}>
        <InviteContent />
      </Modal>
    </>
  );
}

// --- contenu invite ---
function InviteContent() {
  const [copied, setCopied] = useState(false);
  const appLink = typeof window !== 'undefined' ? `${window.location.origin}/` : '';

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(appLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      alert('Impossible de copier le lien.');
    }
  };

  const sendMail = () => {
    const subject = encodeURIComponent('Rejoins mon appli de concours de pêche !');
    const body = encodeURIComponent(`Salut !\n\nRejoins-nous ici : ${appLink}\n\nÀ+`);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <input readOnly value={appLink} />
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn primary" onClick={copy}>
          {copied ? 'Lien copié ✅' : 'Copier le lien'}
        </button>
        <button className="btn" onClick={sendMail}>
          Envoyer par e-mail
        </button>
      </div>
    </div>
  );
}
