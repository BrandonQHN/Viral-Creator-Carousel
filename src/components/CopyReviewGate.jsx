// src/components/CopyReviewGate.jsx
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { api } from '../lib/api';

// Shows live carousel copy progress while generating
function CopyProgressWatcher({ sessionId, contentPlan }) {
  const [partialCopy, setPartialCopy] = useState([]);

  useEffect(() => {
    const iv = setInterval(async () => {
      const { data } = await supabase
        .from('sessions')
        .select('all_copy')
        .eq('id', sessionId)
        .single();
      if (data?.all_copy?.length) setPartialCopy(data.all_copy);
    }, 3000);
    return () => clearInterval(iv);
  }, [sessionId]);

  if (!partialCopy.length) return (
    <div style={{ marginTop: 20 }}>
      {contentPlan?.map((c, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--border)' }} />
          <span className="muted" style={{ fontSize: 12 }}>Carousel {c.carousel_num}: {c.hook}</span>
        </div>
      ))}
    </div>
  );

  return (
    <div style={{ marginTop: 20 }}>
      {contentPlan?.map((c, i) => {
        const done = partialCopy.find(p => p.carousel_num === c.carousel_num);
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: done ? 'var(--success)' : 'var(--border)', transition: 'background 0.3s' }} />
            <span style={{ fontSize: 12, color: done ? 'var(--text)' : 'var(--muted)' }}>
              {done ? '✓ ' : ''}{c.hook}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function SlideEditor({ slide, onChange }) {
  return (
    <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, padding: 12, display: 'grid', gridTemplateColumns: '40px 1fr', gap: 10, alignItems: 'start' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 9, color: slide.type === 'cover' ? 'var(--accent)' : slide.type === 'cta' ? 'var(--accentd)' : 'var(--muted)', letterSpacing: '0.08em', marginBottom: 2 }}>
          {slide.type === 'cover' ? 'CVR' : slide.type === 'cta' ? 'CTA' : `S${slide.num}`}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <input value={slide.headline} onChange={e => onChange({ ...slide, headline: e.target.value })} placeholder="Headline" style={{ fontSize: 12, fontWeight: 700 }} />
        {slide.type !== 'cover' && (
          <textarea value={slide.body || ''} onChange={e => onChange({ ...slide, body: e.target.value })} placeholder="Body copy" style={{ fontSize: 11, minHeight: 48, color: 'var(--muted)' }} />
        )}
        {slide.subtext !== undefined && slide.type === 'cover' && (
          <input value={slide.subtext || ''} onChange={e => onChange({ ...slide, subtext: e.target.value })} placeholder="Subtext (optional)" style={{ fontSize: 11, color: 'var(--muted)' }} />
        )}
      </div>
    </div>
  );
}

