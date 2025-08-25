// src/components/ContestAdmin.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';

export default function ContestAdmin({ contestCode, user }) {
  const [isOwner, setIsOwner] = useState(false);
  const [rules, setRules] = useState(null);
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(true);
  const toast = (type, message) =>
    window.dispatchEvent(new CustomEvent('app:toast', { detail: { type, message } }));

  const loadAll = async () => {
    setLoading(true);
    try {
      const { data: c, error: cErr } = await supabase
        .from('contests')
        .select('created_by, rules')
        .eq('code', contestCode)
        .single();
      if (cErr) throw cErr;
      setIsOwner(c?.created_by === user?.id);
      setRules(c?.rules || {});

      if (c?.rules?.moderation_enabled) {
        const { data: p, error: pErr } = await supabase
          .from('catches')
          .select('id, user_id, fish_name, size_cm, points, status, photo_url, profiles(username, email)')
          .eq('contest_code', contestCode)
          .eq('status', 'pending')
          .order('id', { ascending: false });
        if (pErr) throw pErr;
        setPending(p || []);
      } else {
        setPending([]);
      }
    } catch (e) {
      console.error('Admin load error:', e);
      toast('error', 'Impossible de charger les données admin.');
    } finally { setLoading(false); }
  };

  useEffect(() => { if (contestCode && user?.id) loadAll(); }, [contestCode, user?.id]);

  const updateRules = async (patch) => {
    const next = { ...(rules || {}), ...patch };
    const { error } = await supabase.from('contests').update({ rules: next }).eq('code', contestCode);
    if (error) { toast('error', 'Échec de la mise à jour des règles.'); return; }
    setRules(next); toast('success', 'Règles mises à jour ✅');
  };

  const closeNow = async () => {
    const nowISO = new Date().toISOString();
    const wnd = { ...(rules?.window || {}) };
    wnd.end_at = nowISO;
    await updateRules({ window: wnd });
  };

  const reopen7d = async () => {
    const now = new Date();
    const wnd = { ...(rules?.window || {}) };
    wnd.start_at = wnd.start_at || now.toISOString();
    wnd.end_at = new Date(now.getTime() + 7 * 24 * 3600 * 1000).toISOString();
    await updateRules({ window: wnd });
  };

  const setModeration = async (enabled) => {
    await updateRules({ moderation_enabled: !!enabled });
    await loadAll();
  };

  const approve = async (id) => {
    const { error } = await supabase.from('catches').update({ status: 'approved' }).eq('id', id);
    if (error) { toast('error', 'Échec validation'); return; }
    setPending((list) => list.filter((x) => x.id !== id));
    toast('success', 'Capture approuvée ✅');
  };
  const reject = async (id) => {
    const { error } = await supabase.from('catches').update({ status: 'rejected' }).eq('id', id);
    if (error) { toast('error', 'Échec rejet'); return; }
    setPending((list) => list.filter((x) => x.id !== id));
    toast('success', 'Capture rejetée');
  };

  if (loading) return <div>Chargement admin…</div>;
  if (!isOwner) return <div style={{ opacity: 0.7 }}>Tu n’es pas l’organisateur de ce concours.</div>;

  const startAt = rules?.window?.start_at || null;
  const endAt = rules?.window?.end_at || null;

  return (
    <div style={{ marginTop: 16, display: 'grid', gap: 16 }}>
      <div style={{ background: '#fff', padding: 14, borderRadius: 10, boxShadow: '0 2px 6px rgba(0,0,0,0.08)' }}>
        <h3 style={{ marginTop: 0 }}>Gestion du concours</h3>
        <div style={{ fontSize: 13, opacity: 0.8, marginBottom: 8 }}>
          Fenêtre : {startAt ? new Date(startAt).toLocaleString() : '—'} → {endAt ? new Date(endAt).toLocaleString() : '—'}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={closeNow} style={{ background: '#ef4444', color: '#fff', padding: '8px 12px', borderRadius: 8 }}>
            Fermer maintenant
          </button>
          <button onClick={reopen7d} style={{ background: '#10b981', color: '#fff', padding: '8px 12px', borderRadius: 8 }}>
            Réouvrir pour 7 jours
          </button>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginLeft: 8 }}>
            <input type="checkbox" checked={!!rules?.moderation_enabled} onChange={(e) => setModeration(e.target.checked)} />
            Modération activée
          </label>
        </div>
      </div>

      {rules?.moderation_enabled && (
        <div style={{ background: '#fff', padding: 14, borderRadius: 10, boxShadow: '0 2px 6px rgba(0,0,0,0.08)' }}>
          <h3 style={{ marginTop: 0 }}>Modération — en attente ({pending.length})</h3>
          {pending.length === 0 ? (
            <div style={{ opacity: 0.7 }}>Aucune capture en attente.</div>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {pending.map((c) => (
                <div key={c.id}
                  style={{ display: 'grid', gridTemplateColumns: '96px 1fr auto', gap: 12, alignItems: 'center',
                    padding: 10, border: '1px solid #eee', borderRadius: 10 }}>
                  <div>
                    {c.photo_url ? (
                      <img src={c.photo_url} alt="" style={{ width: 96, height: 96, objectFit: 'cover', borderRadius: 8 }} />
                    ) : (
                      <div style={{ width: 96, height: 96, borderRadius: 8, background: '#f8fafc',
                        display: 'grid', placeItems: 'center', color: '#94a3b8', fontSize: 12 }}>Pas de photo</div>
                    )}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700 }}>{c.profiles?.username || c.profiles?.email || 'Utilisateur'}</div>
                    <div style={{ fontSize: 13, opacity: 0.8 }}>
                      {c.fish_name} · {c.size_cm ? `${c.size_cm} cm` : '—'} · {c.points} pts
                    </div>
                    <div style={{ fontSize: 12, opacity: 0.6 }}>Status: {c.status}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => approve(c.id)} style={{ background: '#10b981', color: '#fff', padding: '8px 12px', borderRadius: 8 }}>
                      Approuver
                    </button>
                    <button onClick={() => reject(c.id)} style={{ background: '#ef4444', color: '#fff', padding: '8px 12px', borderRadius: 8 }}>
                      Rejeter
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
