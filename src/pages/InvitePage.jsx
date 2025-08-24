// src/pages/InvitePage.jsx
import React, { useMemo, useState } from 'react';

export default function InvitePage({ user }) {
  // Lien générique vers l'application (page d'accueil / login)
  const appLink = useMemo(() => {
    if (typeof window === 'undefined') return '';
    // tu peux pointer vers la racine ou une page de login si tu en as une
    return `${window.location.origin}/`;
  }, []);

  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(appLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (e) {
      console.error('Clipboard error:', e);
      alert('Impossible de copier le lien.');
    }
  };

  const sendMail = () => {
    const subject = encodeURIComponent(
      'Rejoins mon appli de concours de pêche !'
    );
    const body = encodeURIComponent(
      `Salut !\n\nJ'utilise cette application pour organiser des concours de pêche entre amis.\nRejoins-nous ici : ${appLink}\n\nÀ+`
    );
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  return (
    <div className="app-container" style={{ padding: 20 }}>
      <h1>Inviter des amis</h1>

      <p>
        Salut {user?.email || 'cher pêcheur'}, partage ce lien pour que tes amis{' '}
        <b>créent un compte</b> et rejoignent l’application.
      </p>

      <div
        style={{
          marginTop: 16,
          background: '#fff',
          padding: 16,
          borderRadius: 10,
          boxShadow: '0 2px 6px rgba(0,0,0,0.08)',
          display: 'flex',
          gap: 10,
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        <input
          readOnly
          value={appLink}
          style={{
            flex: '1 1 320px',
            minWidth: 260,
            padding: '10px 12px',
            borderRadius: 8,
            border: '1px solid #ccc',
          }}
        />
        <button
          onClick={copy}
          style={{
            padding: '10px 12px',
            borderRadius: 8,
            border: 'none',
            background: copied ? '#22c55e' : '#007bff',
            color: '#fff',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {copied ? 'Lien copié ✅' : 'Copier le lien'}
        </button>

        <button
          onClick={sendMail}
          style={{
            padding: '10px 12px',
            borderRadius: 8,
            border: 'none',
            background: '#ff9800',
            color: '#fff',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Envoyer par e-mail
        </button>
      </div>

      <p style={{ marginTop: 12, fontSize: 14, opacity: 0.8 }}>
        Astuce : tu peux coller ce lien dans WhatsApp, SMS, Messenger, etc.
      </p>
    </div>
  );
}
