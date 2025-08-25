// src/components/NavBar.jsx
import React, { useEffect, useMemo, useState } from "react";

export default function NavBar({
  user,
  active = "home",                 // id actif (ex: "home", "mycatches", "profile", …)
  onNavigate,                       // (id) => void
  onLogout,                         // () => void
  links,                            // optionnel: [{id,label}], sinon on prend le default
  brand = { title: "FishingContest", emoji: "🎣" },
}) {
  const [open, setOpen] = useState(false);

  const L = useMemo(
    () =>
      links && links.length
        ? links
        : [
            { id: "home", label: "Accueil" },
            { id: "mycatches", label: "Mes captures" },
            { id: "invite", label: "Inviter" },
            { id: "create", label: "Créer" },
            { id: "join", label: "Rejoindre" },
            { id: "profile", label: "Profil" },
          ],
    [links]
  );

  // Fermer le drawer sur ESC
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Fermer quand on change d’orientation ou redimensionne (évite drawer bloqué)
  useEffect(() => {
    const onResize = () => setOpen(false);
    window.addEventListener("orientationchange", onResize);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("orientationchange", onResize);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  function handleNav(id) {
    setOpen(false);
    onNavigate?.(id);
  }

  function initialsFromUser(u) {
    const name = u?.user_metadata?.username || u?.email || "";
    const first = String(name).trim()[0] || "?";
    return first.toUpperCase();
  }

  return (
    <>
      <header className="navbar">
        {/* Burger (mobile) */}
        <button
          className="nav-toggle"
          aria-label="Ouvrir le menu"
          aria-expanded={open ? "true" : "false"}
          onClick={() => setOpen((v) => !v)}
        >
          <span className="nav-toggle-bar" />
          <span className="nav-toggle-bar" />
          <span className="nav-toggle-bar" />
        </button>

        {/* Brand */}
        <div className="nav-brand" onClick={() => handleNav("home")} role="button" tabIndex={0}>
          <span className="nav-brand-emoji">{brand.emoji}</span>
          <span className="nav-brand-title">{brand.title}</span>
        </div>

        <div className="spacer" />

        {/* Liens (desktop) */}
        <nav className="nav-links">
          {L.map((l) => (
            <button
              key={l.id}
              className={`nav-link ${active === l.id ? "is-active" : ""}`}
              onClick={() => handleNav(l.id)}
            >
              {l.label}
            </button>
          ))}
        </nav>

        {/* Profil / logout (icône) */}
        <div className="nav-user">
          {user ? (
            <>
              <div className="nav-avatar" title={user.email} onClick={() => handleNav("profile")}>
                {initialsFromUser(user)}
              </div>
              <button className="btn btn-ghost btn-sm hide-sm" onClick={onLogout}>
                Déconnexion
              </button>
            </>
          ) : null}
        </div>
      </header>

      {/* Drawer mobile */}
      <div
        className="nav-drawer"
        aria-hidden={open ? "false" : "true"}
        onClick={() => setOpen(false)}
      >
        <div className="nav-sheet" onClick={(e) => e.stopPropagation()}>
          <div className="nav-sheet-header">
            <div className="nav-brand">
              <span className="nav-brand-emoji">{brand.emoji}</span>
              <span className="nav-brand-title">{brand.title}</span>
            </div>
            <button className="nav-close" aria-label="Fermer" onClick={() => setOpen(false)}>
              ✕
            </button>
          </div>

          <div className="nav-sheet-links">
            {L.map((l) => (
              <button
                key={l.id}
                className={`nav-sheet-link ${active === l.id ? "is-active" : ""}`}
                onClick={() => handleNav(l.id)}
              >
                {l.label}
              </button>
            ))}
          </div>

          {user ? (
            <div className="nav-sheet-footer">
              <div className="nav-user-row">
                <div className="nav-avatar">{initialsFromUser(user)}</div>
                <div className="nav-user-meta">
                  <div className="nav-user-name">
                    {user.user_metadata?.username || user.email}
                  </div>
                  <div className="nav-user-email">{user.email}</div>
                </div>
              </div>
              <button className="btn btn-warning btn-block" onClick={onLogout}>
                Déconnexion
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}
