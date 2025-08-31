import React, { useMemo, useState } from 'react';

function CreateContestWizard({ onCancel, onSubmit }) {
  const [step, setStep] = useState(1);

  const [name, setName] = useState('');
  const [type, setType] = useState('perso'); // perso | carna | carpe | blanc | expert
  const [region, setRegion] = useState('');

  const [isPublic, setIsPublic] = useState(false);
  const [maxParticipants, setMaxParticipants] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');

  const [description, setDescription] = useState('');

  const [regionScope, setRegionScope] = useState('national'); // 'national'|'aappma'|'custom'
  const [regionLabel, setRegionLabel] = useState('');
  const [aappmaCode, setAappmaCode] = useState('');
  const [allowJoinBefore, setAllowJoinBefore] = useState(true);
  const [allowJoinDuring, setAllowJoinDuring] = useState(true); // ← autorisation pendant le live


  const step1Valid = useMemo(() => name.trim().length > 0, [name]);
  const step2Error =
    startsAt && endsAt && new Date(startsAt) > new Date(endsAt)
      ? 'La date de début doit être antérieure à la date de fin.'
      : '';

  const goNext = () => {
    if (step === 1 && !step1Valid) return;
    if (step === 2 && step2Error) return;
    setStep((s) => Math.min(3, s + 1));
  };
  const goPrev = () => setStep((s) => Math.max(1, s - 1));

  const submit = (e) => {
    e?.preventDefault?.();
    if (!step1Valid || step2Error) return;
    onSubmit?.({
      name: name.trim(),
      type,
      region: region.trim(),
      isPublic,
      maxParticipants: maxParticipants ? Number(maxParticipants) : null,
      startsAt: startsAt || null,
      endsAt: endsAt || null,
      description: description.trim(),
      regionScope, regionLabel: regionScope === 'custom' ? regionLabel : null,
      aappmaCode: regionScope === 'aappma' ? aappmaCode : null,
      maxParticipants: maxParticipants ? Number(maxParticipants) : null,
      allowJoinBefore, allowJoinDuring
    });
  });
};

