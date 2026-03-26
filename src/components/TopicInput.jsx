// src/components/TopicInput.jsx
import { useState } from 'react';
import { api } from '../lib/api';

const GOALS = [
  { value: 'grow audience', label: 'Grow the audience' },
  { value: 'educate', label: 'Educate the niche' },
  { value: 'sell something', label: 'Sell a product/service' },
];

const EXAMPLES = ['backyard chickens', 'beginner sourdough', 'van life on a budget', 'urban foraging', 'beginner woodworking', 'personal finance for millennials'];

export default function TopicInput({ onComplete }) {
  const [topic, setTopic]   = useState('');
  const [goal, setGoal]     = useState('grow audience');
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState('');

  async function submit() {
    if (!topic.trim()) return;
    setLoading(true); setError('');
    try {
      const data = await api.generateNiche(topic.trim(), goal);
      onComplete(topic.trim(), goal, data.session_id, data.niche_brief);
    } catch (e) { setError(e.message); }
    setLoading(false);
  }

  return (
    <div style={{ maxWidth: 600, margin: '60px auto 0' }}>
      <div style={{ marginBottom: 40, textAlign: 'center' }}>
        <div style={{ fontSize: 9, letterSpacing: '0.18em', color: 'var(--accentd)', marginBottom: 8 }}>STEP 1 OF 6</div>
        <div className="serif-heading" style={{ fontSize: 36 }}>What's your page about?</div>
        <p className="muted" style={{ marginTop: 10, fontSize: 13 }}>Be specific. "Backyard chickens" beats "farming". The more specific, the better the content.</p>
      </div>

      {error && <div className="err-box">{error}</div>}

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div>
          <div className="label">NICHE TOPIC</div>
          <input
            type="text"
            value={topic}
            onChange={e => setTopic(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !loading && submit()}
            placeholder="e.g. backyard chickens, beginner sourdough, van life..."
            style={{ fontSize: 16 }}
            autoFocus
          />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
            {EXAMPLES.map(ex => (
              <button key={ex} onClick={() => setTopic(ex)} style={{ background: 'var(--accentbg)', border: '1px solid var(--borderl)', color: 'var(--muted)', borderRadius: 20, padding: '3px 10px', fontSize: 11, cursor: 'pointer', transition: 'all 0.1s' }}
                onMouseEnter={e => e.target.style.color = 'var(--accent)'}
                onMouseLeave={e => e.target.style.color = 'var(--muted)'}
              >{ex}</button>
            ))}
          </div>
        </div>

        <div>
          <div className="label">NICHE GOAL</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {GOALS.map(g => (
              <button key={g.value} onClick={() => setGoal(g.value)}
                className={`btn ${goal === g.value ? 'btn-primary' : 'btn-secondary'}`}
                style={{ flex: 1, fontSize: 11 }}>
                {g.label}
              </button>
            ))}
          </div>
        </div>

        <button className="btn btn-primary" onClick={submit} disabled={loading || !topic.trim()} style={{ width: '100%', padding: '14px', fontSize: 13, marginTop: 4 }}>
          {loading ? 'Researching your niche...' : 'Research niche →'}
        </button>
      </div>
    </div>
  );
}
