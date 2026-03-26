// src/components/AuthGate.jsx
import { useState } from 'react';
import { supabase } from '../lib/supabase';

export default function AuthGate({ onAuth }) {
  const [mode, setMode]   = useState('login');
  const [email, setEmail] = useState('');
  const [pass, setPass]   = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault(); setLoading(true); setError('');
    try {
      if (mode === 'login') {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password: pass });
        if (error) throw error;
        onAuth(data.user);
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password: pass });
        if (error) throw error;
        onAuth(data.user);
      }
    } catch (e) { setError(e.message); }
    setLoading(false);
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 380 }}>
        <div style={{ marginBottom: 36, textAlign: 'center' }}>
          <div style={{ fontSize: 9, letterSpacing: '0.18em', color: 'var(--accentd)', marginBottom: 8 }}>PUBLISH EXPERTS</div>
          <div className="serif-heading" style={{ fontSize: 32 }}>Carousel Studio</div>
          <p className="muted" style={{ marginTop: 8 }}>Faceless Instagram content, fully generated</p>
        </div>
        {error && <div className="err-box">{error}</div>}
        <div className="card">
          <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
            {['login','signup'].map(m => (
              <button key={m} onClick={() => setMode(m)} className={`btn ${mode === m ? 'btn-primary' : 'btn-secondary'}`} style={{ flex: 1 }}>
                {m === 'login' ? 'Log in' : 'Sign up'}
              </button>
            ))}
          </div>
          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required />
            <input type="password" placeholder="Password" value={pass} onChange={e => setPass(e.target.value)} required />
            <button type="submit" className="btn btn-primary" disabled={loading} style={{ marginTop: 4 }}>
              {loading ? 'Loading...' : mode === 'login' ? 'Log in' : 'Create account'}
            </button>
          </form>
        </div>
        <p className="muted" style={{ textAlign: 'center', marginTop: 16 }}>Free plan: 1 run to try it out. No card required.</p>
      </div>
    </div>
  );
}
