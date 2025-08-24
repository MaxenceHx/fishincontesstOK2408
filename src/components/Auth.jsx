// src/components/Auth.jsx
import React, { useState } from 'react';
import { supabase } from '../lib/supabase';

export default function Auth({ onLogin }) {
  const [mode, setMode] = useState('login'); // "login" | "signup"
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  const checkUsernameAvailable = async (name) => {
    if (!name) return false;
    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', name)
      .limit(1);
    if (error) {
      console.error('Erreur vérif pseudo:', error);
      return false;
    }
    return (data?.length || 0) === 0;
  };

  // 🔐 Connexion (inchangé, OK déjà en OTP)
  const login = async () => {
    if (!email) return alert('Entre ton e-mail.');
    try {
      setLoading(true);
      const { error } = await supabase.auth.signInWithOtp({email});
      if (error) throw error;
      alert('Mail envoyé ! Clique le lien pour te connecter.');
    } catch (e) {
      console.error(e);
      alert('Impossible d’envoyer le mail de connexion.');
    } finally {
      setLoading(false);
    }
  };

  // 🆕 Création (utiliser OTP aussi, pas signUp)
  const signup = async () => {
    if (!email) return alert('Entre ton e-mail.');
    if (!username.trim()) return alert('Choisis un pseudo.');
    try {
      setLoading(true);

      // Vérifier l’unicité du pseudo avant d’envoyer le mail
      const { data: exists, error: checkErr } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', username.trim())
        .limit(1);

      if (checkErr) {
        console.error(checkErr);
        alert('Erreur lors de la vérification du pseudo.');
        setLoading(false);
        return;
      }
      if ((exists?.length || 0) > 0) {
        alert('Ce pseudo est déjà pris.');
        setLoading(false);
        return;
      }

      // ✅ Envoyer un magic link avec le pseudo souhaité dans user_metadata
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: origin,
          data: { desired_username: username.trim() },
        },
      });
      if (error) throw error;

      alert('Mail envoyé ! Clique le lien pour confirmer la création.');
    } catch (e) {
      console.error(e);
      alert('Impossible d’envoyer le mail de création.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="app-container"
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        background: '#f0f7ff',
        padding: 20,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 420,
          background: '#fff',
          padding: 20,
          borderRadius: 12,
          boxShadow: '0 10px 25px rgba(0,0,0,0.08)',
        }}
      >
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <button
            onClick={() => setMode('login')}
            style={{
              flex: 1,
              padding: '10px 12px',
              borderRadius: 8,
              border: '1px solid #ccc',
              background: mode === 'login' ? '#e6f0ff' : '#f6f6f6',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Se connecter
          </button>
          <button
            onClick={() => setMode('signup')}
            style={{
              flex: 1,
              padding: '10px 12px',
              borderRadius: 8,
              border: '1px solid #ccc',
              background: mode === 'signup' ? '#e6f0ff' : '#f6f6f6',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Créer un compte
          </button>
        </div>

        <div style={{ display: 'grid', gap: 12 }}>
          <div>
            <label
              style={{ fontWeight: 600, display: 'block', marginBottom: 6 }}
            >
              E-mail
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ton@mail.com"
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 8,
                border: '1px solid #ccc',
              }}
            />
          </div>

          {mode === 'signup' && (
            <div>
              <label
                style={{ fontWeight: 600, display: 'block', marginBottom: 6 }}
              >
                Pseudo (unique)
              </label>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Ex: BigFisher42"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 8,
                  border: '1px solid #ccc',
                }}
              />
              <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>
                Le pseudo sera figé après création (non modifiable).
              </div>
            </div>
          )}

          <button
            disabled={loading}
            onClick={mode === 'login' ? login : signup}
            style={{
              padding: '12px 14px',
              borderRadius: 8,
              border: 'none',
              background: '#007bff',
              color: '#fff',
              fontWeight: 700,
              cursor: 'pointer',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading
              ? 'Envoi en cours…'
              : mode === 'login'
              ? 'Recevoir le lien de connexion'
              : 'Recevoir le lien de création'}
          </button>
        </div>
      </div>
    </div>
  );
}
