// src/components/VisualDNAGate.jsx
import { useState, useEffect } from 'react';
import { api } from '../lib/api';

export default function VisualDNAGate({ sessionId, nicheBrief, onBack, onConfirm }) {
  const [dna, setDna]         = useState(null);
  const [loading, setLoading] = useState(true);
  const [regenSample, setRegenSample] = useState(false);
  const [error, setError]     = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true); setError('');
    try {
      const data = await api.generateVisualDNA(sessionId, nicheBrief, true);
      setDna(data.visual_dna);
    } catch (e) { setError(e.message); }
    setLoading(false);
  }

  async function regenerateSample() {
    setRegenSample(true); setError('');
    try {
      const data = await api.generateVisualDNA(sessionId, nicheBrief, true);
      setDna(d => ({ ...d, sample_image_url: data.visual_dna.sample_image_url }));
    } catch (e) { setError(e.message); }
    setRegenSample(false);
  }

  const update = (key, val) => setDna(d => ({ ...d, [key]: val }));
  const updatePalette = (key, val) => setDna(d => ({ ...d, color_palette: { ...d.color_palette, [key]: val } }));

  if (loading) return (
    <div className="card" style={{ textAlign: 'center', padding: 60 }}>
      <p className="muted">Designing your visual system...</p>
      <p className="muted" style={{ marginTop: 8, fontSize: 11 }}>Also generating a sample image — this takes ~15 seconds</p>
    </div>
  );

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 9, letterSpacing: '0.18em', color: 'var(--accentd)', marginBottom: 6 }}>GATE 3 — VISUAL DNA</div>
        <div className="serif-heading">Your visual system</div>
        <p className="muted" style={{ marginTop: 6 }}>This style is locked into every image across all your carousels. Edit anything, then confirm.</p>
      </div>

      {error && <div className="err-box">{error}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 16, alignItems: 'start' }}>
        {/* Left: style fields */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="card">
            <div className="label">ART STYLE</div>
            <textarea value={dna.art_style} onChange={e => update('art_style', e.target.value)} style={{ minHeight: 56, fontSize: 12 }} />
          </div>

          <div className="card">
            <div className="label">COLOR PALETTE</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {['primary','secondary','accent','background'].map(key => (
                <div key={key}>
                  <div style={{ fontSize: 9, color: 'var(--muted)', letterSpacing: '0.1em', marginBottom: 4 }}>{key.toUpperCase()}</div>
                  <input value={dna.color_palette?.[key] || ''} onChange={e => updatePalette(key, e.target.value)} style={{ fontSize: 11 }} />
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="label">LIGHTING</div>
            <input value={dna.lighting} onChange={e => update('lighting', e.target.value)} style={{ fontSize: 12 }} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="card">
              <div className="label">COMPOSITION</div>
              <textarea value={dna.composition} onChange={e => update('composition', e.target.value)} style={{ minHeight: 56, fontSize: 12 }} />
            </div>
            <div className="card">
              <div className="label">TEXTURE / SURFACE</div>
              <textarea value={dna.texture_surface} onChange={e => update('texture_surface', e.target.value)} style={{ minHeight: 56, fontSize: 12 }} />
            </div>
          </div>

          <div className="card">
            <div className="label">WHAT TO AVOID</div>
            <input value={dna.what_to_avoid} onChange={e => update('what_to_avoid', e.target.value)} style={{ fontSize: 12 }} />
          </div>

          <div className="card" style={{ background: 'var(--accentbg)', borderColor: 'var(--accentd)' }}>
            <div className="label">DALL-E STYLE ANCHOR — prepended to every image prompt</div>
            <textarea value={dna.dalle_style_anchor} onChange={e => update('dalle_style_anchor', e.target.value)} style={{ minHeight: 100, fontSize: 11, lineHeight: 1.7 }} />
            <p style={{ fontSize: 10, color: 'var(--muted)', marginTop: 6 }}>This exact text will prefix every single image generated. Keep it under 100 words.</p>
          </div>
        </div>

        {/* Right: sample image */}
        <div style={{ position: 'sticky', top: 80 }}>
          <div className="card">
            <div className="label" style={{ marginBottom: 10 }}>SAMPLE IMAGE PREVIEW</div>
            {dna.sample_image_url ? (
              <img src={dna.sample_image_url} alt="Visual DNA sample" style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 8, display: 'block' }} />
            ) : (
              <div style={{ width: '100%', aspectRatio: '1', background: 'var(--bg)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span className="muted" style={{ fontSize: 11 }}>No preview</span>
              </div>
            )}
            <button className="btn btn-secondary" onClick={regenerateSample} disabled={regenSample} style={{ width: '100%', marginTop: 10, fontSize: 11 }}>
              {regenSample ? 'Generating...' : '↺ Regenerate preview'}
            </button>
            <p className="muted" style={{ marginTop: 8, fontSize: 10, textAlign: 'center' }}>~$0.04 per preview. Edit the anchor above, then regenerate to see the change.</p>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, marginTop: 22 }}>
        <button className="btn btn-primary" onClick={() => onConfirm(dna)}>Visual confirmed — Write copy →</button>
        <button className="btn btn-secondary" onClick={onBack}>← Back</button>
      </div>
    </div>
  );
}
