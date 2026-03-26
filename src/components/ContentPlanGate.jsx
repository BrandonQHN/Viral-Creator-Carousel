// src/components/ContentPlanGate.jsx
import { useState, useEffect } from 'react';
import { api } from '../lib/api';

const FORMATS = ['mistakes_list','tips_list','how_to_guide','myth_busting','deep_dive','comparison','story_lesson','quick_wins'];

const FORMAT_RANGES = {
  mistakes_list: [8,10], tips_list: [6,9], how_to_guide: [5,8],
  myth_busting: [5,7], deep_dive: [4,6], comparison: [4,6],
  story_lesson: [4,5], quick_wins: [5,7],
};

export default function ContentPlanGate({ sessionId, nicheBrief, onBack, onConfirm }) {
  const [plan, setPlan]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState('');
  const [regenIdx, setRegenIdx] = useState(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true); setError('');
    try {
      const plan = await api.generatePlan(sessionId, nicheBrief);
      setPlan(plan);
    } catch (e) { setError(e.message); }
    setLoading(false);
  }

  function updateRow(i, key, val) {
    setPlan(p => { const n = [...p]; n[i] = { ...n[i], [key]: val }; return n; });
  }

  function addRow() {
    setPlan(p => [...p, { carousel_num: p.length + 1, pillar: nicheBrief.content_pillars[0]?.name || '', format: 'tips_list', hook: 'New carousel hook', topic: 'New topic', angle: 'New angle', recommended_slides: 7, rationale: '' }]);
  }

  function removeRow(i) { setPlan(p => p.filter((_, idx) => idx !== i).map((r, idx) => ({ ...r, carousel_num: idx + 1 }))); }

  async function regenRow(i) {
    setRegenIdx(i);
    try {
      const data = await api.generatePlan(sessionId, nicheBrief);
      const newRow = data.content_plan[i] || data.content_plan[0];
      updateRow(i, 'hook', newRow.hook);
      updateRow(i, 'angle', newRow.angle);
      updateRow(i, 'topic', newRow.topic);
    } catch (e) { setError(e.message); }
    setRegenIdx(null);
  }

  if (loading) return <div className="card" style={{ textAlign: 'center', padding: 60 }}><p className="muted">Planning your content week...</p></div>;

  if (!plan) return (
    <div>
      {error && <div className="err-box" style={{ marginBottom: 16 }}>{error}</div>}
      <div className="card" style={{ textAlign: 'center', padding: 40 }}>
        <p className="muted" style={{ marginBottom: 16 }}>Failed to generate content plan. Check Netlify env vars then retry.</p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <button className="btn btn-primary" onClick={load}>Retry</button>
          <button className="btn btn-secondary" onClick={onBack}>← Back</button>
        </div>
      </div>
    </div>
  );

  const totalSlides = plan?.reduce((sum, c) => sum + (c.recommended_slides || 7), 0) || 0;

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 9, letterSpacing: '0.18em', color: 'var(--accentd)', marginBottom: 6 }}>GATE 2 — CONTENT PLAN</div>
        <div className="serif-heading">Your {plan?.length}-carousel week</div>
        <p className="muted" style={{ marginTop: 6 }}>Edit hooks, formats, and slide counts. Add or remove carousels. This is the plan we'll write copy for.</p>
      </div>

      {error && <div className="err-box">{error}</div>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
        {plan?.map((carousel, i) => {
          const [min, max] = FORMAT_RANGES[carousel.format] || [4, 10];
          return (
            <div key={i} className="card" style={{ display: 'grid', gridTemplateColumns: '24px 1fr 1fr 160px 100px 80px 36px', gap: 10, alignItems: 'start' }}>
              <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--accentbg)', border: '1px solid var(--accentd)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: 'var(--accent)', fontWeight: 700, flexShrink: 0, marginTop: 2 }}>{i + 1}</div>
              <div>
                <div className="label">HOOK</div>
                <input value={carousel.hook} onChange={e => updateRow(i, 'hook', e.target.value)} style={{ fontSize: 12 }} />
              </div>
              <div>
                <div className="label">TOPIC / ANGLE</div>
                <input value={carousel.topic} onChange={e => updateRow(i, 'topic', e.target.value)} style={{ fontSize: 12, marginBottom: 6 }} />
                <input value={carousel.angle} onChange={e => updateRow(i, 'angle', e.target.value)} style={{ fontSize: 11, color: 'var(--muted)' }} />
              </div>
              <div>
                <div className="label">FORMAT</div>
                <select value={carousel.format} onChange={e => { updateRow(i, 'format', e.target.value); const [mn] = FORMAT_RANGES[e.target.value] || [5]; updateRow(i, 'recommended_slides', mn + 1); }}>
                  {FORMATS.map(f => <option key={f} value={f}>{f.replace(/_/g, ' ')}</option>)}
                </select>
              </div>
              <div>
                <div className="label">SLIDES</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <button onClick={() => updateRow(i, 'recommended_slides', Math.max(min, carousel.recommended_slides - 1))} className="btn btn-secondary" style={{ padding: '6px 10px', width: 30 }}>−</button>
                  <span style={{ fontSize: 15, fontWeight: 700, minWidth: 20, textAlign: 'center' }}>{carousel.recommended_slides}</span>
                  <button onClick={() => updateRow(i, 'recommended_slides', Math.min(max, carousel.recommended_slides + 1))} className="btn btn-secondary" style={{ padding: '6px 10px', width: 30 }}>+</button>
                </div>
                <div style={{ fontSize: 9, color: 'var(--muted)', marginTop: 4 }}>{min}–{max} range</div>
              </div>
              <div style={{ paddingTop: 18 }}>
                <button className="btn btn-ghost" onClick={() => regenRow(i)} disabled={regenIdx === i} style={{ padding: '4px 8px', fontSize: 10 }}>{regenIdx === i ? '...' : '↺ regen'}</button>
              </div>
              <div style={{ paddingTop: 18 }}>
                <button onClick={() => removeRow(i)} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}>×</button>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <button onClick={addRow} className="btn btn-secondary" style={{ fontSize: 11 }}>+ Add carousel</button>
        <span className="muted">{plan?.length} carousels · {totalSlides} total slides · ~{totalSlides} images</span>
      </div>

      <div style={{ display: 'flex', gap: 12 }}>
        <button className="btn btn-primary" onClick={() => onConfirm(plan)}>Plan confirmed — Build style guide →</button>
        <button className="btn btn-secondary" onClick={onBack}>← Back</button>
      </div>
    </div>
  );
}
