// src/components/UsageHeader.jsx
import { supabase } from '../lib/supabase';

const STEP_LABELS = ['Topic', 'Niche', 'Plan', 'Visual', 'Copy', 'Generating', 'Output'];
const STEP_KEYS   = ['topic', 'niche', 'plan', 'visual', 'copy', 'generating', 'output'];

export default function UsageHeader({ user, userData, step }) {
  const runsLeft = userData ? userData.runs_cap - userData.runs_used : '—';
  const currentIdx = STEP_KEYS.indexOf(step);

  return (
    <header style={{ background: 'var(--card)', borderBottom: '1px solid var(--border)', padding: '12px 24px', display: 'flex', alignItems: 'center', gap: 24, position: 'sticky', top: 0, zIndex: 100 }}>
      {/* Logo */}
      <div style={{ flexShrink: 0 }}>
        <span style={{ fontFamily: 'var(--serif)', fontSize: 16, fontWeight: 700, color: 'var(--accent)' }}>Carousel Studio</span>
      </div>

      {/* Step bar */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 0, overflow: 'hidden' }}>
        {STEP_LABELS.map((label, i) => {
          const done   = i < currentIdx;
          const active = i === currentIdx;
          return (
            <div key={label} style={{ display: 'flex', alignItems: 'center', flex: i < STEP_LABELS.length - 1 ? 1 : 0 }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                <div style={{ width: 18, height: 18, borderRadius: '50%', background: done || active ? 'var(--accent)' : 'transparent', border: `1.5px solid ${done || active ? 'var(--accent)' : 'var(--border)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: done || active ? '#0b0a08' : 'var(--muted)', flexShrink: 0 }}>
                  {done ? '✓' : i + 1}
                </div>
                <span style={{ fontSize: 8, letterSpacing: '0.08em', color: done || active ? 'var(--accent)' : 'var(--muted)', whiteSpace: 'nowrap' }}>{label.toUpperCase()}</span>
              </div>
              {i < STEP_LABELS.length - 1 && (
                <div style={{ flex: 1, height: 1, background: done ? 'var(--accent)' : 'var(--border)', margin: '0 4px', marginBottom: 14 }} />
              )}
            </div>
          );
        })}
      </div>

      {/* Usage + logout */}
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 16 }}>
        {userData && (
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 9, color: 'var(--muted)', letterSpacing: '0.1em' }}>RUNS LEFT</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: runsLeft === 0 ? 'var(--err)' : 'var(--accent)' }}>{runsLeft}</div>
          </div>
        )}
        <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: 11 }} onClick={() => supabase.auth.signOut()}>Sign out</button>
      </div>
    </header>
  );
}