export default function CopyReviewGate({ sessionId, nicheBrief, contentPlan, onBack, onConfirm }) {
  const [allCopy, setAllCopy] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [openIdx, setOpenIdx] = useState(0);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true); setError('');
    try {
      const copy = await api.generateCopy(sessionId, nicheBrief, contentPlan);
      setAllCopy(copy);
    } catch (e) { setError(e.message); }
    setLoading(false);
  }

  function updateSlide(carouselIdx, slideIdx, newSlide) {
    setAllCopy(prev => {
      const n = [...prev];
      const slides = [...n[carouselIdx].slides];
      slides[slideIdx] = newSlide;
      n[carouselIdx] = { ...n[carouselIdx], slides };
      return n;
    });
  }

  function updateCaption(i, val) {
    setAllCopy(prev => { const n = [...prev]; n[i] = { ...n[i], caption: val }; return n; });
  }

  function updateHashtags(i, val) {
    setAllCopy(prev => { const n = [...prev]; n[i] = { ...n[i], hashtags: val }; return n; });
  }

  if (loading) return (
    <div className="card" style={{ textAlign: 'center', padding: 60 }}>
      <p className="muted">Writing copy for your carousels...</p>
      <p className="muted" style={{ marginTop: 8, fontSize: 11 }}>Generating one carousel at a time — this takes 1-2 min</p>
      <CopyProgressWatcher sessionId={sessionId} contentPlan={contentPlan} />
    </div>
  );

  if (!allCopy) return (
    <div>
      {error && <div className="err-box" style={{ marginBottom: 16 }}>{error}</div>}
      <div className="card" style={{ textAlign: 'center', padding: 40 }}>
        <p className="muted" style={{ marginBottom: 16 }}>Failed to generate copy. Check Netlify env vars then retry.</p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <button className="btn btn-primary" onClick={load}>Retry</button>
          <button className="btn btn-secondary" onClick={onBack}>← Back</button>
        </div>
      </div>
    </div>
  );

  const totalSlides = allCopy?.reduce((s, c) => s + c.slides.length, 0) || 0;

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 9, letterSpacing: '0.18em', color: 'var(--accentd)', marginBottom: 6 }}>GATE 4 — COPY REVIEW</div>
        <div className="serif-heading">Review every word</div>
        <p className="muted" style={{ marginTop: 6 }}>Edit any slide, caption, or hashtags. This is the last step before images generate.</p>
      </div>

      {error && <div className="err-box">{error}</div>}

      {/* Carousel tabs */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
        {allCopy?.map((c, i) => (
          <button key={i} onClick={() => setOpenIdx(i)}
            className={`btn ${openIdx === i ? 'btn-primary' : 'btn-secondary'}`}
            style={{ fontSize: 11, padding: '6px 14px' }}>
            Carousel {c.carousel_num}
          </button>
        ))}
      </div>

      {allCopy?.[openIdx] && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Carousel header */}
          <div className="card" style={{ background: 'var(--accentbg)', borderColor: 'var(--accentd)' }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
              <span className="tag">{contentPlan?.[openIdx]?.format?.replace(/_/g,' ')}</span>
              <span style={{ fontSize: 13, fontWeight: 700 }}>{allCopy[openIdx].slides[0]?.headline}</span>
            </div>
            <p className="muted" style={{ marginTop: 4, fontSize: 11 }}>{allCopy[openIdx].slides.length} slides</p>
          </div>

          {/* Slides */}
          <div className="card">
            <div className="label" style={{ marginBottom: 10 }}>SLIDES</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {allCopy[openIdx].slides.map((slide, si) => (
                <SlideEditor key={si} slide={slide} onChange={s => updateSlide(openIdx, si, s)} />
              ))}
            </div>
          </div>

          {/* Caption */}
          <div className="card">
            <div className="label" style={{ marginBottom: 6 }}>CAPTION</div>
            <textarea value={allCopy[openIdx].caption} onChange={e => updateCaption(openIdx, e.target.value)} style={{ minHeight: 110, fontSize: 12, lineHeight: 1.8 }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
              <span className="muted">{allCopy[openIdx].caption?.length || 0} chars</span>
              <span className="muted" style={{ color: allCopy[openIdx].caption?.length > 150 * 6 ? 'var(--err)' : 'var(--muted)' }}>
                {Math.round((allCopy[openIdx].caption?.length || 0) / 5)} words est.
              </span>
            </div>
          </div>

          {/* Hashtags */}
          <div className="card">
            <div className="label" style={{ marginBottom: 6 }}>HASHTAGS</div>
            <textarea value={allCopy[openIdx].hashtags} onChange={e => updateHashtags(openIdx, e.target.value)} style={{ minHeight: 56, fontSize: 11, color: 'var(--accent)' }} />
          </div>

          {/* Next/prev nav */}
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <button className="btn btn-ghost" onClick={() => setOpenIdx(i => Math.max(0, i - 1))} disabled={openIdx === 0}>← Prev carousel</button>
            <button className="btn btn-ghost" onClick={() => setOpenIdx(i => Math.min(allCopy.length - 1, i + 1))} disabled={openIdx === allCopy.length - 1}>Next carousel →</button>
          </div>
        </div>
      )}

      <div className="sep" />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span className="muted">{allCopy?.length} carousels · {totalSlides} slides · ~{totalSlides} images to generate</span>
        <div style={{ display: 'flex', gap: 12 }}>
          <button className="btn btn-secondary" onClick={onBack}>← Back</button>
          <button className="btn btn-primary" onClick={() => onConfirm(allCopy)} style={{ padding: '12px 28px' }}>
            Copy confirmed — Generate images →
          </button>
        </div>
      </div>
    </div>
  );
}
