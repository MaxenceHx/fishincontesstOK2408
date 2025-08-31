// src/components/BottomNav.jsx
import React from 'react';

export default function BottomNav({ tab, onChange }) {
  const Item = ({ id, label, icon }) => (
    <button
      onClick={() => onChange(id)}
      className={`bn-item ${tab === id ? 'active' : ''}`}
      aria-label={label}
    >
      <div className="bn-icon" aria-hidden>{icon}</div>
      <div className="bn-label">{label}</div>
    </button>
  );

  return (
    <div className="bottom-nav">
      <Item id="home" label="Accueil" icon="🏠" />
      <Item id="discover" label="Découvrir" icon="🔎" />
      <Item id="activity" label="Activité" icon="📰" />
      <Item id="profile" label="Profil" icon="👤" />
    </div>
  );
}
