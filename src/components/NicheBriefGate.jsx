// src/components/NicheBriefGate.jsx
import { useState } from 'react';

function EditableList({ items, onChange }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {items.map((item, i) => (
        <input key={i} value={item} onChange={e => { const n = [...items]; n[i] = e.target.value; onChange(n); }} style={{ fontSize: 12 }} />
      ))}
    </div>
  );
}

export default function NicheBriefGate({ nicheBrief, topic, onChange, onBack, onConfirm }) {
  const [brief, setBrief] = useState(nicheBrief);
  const [loading, setLoading] = useState(false);

  const update = (key, val) => { const n = { ...brief, [key]: val }; setBrief(n); onChange(n); };

  async function confirm() {
    setLoading(true);
    onChange(brief);
    await onConfirm();
    setLoading(false);
  }

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 9, letterSpacing: '0.18em', color: 'var(--accentd)', marginBottom: 6 }}>GATE 1 — CONFIRM NICHE BRIEF</div>
        <div className="serif-heading">Your audience research</div>
        <p className="muted" style={{ marginTop: 6 }}>Review and edit anything that's off. This shapes every piece of content.</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="card">
          <div className="label">AUDIENCE</div>
          <textarea value={brief.audience} onChange={e => update('audience', e.target.value)} style={{ minHeight: 70, fontSize: 12 }} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div className="card">
            <div className="label">PAIN POINTS</div>
            <EditableList items={brief.pain_points} onChange={v => update('pain_points', v)} />
          </div>
          <div className="card">
            <div className="label">DESIRES</div>
            <EditableList items={brief.desires} onChange={v => update('desires', v)} />
          </div>
        </div>

        <div className="card">
          <div className="label">CONTENT PILLARS</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {brief.content_pillars.map((p, i) => (
              <div key={i} className="card-sm" style={{ background: 'var(--accentbg)' }}>
                <input value={p.name} onChange={e => { const ps = [...brief.content_pillars]; ps[i] = { ...ps[i], name: e.target.value }; update('content_pillars', ps); }} style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }} />
                <input value={p.description} onChange={e => { const ps = [...brief.content_pillars]; ps[i] = { ...ps[i], description: e.target.value }; update('content_pillars', ps); }} style={{ fontSize: 11 }} />
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div className="card">
            <div className="label">VOICE DESCRIPTOR</div>
            <input value={brief.voice_descriptor} onChange={e => update('voice_descriptor', e.target.value)} style={{ fontSize: 12 }} />
          </div>
          <div className="card">
            <div className="label">NICHE SLANG</div>
            <input value={brief.niche_slang?.join(', ')} onChange={e => update('niche_slang', e.target.value.split(',').map(s => s.trim()))} style={{ fontSize: 12 }} />
          </div>
        </div>

        <div className="card" style={{ background: 'var(--accentbg)' }}>
          <div className="label">VIRAL INSIGHT</div>
          <textarea value={brief.viral_insight} onChange={e => update('viral_insight', e.target.value)} style={{ minHeight: 50, fontSize: 12 }} />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, marginTop: 22 }}>
        <button className="btn btn-primary" onClick={confirm} disabled={loading}>{loading ? 'Saving...' : 'Confirmed — Plan the week →'}</button>
        <button className="btn btn-secondary" onClick={onBack}>← Back</button>
      </div>
    </div>
  );
}
