import React from 'react';
export default function FAB({ label = 'Ajouter', onClick }) {
  return (
    <button className="fab" onClick={onClick} aria-label={label} title={label}>
      +
    </button>
  );
}
