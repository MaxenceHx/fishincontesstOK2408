// src/components/AdminPanel.jsx
import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';

export default function AdminPanel({ contestCode, onChanged }) {
    const [tab, setTab] = useState('moderation'); // moderation | rewards
    const [pending, setPending] = useState([]);
    const [loading, setLoading] = useState(true);

    const [rewards, setRewards] = useState({ 1: '', 2: '', 3: '' });
    const [savingRewards, setSavingRewards] = useState(false);

    const loadPending = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('catches')
            .select('id, user_id, fish_name, points, photo_path, created_at, catch_reports(count)')
            .eq('contest_code', contestCode)
            .eq('status', 'pending')
            .order('created_at', { ascending: true });
        if (error) { console.warn(error); setPending([]); }
        else {
            const list = (data || []).map(x => ({ ...x, _reports: x.catch_reports?.[0]?.count || 0 }));
            setPending(list);
        }
        setLoading(false);
    };

    // Remplace la fonction publicUrl dans AdminPanel.jsx
    const publicUrl = (path) => {
        if (!path) return '';
        if (/^https?:\/\//i.test(path)) return path;
        return '';
    };

    useEffect(() => { loadPending(); /* eslint-disable-next-line */ }, [contestCode]);

    useEffect(() => {
        (async () => {
            const { data } = await supabase
                .from('contest_rewards')
                .select('place, title')
                .eq('contest_code', contestCode);
            const map = { 1: '', 2: '', 3: '' };
            (data || []).forEach(r => { map[r.place] = r.title; });
            setRewards(map);
        })();
    }, [contestCode]);

    const moderate = async (id, status) => {
        const note = status === 'rejected' ? (prompt('Motif du refus ? (optionnel)') || null) : null;

        const { error } = await supabase.from('catches').update({ status }).eq('id', id);
        if (error) { console.warn(error); alert('Action refusée (droits?)'); return; }

        // log
        if (note) {
            await supabase.from('catch_moderations').insert([{ catch_id: id, new_status: status, note }]).catch(() => { });
        }

        await loadPending();
        onChanged && onChanged();
    };

    const saveRewards = async () => {
        setSavingRewards(true);
        try {
            const rows = [1, 2, 3].filter(p => rewards[p]).map(p => ({
                contest_code: contestCode, place: p, title: rewards[p]
            }));
            // upsert place by PK (contest_code, place)
            for (const r of rows) {
                await supabase.from('contest_rewards').upsert(r);
            }
            alert('Lots enregistrés.');
        } finally {
            setSavingRewards(false);
        }
    };

    const award = async () => {
        const { data, error } = await supabase.rpc('award_contest_winners', { p_code: contestCode });
        if (error) { console.warn(error); alert("Impossible de décerner (droits?)"); return; }
        alert(`Podium attribué.\n1er: ${data?.first || '—'}\n2e: ${data?.second || '—'}\n3e: ${data?.third || '—'}`);
        onChanged && onChanged();
    };

    return (
        <div>
            <div className="tabs" style={{ marginBottom: 10 }}>
                <button className={`tab ${tab === 'moderation' ? 'active' : ''}`} onClick={() => setTab('moderation')}>Modération</button>
                <button className={`tab ${tab === 'rewards' ? 'active' : ''}`} onClick={() => setTab('rewards')}>Récompenses</button>
            </div>

            {tab === 'moderation' && (
                <div style={{ display: 'grid', gap: 10 }}>
                    {loading && <div style={{ opacity: 0.7 }}>Chargement…</div>}
                    {!loading && pending.length === 0 && <div style={{ opacity: 0.7 }}>Aucune prise en attente.</div>}
                    {pending.map(row => (
                        <div key={row.id} className="discover-card">
                            <div style={{ display: 'flex', gap: 10 }}>
                                {row.photo_path ? <img src={publicUrl(row.photo_path)} alt="" className="thumb" /> : <div className="thumb" style={{ background: '#eee' }} />}
                                <div style={{ flex: 1 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <div><b>{row.fish_name || 'Poisson'}</b> · {row.points} pts</div>
                                        <div style={{ fontSize: 12, opacity: 0.75 }}>Signalements: {row._reports}</div>
                                    </div>
                                    <div style={{ fontSize: 12, opacity: 0.75 }}>{new Date(row.created_at).toLocaleString()} · {row.user_id.slice(0, 8)}…</div>
                                    <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                                        <button className="btn primary" onClick={() => moderate(row.id, 'approved')}>Valider</button>
                                        <button className="btn danger" onClick={() => moderate(row.id, 'rejected')}>Refuser</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {tab === 'rewards' && (
                <div style={{ display: 'grid', gap: 10 }}>
                    <div style={{ fontSize: 14, opacity: 0.85 }}>
                        Configure les lots IRL (1er/2e/3e). Puis clique “Décerner podium & badges”.
                    </div>
                    <div style={{ display: 'grid', gap: 8 }}>
                        {[1, 2, 3].map(p => (
                            <div key={p} style={{ display: 'grid', gap: 6 }}>
                                <label style={{ fontWeight: 600 }}>{p === 1 ? '🥇 1er' : p === 2 ? '🥈 2e' : '🥉 3e'}</label>
                                <input placeholder={`Lot pour ${p === 1 ? '1er' : p === 2 ? '2e' : '3e'}`} value={rewards[p] || ''} onChange={(e) => setRewards(r => ({ ...r, [p]: e.target.value }))} />
                            </div>
                        ))}
                    </div>
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                        <button className="btn" onClick={saveRewards} disabled={savingRewards}>{savingRewards ? 'Enregistrement…' : 'Enregistrer les lots'}</button>
                        <button className="btn primary" onClick={award}>Décerner podium & badges</button>
                    </div>
                </div>
            )}
        </div>
    );
}
