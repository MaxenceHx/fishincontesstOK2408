import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import Modal from '../components/Modal.jsx';

export default function ProfilePage({ user }) {
  const uid = user?.id;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [profile, setProfile] = useState(null);
  const [edit, setEdit] = useState(false);
  const [form, setForm] = useState({ handle:'', bio:'', avatar_url:'', city:'', country:'' });

  const [statsOpen, setStatsOpen] = useState(false);
  const [badgesOpen, setBadgesOpen] = useState(false);

  const [stats, setStats] = useState(null);
  const [badges, setBadges] = useState([]);
  const [history, setHistory] = useState([]);

  const initials = useMemo(() => {
    const base = form.handle?.trim() || user?.email || '';
    const m = base.match(/[A-Za-z]/g);
    return (m ? (m[0] + (m[1] || '')).toUpperCase() : 'U');
  }, [form.handle, user?.email]);

  useEffect(() => {
    if (!uid) return;
    let cancel = false;
    (async () => {
      setLoading(true);
      try {
        // Profil via RPC (crée si manquant)
        const { data: prof, error: pErr } = await supabase.rpc('get_my_profile');
        if (pErr) throw pErr;
        if (!cancel) {
          setProfile(prof || null);
          setForm({
            handle: prof?.handle || '',
            bio: prof?.bio || '',
            avatar_url: prof?.avatar_url || '',
            city: prof?.city || '',
            country: prof?.country || ''
          });
        }

        // Stats via RPC
        const { data: s } = await supabase.rpc('user_stats', { p_uid: uid });
        if (!cancel) setStats(s || null);

        // Badges (self policy ok)
        const { data: ub } = await supabase
          .from('user_badges')
          .select('badge_slug, contest_code, earned_at, badges ( name, emoji, description )')
          .eq('user_id', uid)
          .order('earned_at', { ascending: false });
        if (!cancel) setBadges(ub || []);

        // Historique (approved)
        const { data: hist } = await supabase
          .from('catches')
          .select('id, fish_name, points, contest_code, created_at, captured_at')
          .eq('user_id', uid)
          .eq('status', 'approved')
          .order('created_at', { ascending: false })
          .limit(15);
        if (!cancel) setHistory(hist || []);
      } catch (e) {
        console.warn(e);
        alert("Erreur de chargement du profil.");
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, [uid]);

  const onChange = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const saveProfile = async () => {
    setSaving(true);
    try {
      const { data, error } = await supabase.rpc('upsert_my_profile', {
        p_handle: form.handle?.trim() || null,
        p_bio: form.bio?.trim() || null,
        p_avatar_url: form.avatar_url?.trim() || null,
        p_city: form.city?.trim() || null,
        p_country: form.country?.trim() || null
      });
      if (error) {
        const msg = String(error.message || '');
        if (msg.includes('handle_taken')) alert('Ce pseudo est déjà pris.');
        else alert(msg || 'Erreur lors de la sauvegarde.');
        return;
      }
      setProfile(data);
      setForm({
        handle: data.handle || '',
        bio: data.bio || '',
        avatar_url: data.avatar_url || '',
        city: data.city || '',
        country: data.country || ''
      });
      setEdit(false);
    } catch (e) {
      console.warn(e);
      alert("Erreur lors de la sauvegarde.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <h2 style={{ marginBottom: 12 }}>Mon profil</h2>

      <div className="card" style={{ display:'grid', gap:10 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          {form.avatar_url ? (
            <img src={form.avatar_url} alt=""
                 style={{ width:64, height:64, borderRadius:12, objectFit:'cover', background:'#eee' }} />
          ) : (
            <div style={{ width:64, height:64, borderRadius:12, display:'grid', placeItems:'center',
                          background:'#e9ecef', fontWeight:700 }}>
              {initials}
            </div>
          )}
          <div style={{ flex:1 }}>
            <div style={{ fontSize:18, fontWeight:700 }}>
              {form.handle || user?.email || 'Utilisateur'}
            </div>
            {!!profile?.created_at && (
              <div style={{ fontSize:12, opacity:.7 }}>
                Inscrit le {new Date(profile.created_at).toLocaleDateString()}
              </div>
            )}
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <button className="btn" onClick={() => setStatsOpen(true)}>Statistiques</button>
            <button className="btn" onClick={() => setBadgesOpen(true)}>Badges</button>
          </div>
        </div>

        {!edit ? (
          <>
            {(form.bio || form.city || form.country || form.avatar_url) ? (
              <div style={{ display:'grid', gap:6 }}>
                {form.bio && <div style={{ whiteSpace:'pre-wrap' }}>{form.bio}</div>}
                {(form.city || form.country) && (
                  <div style={{ fontSize:13, opacity:.85 }}>
                    {form.city || ''}{form.city && form.country ? ', ' : ''}{form.country || ''}
                  </div>
                )}
                {form.avatar_url && (
                  <div style={{ fontSize:12, opacity:.7 }}>
                    Avatar: {truncate(form.avatar_url, 60)}
                  </div>
                )}
              </div>
            ) : (
              <div style={{ fontSize:14, opacity:.75 }}>
                Complète ton profil pour le rendre plus vivant.
              </div>
            )}
            <div style={{ display:'flex', justifyContent:'flex-end' }}>
              <button className="btn" onClick={() => setEdit(true)}>Modifier</button>
            </div>
          </>
        ) : (
          <div style={{ display:'grid', gap:8 }}>
            <input placeholder="Pseudo (unique)" value={form.handle}
                   onChange={e=>onChange('handle', e.target.value)} />
            <textarea placeholder="Bio" rows={3} value={form.bio}
                      onChange={e=>onChange('bio', e.target.value)} />
            <input placeholder="URL avatar (optionnel)" value={form.avatar_url}
                   onChange={e=>onChange('avatar_url', e.target.value)} />
            <div style={{ display:'grid', gap:8, gridTemplateColumns:'1fr 1fr' }}>
              <input placeholder="Ville" value={form.city}
                     onChange={e=>onChange('city', e.target.value)} />
              <input placeholder="Pays" value={form.country}
                     onChange={e=>onChange('country', e.target.value)} />
            </div>
            <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
              <button className="btn" onClick={() => {
                setEdit(false);
                setForm({
                  handle: profile?.handle || '',
                  bio: profile?.bio || '',
                  avatar_url: profile?.avatar_url || '',
                  city: profile?.city || '',
                  country: profile?.country || ''
                });
              }}>Annuler</button>
              <button className="btn primary" disabled={saving} onClick={saveProfile}>
                {saving ? 'Sauvegarde…' : 'Enregistrer'}
              </button>
            </div>
          </div>
        )}
      </div>

      <div style={{ marginTop:14 }}>
        <h3 style={{ marginBottom:8 }}>Historique (15 dernières prises)</h3>
        {loading ? (
          <div style={{ opacity:.7 }}>Chargement…</div>
        ) : history.length === 0 ? (
          <div style={{ opacity:.7 }}>Aucune prise validée pour l’instant.</div>
        ) : (
          <div style={{ display:'grid', gap:8 }}>
            {history.map(row => (
              <div key={row.id} className="discover-card" style={{ padding:10 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline' }}>
                  <div style={{ fontWeight:700 }}>{row.fish_name || 'Poisson'}</div>
                  <div style={{ fontSize:13, opacity:.85 }}>{row.points} pts</div>
                </div>
                <div style={{ fontSize:12, opacity:.8, marginTop:2 }}>
                  {row.contest_code ? `Concours ${row.contest_code}` : ''} · {new Date(row.created_at).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal open={statsOpen} title="Statistiques" onClose={()=>setStatsOpen(false)}>
        {!stats ? (
          <div style={{ opacity:.7 }}>Aucune donnée pour le moment.</div>
        ) : (
          <div style={{ display:'grid', gap:10 }}>
            <div className="card" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
              <Stat label="Captures" value={stats.captures ?? 0} />
              <Stat label="Points" value={stats.points ?? 0} />
            </div>
            {!!stats.topContests?.length && (
              <div className="card" style={{ display:'grid', gap:6 }}>
                <div style={{ fontWeight:700 }}>Meilleurs concours</div>
                {stats.topContests.map((t, i) => (
                  <div key={i} style={{ display:'flex', justifyContent:'space-between' }}>
                    <div>#{i+1} — {t.code}</div>
                    <div style={{ fontWeight:700 }}>{t.points} pts</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal open={badgesOpen} title="Badges" onClose={()=>setBadgesOpen(false)}>
        {badges.length === 0 ? (
          <div style={{ opacity:.7 }}>Aucun badge pour le moment.</div>
        ) : (
          <div style={{ display:'grid', gap:8 }}>
            {badges.map((b, i) => (
              <div key={i} className="card" style={{ display:'flex', alignItems:'center', gap:10 }}>
                <div style={{ fontSize:24 }}>{b.badges?.emoji || '🏅'}</div>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:700 }}>{b.badges?.name || b.badge_slug}</div>
                  <div style={{ fontSize:12, opacity:.8 }}>
                    {b.badges?.description || ''}{b.contest_code ? ` · Concours ${b.contest_code}` : ''}
                  </div>
                </div>
                <div style={{ fontSize:12, opacity:.7 }}>
                  {new Date(b.earned_at).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div style={{ padding:8, border:'1px solid #eee', borderRadius:8 }}>
      <div style={{ fontSize:12, opacity:.75 }}>{label}</div>
      <div style={{ fontSize:20, fontWeight:700 }}>{value}</div>
    </div>
  );
}
function truncate(s, n){ return !s ? '' : (s.length>n ? s.slice(0,n-1)+'…' : s); }

