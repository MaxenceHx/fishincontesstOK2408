// src/components/NavBar.jsx
import React from "react";

export default function NavBar({ onHome, onCatches, onInvite, onProfile, onReset, onLogout }) {
  return (
    <div className="navbar">
      <div className="navbar-inner container">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span className="badge" style={{ background: "#dbeafe", color: "#1e3a8a" }}>🎣</span>
          <strong>FishingContest</strong>
        </div>

        <div className="nav-links hide-sm">
          <button onClick={onHome}>Accueil</button>
          <button onClick={onCatches}>Mes captures</button>
          <button onClick={onInvite}>Inviter</button>
          <button onClick={onProfile}>Profil</button>
        </div>

        <div className="nav-links">
          <button className="btn" onClick={onReset} title="Réinitialiser la session">Réinit.</button>
          <button className="btn btn-danger" onClick={onLogout}>Déconnexion</button>
        </div>
      </div>
    </div>
  );
}
