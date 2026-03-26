// src/components/GenerationPanel.jsx
//
// Fires the background function, then subscribes to Supabase Realtime
// on the carousels table for this session. As the background function
// writes each slide image URL, Realtime pushes the UPDATE to us here
// and we render thumbnails + progress bars in real time.

import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { api } from '../lib/api';
import { compositeSlide } from '../lib/compositor';

function CompositedThumb({ imageUrl, slide, visualDna }) {
  const [src, setSrc] = useState(imageUrl);
  useEffect(() => {
    if (!imageUrl || !slide) return;
    compositeSlide(imageUrl, slide, visualDna)
      .then(setSrc)
      .catch(() => setSrc(imageUrl));
  }, [imageUrl]);
  return (
    <img src={src} alt="" style={{ width: 52, height: 52, objectFit: 'cover', borderRadius: 4, border: '1px solid var(--border)', animation: 'fadeIn 0.3s ease' }} />
  );
}

export default function GenerationPanel({ session, onComplete }) {
  const [carousels, setCarousels]     = useState([]);
  const [sessionStatus, setSessionStatus] = useState('starting');
  const [error, setError]             = useState('');
  const started = useRef(false);
  const channelRef = useRef(null);

  const totalSlides = session.all_copy?.reduce((s, c) => s + c.slides.length, 0) || 0;
  const doneSlides  = carousels.reduce((sum, c) =>
    sum + (c.slides || []).filter(s => s.image_status === 'done' || s.image_status === 'failed').length, 0
  );

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    start();
    return () => { channelRef.current?.unsubscribe(); };
  }, []);

  async function start() {
    try {
      // 1. Kick off background function (returns 202 immediately)
      await api.generateImages(session.session_id, session.all_copy, session.visual_dna);
      setSessionStatus('generating');

      // 2. Subscribe to Realtime on carousels for this session
      const channel = supabase
        .channel(`session-${session.session_id}`)
        .on(
          'postgres_changes',
          {
            event:  '*',
            schema: 'public',
            table:  'carousels',
            filter: `session_id=eq.${session.session_id}`,
          },
          (payload) => {
            const updated = payload.new;
            setCarousels(prev => {
              const idx = prev.findIndex(c => c.id === updated.id);
              if (idx === -1) return [...prev, updated];
              const next = [...prev];
              next[idx] = updated;
              return next;
            });
          }
        )
        .subscribe();

      channelRef.current = channel;

      // 3. Poll session status for completion / failure
      const pollInterval = setInterval(async () => {
        const { data } = await supabase
          .from('sessions')
          .select('status, generation_error')
          .eq('id', session.session_id)
          .single();

        if (data?.status === 'complete') {
          clearInterval(pollInterval);
          setSessionStatus('complete');
          channel.unsubscribe();
          // Load final carousel state
          const { data: finalCarousels } = await supabase
            .from('carousels')
            .select('*')
            .eq('session_id', session.session_id)
            .order('carousel_num');
          onComplete({ ...session, completedCarousels: finalCarousels });
        } else if (data?.status === 'failed') {
          clearInterval(pollInterval);
          setSessionStatus('failed');
          setError(data.generation_error || 'Generation failed.');
          channel.unsubscribe();
        }
      }, 4000); // poll every 4s

    } catch (e) {
      setError(e.message);
      setSessionStatus('failed');
    }
  }

  const statusLabel = {
    starting:   'Starting generation...',
    generating: 'Generating images...',
    complete:   'Done!',
    failed:     'Generation failed',
  }[sessionStatus];

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 9, letterSpacing: '0.18em', color: 'var(--accentd)', marginBottom: 6 }}>GENERATING</div>
        <div className="serif-heading">Creating your content</div>
        <p className="muted" style={{ marginTop: 6 }}>{statusLabel}</p>
      </div>

      {error && (
        <div className="err-box" style={{ marginBottom: 20 }}>
          {error} — Any images that completed are still saved and available in the output.
        </div>
      )}

      {/* Overall progress bar */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span className="muted">Overall progress</span>
          <span style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 700 }}>
            {doneSlides} / {totalSlides} images
          </span>
        </div>
        <div className="progress-bar">
          <div className="progress-fill" style={{
            width: `${totalSlides > 0 ? (doneSlides / totalSlides) * 100 : 0}%`,
          }} />
        </div>
      </div>

      {/* Per-carousel cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {session.all_copy?.map(c => {
          const liveCarousel = carousels.find(r => r.carousel_num === c.carousel_num);
          const slides       = liveCarousel?.slides || [];
          const done         = slides.filter(s => s.image_status === 'done').length;
          const failed       = slides.filter(s => s.image_status === 'failed').length;
          const total        = c.slides.length;
          const pct          = total > 0 ? ((done + failed) / total) * 100 : 0;
          const isComplete   = liveCarousel?.status === 'complete';
          const isGenerating = liveCarousel?.status === 'generating';
          const isPending    = !liveCarousel || liveCarousel.status === 'pending';

          return (
            <div key={c.carousel_num} className="card">
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                {/* Status indicator */}
                <div style={{
                  width: 10, height: 10, borderRadius: '50%', flexShrink: 0, marginTop: 5,
                  background: isComplete ? 'var(--success)' : isGenerating ? 'var(--accent)' : 'var(--border)',
                  boxShadow: isGenerating ? '0 0 6px var(--accent)' : 'none',
                  transition: 'all 0.3s',
                }} />
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 700 }}>
                      Carousel {c.carousel_num}: {c.slides[0]?.headline}
                    </span>
                    <span className="muted" style={{ fontSize: 11 }}>
                      {isPending ? 'Waiting...' : `${done}/${total} done${failed > 0 ? ` · ${failed} failed` : ''}`}
                    </span>
                  </div>

                  {/* Progress bar */}
                  {!isPending && (
                    <div className="progress-bar" style={{ marginBottom: 10 }}>
                      <div className="progress-fill" style={{
                        width: `${pct}%`,
                        background: isComplete ? 'var(--success)' : 'var(--accent)',
                      }} />
                    </div>
                  )}

                  {/* Live image thumbnails */}
                  {slides.filter(s => s.image_url).length > 0 && (
                    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 4 }}>
                      {slides.filter(s => s.image_url).map((slide, i) => (
                    <CompositedThumb
                      key={i}
                      imageUrl={slide.image_url}
                      slide={c.slides?.[i]}
                      visualDna={session.visual_dna}
                    />
                  ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <p className="muted" style={{ marginTop: 20, fontSize: 11, textAlign: 'center' }}>
        This takes 5–12 minutes depending on slide count. Safe to keep this tab open — images appear above as they complete.
      </p>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }
      `}</style>
    </div>
  );
}