return (
  <div className="wizard">
    <div className="wizard-stepper">
      <StepDot active={step >= 1} current={step === 1} label="Infos" num={1} />
      <Line active={step >= 2} />
      <StepDot active={step >= 2} current={step === 2} label="Paramètres" num={2} />
      <Line active={step >= 3} />
      <StepDot active={step >= 3} current={step === 3} label="Règles" num={3} />
    </div>

    <form onSubmit={submit} style={{ display: 'grid', gap: 12 }}>
      {step === 1 && (
        <section>
          <h4 style={{ marginBottom: 8 }}>Informations de base</h4>
          <div>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>
              Nom du concours *
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex : Lille Carnassier Summer"
            />
            {!step1Valid && (
              <div style={{ color: '#d00', fontSize: 12, marginTop: 4 }}>
                Le nom est requis.
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gap: 10, gridTemplateColumns: '1fr 1fr', marginTop: 10 }}>
            <div>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>
                Type
              </label>
              <select value={type} onChange={(e) => setType(e.target.value)}>
                <option value="perso">Perso</option>
                <option value="carna">Carnassier</option>
                <option value="carpe">Carpe</option>
                <option value="blanc">Blanc</option>
                <option value="expert">Pro Multi-espèces</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>
                Région
              </label>
              <input
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                placeholder="Ex : Hauts-de-France"
              />
            </div>
          </div>
        </section>
      )}

      {step === 2 && (
        <section>
          <h4 style={{ marginBottom: 8 }}>Paramètres</h4>

          <div style={{ display: 'grid', gap: 10, gridTemplateColumns: '1fr 1fr' }}>
            <div>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>
                Début
              </label>
              <input
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>
                Fin
              </label>
              <input
                type="datetime-local"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gap: 10, gridTemplateColumns: '1fr 1fr', marginTop: 10 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="checkbox"
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
              />
              Concours public
            </label>

            <div>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>
                Max participants
              </label>
              <input
                type="number"
                min="1"
                placeholder="illimité si vide"
                value={maxParticipants}
                onChange={(e) => setMaxParticipants(e.target.value)}
              />
            </div>
            <div className="card" style={{ display: 'grid', gap: 10 }}>
              <div style={{ fontWeight: 600 }}>Région</div>
              <label><input type="radio" name="region" checked={regionScope === 'national'} onChange={() => setRegionScope('national')} /> National</label>
              <label><input type="radio" name="region" checked={regionScope === 'aappma'} onChange={() => setRegionScope('aappma')} /> AAPPMA</label>
              {regionScope === 'aappma' && (
                <input placeholder="Code ou nom AAPPMA" value={aappmaCode} onChange={e => setAappmaCode(e.target.value)} />
              )}
              <label><input type="radio" name="region" checked={regionScope === 'custom'} onChange={() => setRegionScope('custom')} /> Libre</label>
              {regionScope === 'custom' && (
                <input placeholder="Nom de la région (texte libre)" value={regionLabel} onChange={e => setRegionLabel(e.target.value)} />
              )}
            </div>

            <div className="grid-2">
              <div className="card">
                <div style={{ fontWeight: 600 }}>Capacité</div>
                <input type="number" min="1" placeholder="Max participants (optionnel)"
                  value={maxParticipants} onChange={e => setMaxParticipants(e.target.value)} />
              </div>
              <div className="card">
                <div style={{ fontWeight: 600 }}>Inscriptions</div>
                <label><input type="checkbox" checked={allowJoinBefore} onChange={e => setAllowJoinBefore(e.target.checked)} /> Autoriser avant le début</label>
                <label><input type="checkbox" checked={allowJoinDuring} onChange={e => setAllowJoinDuring(e.target.checked)} /> Autoriser pendant le live</label>
              </div>
            </div>

          </div>

          {!!step2Error && (
            <div style={{ color: '#d00', fontSize: 12, marginTop: 6 }}>
              {step2Error}
            </div>
          )}
        </section>
      )}

      {step === 3 && (
        <section>
          <h4 style={{ marginBottom: 8 }}>Règles & aperçu</h4>

          <div>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>
              Description / règles
            </label>
            <textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Règles, espèces ciblées, lots…"
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 8,
                border: '1px solid #ccc',
              }}
            />
          </div>

          <div className="wizard-summary">
            <h5>Aperçu</h5>
            <ul>
              <li><b>Nom :</b> {name || '—'}</li>
              <li><b>Type :</b> {labelType(type)}</li>
              <li><b>Région :</b> {region || '—'}</li>
              <li><b>Public :</b> {isPublic ? 'Oui' : 'Non'}</li>
              <li><b>Participants max :</b> {maxParticipants ? maxParticipants : 'Illimité'}</li>
              <li>
                <b>Période :</b>{' '}
                {startsAt ? new Date(startsAt).toLocaleString() : '—'} →{' '}
                {endsAt ? new Date(endsAt).toLocaleString() : '—'}
              </li>
            </ul>
          </div>
        </section>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
        <button type="button" className="btn" onClick={onCancel}>Annuler</button>
        <div style={{ display: 'flex', gap: 8 }}>
          {step > 1 && (
            <button type="button" className="btn" onClick={goPrev}>Précédent</button>
          )}
          {step < 3 && (
            <button
              type="button"
              className="btn primary"
              onClick={goNext}
              disabled={(step === 1 && !step1Valid) || (step === 2 && !!step2Error)}
            >
              Suivant
            </button>
          )}
          {step === 3 && (
            <button
              type="submit"
              className="btn primary"
              disabled={!step1Valid || !!step2Error}
              title={!step1Valid ? 'Le nom est requis' : undefined}
            >
              Créer le concours
            </button>
          )}
        </div>
      </div>
    </form>
  </div>
);
}

function StepDot({ active, current, label, num }) {
  return (
    <div className={`step ${active ? 'active' : ''} ${current ? 'current' : ''}`}>
      <div className="dot">{num}</div>
      <div className="slabel">{label}</div>
    </div>
  );
}
function Line({ active }) { return <div className={`sline ${active ? 'active' : ''}`} />; }
function labelType(t) {
  switch ((t || '').toLowerCase()) {
    case 'carna': return 'Carnassier';
    case 'carpe': return 'Carpe';
    case 'blanc': return 'Blanc';
    case 'expert': return 'Pro Multi-espèces';
    default: return 'Perso';
  }
}

export default CreateContestWizard;
