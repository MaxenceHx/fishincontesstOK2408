import React, { useEffect, useState } from 'react';
import Leaderboard from '../components/Leaderboard.jsx';
import AddCatch from '../components/AddCatch.jsx';
import Modal from '../components/Modal.jsx';
import FAB from '../components/FAB.jsx';
import AdminPanel from '../components/AdminPanel.jsx';
import { supabase } from '../lib/supabase.js';

export default function ContestPage({ contest_code, user, onLeftContest }) {
  const [tab, setTab] = useState('infos'); // 'infos' | 'classement' | 'prises' | 'admin'
  const [refreshKey, setRefreshKey] = useState(0);
  const [openAdd, setOpenAdd] = useState(false);
  const [openLeave, setOpenLeave] = useState(false);

  const [infos, setInfos] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const [catches, setCatches] = useState([]);
  const [loadingCatches, setLoadingCatches] = useState(true);

  // Charger infos + déterminer le rôle (owner ou co-admin)
  // --- REMPLACE le useEffect qui pose isAdmin ---
useEffect(() => {
  let cancelled = false;
  (async () => {
    // (optionnel) tu peux garder ton fetch d'infos ici si nécessaire
    const { data: contest } = await supabase
      .from('contests')
      .select('name, type, starts_at, ends_at, created_by, description, region')
      .eq('code', contest_code)
      .single();
    if (!cancelled) setInfos(contest || null);

    // Détermine le rôle via la RPC (fiable)
    const { data: isAdm, error: admErr } = await supabase
      .rpc('is_contest_admin', { p_code: contest_code, p_uid: user.id });

    if (!cancelled) setIsAdmin(!!isAdm && !admErr);
  })();
  return () => { cancelled = true; };
}, [contest_code, user?.id]);

  // Liste des prises
  const fetchCatches = async () => {
    setLoadingCatches(true);
    const { data, error } = await supabase
      .from('catches')
      .select(`
        id, user_id, fish_name, points, status, photo_path, created_at, captured_at,
        catch_reports ( count )
      `)
      .eq('contest_code', contest_code)
      .order('created_at', { ascending: false })
      .limit(30);

    if (error) {
      console.warn(error);
      setCatches([]);
    } else {
      const list = (data || []).map(c => ({
        ...c,
        _reports: Array.isArray(c.catch_reports) ? (c.catch_reports[0]?.count || 0) : 0
      }));
      setCatches(list);
    }
    setLoadingCatches(false);
  };

  useEffect(() => { fetchCatches(); /* eslint-disable-next-line */ }, [contest_code, refreshKey]);

  const handleCatchAdded = () => {
    setRefreshKey(k => k + 1);
    setTab('classement');
  };

  const leaveContest = async () => {
    const { error } = await supabase
      .from('contest_members')
      .delete()
      .eq('contest_code', contest_code)
      .eq('user_id', user.id);
    if (error) { console.warn(error); alert("Impossible de quitter."); return; }
    setOpenLeave(false);
    onLeftContest && onLeftContest();
  };

  const reportCatch = async (row) => {
    const reason = prompt("Pourquoi signaler cette prise ? (optionnel)") || null;
    const { error } = await supabase
      .from('catch_reports')
      .insert([{ catch_id: row.id, reporter: user.id, reason }]);
    if (error) { console.warn(error); alert("Signalement impossible (déjà signalée ?)"); return; }
    alert("Merci ! Le modérateur sera notifié.");
    fetchCatches();
  };

  // Pas de Storage pour l’instant : on n’affiche que les URLs absolues
  const publicUrl = (path) => {
    if (!path) return '';
    if (/^https?:\/\//i.test(path)) return path;
    return '';
  };

  const StatusChip = ({ s }) => {
    const color = s === 'approved' ? '#16a34a' : s === 'rejected' ? '#dc2626' : '#f59e0b';
    const text  = s === 'approved' ? 'Validée'  : s === 'rejected' ? 'Refusée' : 'En attente';
    return <span className="status-chip" style={{ backgroundColor: color }}>{text}</span>;
  };

  const TabButton = ({ id, children }) => (
    <button className={`tab ${tab === id ? 'active' : ''}`} onClick={() => setTab(id)}>
      {children}
    </button>
  );

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:8 }}>
        <h2 style={{ marginBottom: 10 }}>{infos?.name || 'Concours'}</h2>
        
      </div>

      <div className="tabs">
        <TabButton id="infos">Infos</TabButton>
        <TabButton id="classement">Classement</TabButton>
        <TabButton id="prises">Prises</TabButton>
        {isAdmin && <TabButton id="admin">Administration</TabButton>}
      </div>

      <div style={{ marginTop: 12 }}>
        {tab === 'infos' && (
          <div>
            <p><b>Code :</b> {contest_code}</p>
            {infos?.type && <p><b>Type :</b> {labelType(infos.type)}</p>}
            {infos?.region && <p><b>Région :</b> {infos.region}</p>}
            {infos?.starts_at && <p><b>Début :</b> {new Date(infos.starts_at).toLocaleString()}</p>}
            {infos?.ends_at && <p><b>Fin :</b> {new Date(infos.ends_at).toLocaleString()}</p>}
            {infos?.description && <p style={{ marginTop: 8 }}>{infos.description}</p>}

            <div style={{ marginTop: 14 }}>
              <button className="btn danger" onClick={() => setOpenLeave(true)}>
                Quitter le concours
              </button>
            </div>
          </div>
        )}

        {tab === 'classement' && (
          <Leaderboard contestId={contest_code} refreshKey={refreshKey} />
        )}

        {tab === 'prises' && (
          <div style={{ display:'grid', gap:10 }}>
            {loadingCatches && <div style={{ opacity:0.7 }}>Chargement…</div>}
            {!loadingCatches && catches.length === 0 && (
              <div style={{ opacity:0.7 }}>Pas encore de prises.</div>
            )}
            {catches.map(row => (
              <div key={row.id} className="discover-card">
                <div style={{ display:'flex', gap:10 }}>
                  {row.photo_path ? (
                    <img src={publicUrl(row.photo_path)} alt="" className="thumb" />
                  ) : <div className="thumb" style={{ background:'#eee' }} />}
                  <div style={{ flex:1 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                      <div style={{ fontWeight:700 }}>{row.fish_name || 'Poisson'}</div>
                      <StatusChip s={row.status} />
                    </div>
                    <div style={{ fontSize:13, opacity:0.85, marginTop:2 }}>
                      {row.points} pts · {new Date(row.created_at).toLocaleString()}
                    </div>
                    {!!row._reports && (
                      <div style={{ fontSize:12, opacity:0.75, marginTop:2 }}>
                        Signalements : {row._reports}
                      </div>
                    )}
                    {row.user_id !== user.id && (
                      <div style={{ marginTop:8 }}>
                        <button className="btn" onClick={() => reportCatch(row)}>Signaler</button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'admin' && isAdmin && (
          <AdminPanel
            contestCode={contest_code}
            onChanged={() => { setRefreshKey(k => k + 1); fetchCatches(); }}
          />
        )}
      </div>

      {/* FAB pour ajouter une prise */}
      <FAB label="Ajouter une prise" onClick={() => setOpenAdd(true)} />

      <Modal open={openAdd} title="Ajouter une prise" onClose={() => setOpenAdd(false)}>
        <AddCatch
          contestId={contest_code}
          contestType={infos?.type}
          user={user}
          onCatchAdded={() => { setOpenAdd(false); handleCatchAdded(); }}
        />
      </Modal>

      {/* Confirmation quitter */}
      <Modal open={openLeave} title="Quitter le concours" onClose={() => setOpenLeave(false)}>
        <p>Tu es sûr de vouloir quitter ce concours ?</p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 10 }}>
          <button className="btn" onClick={() => setOpenLeave(false)}>Annuler</button>
          <button className="btn danger" onClick={leaveContest}>Quitter</button>
        </div>
      </Modal>
    </div>
  );
}

function labelType(t) {
  switch ((t || '').toLowerCase()) {
    case 'carna': return 'Carnassier';
    case 'carpe': return 'Carpe';
    case 'blanc': return 'Blanc';
    case 'expert': return 'Pro Multi-espèces';
    case 'perso':
    default: return 'Perso';
  }
}
