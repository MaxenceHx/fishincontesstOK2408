import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase.js';

export default function DiscoverPage({
  user,
  joinedCodes: joinedCodesProp = new Set(), // Set de codes déjà rejoints (optionnel)
  onJoined,                                   // callback pour rafraîchir "Mes concours"
  onOpenCreate,                                // ouvre le wizard "Créer"
}) {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(false);

  // barre de recherche locale
  const [query, setQuery] = useState('');

  // normaliser joinedCodes en Set
  const joinedCodes = useMemo(() => {
    return joinedCodesProp instanceof Set ? joinedCodesProp : new Set(joinedCodesProp || []);
  }, [joinedCodesProp]);

  useEffect(() => {
    fetchList(); // chargement initial
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchList = async () => {
    try {
      setLoading(true);

      // 1) Tenter la RPC discover_contests (renvoie aussi state + members)
      const { data: rpcData, error: rpcErr } = await supabase.rpc('discover_contests', {
        p_types: null,
        p_state: null,
        p_region_scope: null,
        p_aappma_code: null,
        p_search: query || null,
        p_page: 1,
        p_size: 60,
      });

      if (!rpcErr && Array.isArray(rpcData)) {
        setList(rpcData);
        return;
      }

      // 2) Repli: SELECT simple sur contests (sans members)
      const { data, error } = await supabase
        .from('contests')
        .select('name,code,type,region,max_participants,starts_at,ends_at') // ⚠️ pas de virgule finale
        .eq('is_public', true)
        .ilike('name', `%${query || ''}%`)
        .limit(60);

      if (error) throw error;

      const enriched = (data || []).map((c) => ({
        ...c,
        state: computeContestState(c.starts_at, c.ends_at),
        members: null, // inconnu en mode repli
      }));
      setList(enriched);
    } catch (e) {
      console.warn('discover fetch error', e);
      setList([]);
    } finally {
      setLoading(false);
    }
  };

  const join = async (code) => {
    try {
      const { data, error } = await supabase.rpc('join_contest', { p_code: code });
      if (error) throw error;
      if (!data?.ok) {
        const msg =
          {
            already_joined: 'Déjà inscrit',
            ended: 'Concours terminé',
            not_open_yet: "Ouverture non commencée",
            live_join_forbidden: 'Inscription pendant le live interdite',
            full: 'Complet',
            not_found_or_private: 'Concours introuvable',
          }[data?.reason] || 'Impossible de rejoindre';
        alert(msg);
        return;
      }
      // succès
      onJoined && (await onJoined()); // rafraîchir "Mes concours"
      fetchList(); // rafraîchir la liste Discover
    } catch (e) {
      console.warn(e);
      alert("Erreur lors de l'inscription au concours.");
    }
  };

  const onSubmitSearch = (e) => {
    e.preventDefault();
    fetchList();
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
        <form onSubmit={onSubmitSearch} style={{ display: 'flex', gap: 8, flex: 1 }}>
          <input
            placeholder="Rechercher un concours…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ flex: 1 }}
          />
          <button className="btn" type="submit">Rechercher</button>
        </form>
        <button className="btn primary" onClick={onOpenCreate}>Créer</button>
      </div>

      {loading ? (
        <div style={{ opacity: 0.7 }}>Chargement…</div>
      ) : list.length === 0 ? (
        <div style={{ opacity: 0.7 }}>Aucun concours trouvé.</div>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {list.map((c) => {
            const state = c.state || computeContestState(c.starts_at, c.ends_at);
            const isEnded = state === 'ended';
            const already = joinedCodes.has(c.code);
            const isFull =
              c.max_participants != null &&
              typeof c.members === 'number' &&
              c.members >= c.max_participants;

            const disabled = already || isEnded || isFull;

            return (
              <div key={c.code} className="discover-card">
                <div className="discover-card__head">
                  <div className="discover-card__title">{c.name}</div>
                  <div className={`chip ${chipClass(state)}`}>
                    {stateLabel(state)}
                  </div>
                </div>
                <div className="discover-card__meta">
                  <span>Type: {humanType(c.type)}</span>
                  {typeof c.members === 'number' && c.max_participants != null ? (
                    <span>· {c.members}/{c.max_participants}</span>
                  ) : c.max_participants != null ? (
                    <span>· Capacité: {c.max_participants}</span>
                  ) : null}
                </div>
                <div className="discover-card__actions">
                  <button
                    className={`btn ${disabled ? '' : 'primary'}`}
                    disabled={disabled}
                    onClick={() => join(c.code)}
                  >
                    {already ? 'Déjà rejoint' : isEnded ? 'Terminé' : isFull ? 'Complet' : 'Rejoindre'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function computeContestState(starts_at, ends_at) {
  const now = new Date();
  const s = starts_at ? new Date(starts_at) : null;
  const e = ends_at ? new Date(ends_at) : null;
  if (e && now > e) return 'ended';
  if (s && now < s) return 'soon';
  return 'live';
}

function stateLabel(s) {
  return s === 'live' ? 'Ouvert'
       : s === 'soon' ? 'Bientôt'
       : 'Terminé';
}

function chipClass(s) {
  return s === 'live' ? 'chip--live'
       : s === 'soon' ? 'chip--soon'
       : 'chip--ended';
}

function humanType(t) {
  switch ((t || '').toLowerCase()) {
    case 'carna': return 'Carnassier';
    case 'carpe': return 'Carpe';
    case 'blanc': return 'Poissons blancs';
    case 'expert': return 'Pro multi-espèces';
    case 'perso': return 'Perso';
    default: return t || '—';
  }
}
