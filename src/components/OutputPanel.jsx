// src/components/OutputPanel.jsx
import { useState } from 'react';
import { supabase } from '../lib/supabase';
import JSZip from 'jszip';

function SlideCard({ slide, imageUrl }) {
  return (
    <div style={{ position: 'relative', aspectRatio: '1', background: '#111', borderRadius: 8, overflow: 'hidden', flexShrink: 0, width: '100%' }}>
      {imageUrl
        ? <img src={imageUrl} alt={slide.headline} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        : <div style={{ width: '100%', height: '100%', background: 'var(--card2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span className="muted" style={{ fontSize: 11 }}>No image</span></div>
      }
      {/* Text overlay */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'linear-gradient(transparent, rgba(0,0,0,0.85))', padding: '32px 16px 14px' }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', lineHeight: 1.25, marginBottom: slide.body ? 6 : 0 }}>{slide.headline}</div>
        {slide.body && <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', lineHeight: 1.5 }}>{slide.body}</div>}
        {slide.subtext && <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 3 }}>{slide.subtext}</div>}
      </div>
      {/* Slide type badge */}
      <div style={{ position: 'absolute', top: 10, left: 10, background: slide.type === 'cover' ? 'var(--accent)' : 'rgba(0,0,0,0.5)', color: slide.type === 'cover' ? '#000' : '#fff', fontSize: 9, letterSpacing: '0.1em', padding: '2px 7px', borderRadius: 3 }}>
        {slide.type === 'cover' ? 'COVER' : slide.type === 'cta' ? 'CTA' : `SLIDE ${slide.num}`}
      </div>
    </div>
  );
}

function CarouselPreview({ carousel, copyData }) {
  const [slideIdx, setSlideIdx] = useState(0);
  const [copying, setCopying]   = useState(false);
  const slides = copyData?.slides || [];
  const current = slides[slideIdx];
  const imageUrl = current ? carousel?.slides?.[slideIdx]?.image_url : null;

  function copyCaption() {
    navigator.clipboard.writeText(`${copyData.caption}\n\n${copyData.hashtags}`);
    setCopying(true); setTimeout(() => setCopying(false), 2000);
  }

  return (
    <div className="card" style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 20, alignItems: 'start' }}>
      {/* Slide viewer */}
      <div>
        {current && <SlideCard slide={current} imageUrl={imageUrl} />}
        {/* Slide dots */}
        <div style={{ display: 'flex', gap: 5, justifyContent: 'center', marginTop: 10, flexWrap: 'wrap' }}>
          {slides.map((_, i) => (
            <button key={i} onClick={() => setSlideIdx(i)} style={{ width: i === slideIdx ? 20 : 6, height: 6, borderRadius: 3, background: i === slideIdx ? 'var(--accent)' : 'var(--borderl)', border: 'none', cursor: 'pointer', padding: 0, transition: 'all 0.2s' }} />
          ))}
        </div>
        {/* Prev/next */}
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <button className="btn btn-secondary" onClick={() => setSlideIdx(i => Math.max(0, i - 1))} disabled={slideIdx === 0} style={{ flex: 1, fontSize: 11, padding: '7px' }}>← Prev</button>
          <button className="btn btn-secondary" onClick={() => setSlideIdx(i => Math.min(slides.length - 1, i + 1))} disabled={slideIdx === slides.length - 1} style={{ flex: 1, fontSize: 11, padding: '7px' }}>Next →</button>
        </div>
      </div>

      {/* Caption + hashtags */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <div className="label">CAPTION</div>
            <button onClick={copyCaption} className="btn btn-ghost" style={{ fontSize: 10 }}>{copying ? '✓ Copied' : 'Copy caption + tags'}</button>
          </div>
          <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, padding: 12, fontSize: 12, lineHeight: 1.8, whiteSpace: 'pre-wrap', color: 'var(--text)', minHeight: 100 }}>{copyData?.caption}</div>
        </div>
        <div>
          <div className="label" style={{ marginBottom: 6 }}>HASHTAGS</div>
          <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, padding: 10, fontSize: 11, color: 'var(--accent)', lineHeight: 1.9, wordBreak: 'break-word' }}>{copyData?.hashtags}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <span className="muted">{slides.length} slides</span>
          <span className="muted">·</span>
          <span className="muted">{slides.filter((_, i) => carousel?.slides?.[i]?.image_url).length} images ready</span>
        </div>
      </div>
    </div>
  );
}

export default function OutputPanel({ session, onRestart }) {
  const [downloading, setDownloading] = useState(false);
  const [openIdx, setOpenIdx] = useState(0);

  async function downloadCarousel(carouselNum) {
    setDownloading(true);
    try {
      const { data: carouselData } = await supabase
        .from('carousels')
        .select('*')
        .eq('session_id', session.session_id)
        .eq('carousel_num', carouselNum)
        .single();
      const copyData = session.all_copy?.find(c => c.carousel_num === carouselNum);

      const zip = new JSZip();
      const folder = zip.folder(`carousel-${carouselNum}`);

      // Add images
      for (const slide of carouselData.slides) {
        if (slide.image_url) {
          const res = await fetch(slide.image_url);
          const blob = await res.arrayBuffer();
          folder.file(`slide-${String(slide.num).padStart(2, '0')}.png`, blob);
        }
      }

      // Add copy text file
      const copyText = `CAROUSEL ${carouselNum}\n${'='.repeat(40)}\n\n${carouselData.slides.map(s => `SLIDE ${s.num} (${s.type.toUpperCase()})\n${s.headline}\n${s.body || ''}`).join('\n\n')}\n\n${'='.repeat(40)}\nCAPTION\n\n${copyData?.caption}\n\n${copyData?.hashtags}`;
      folder.file('copy.txt', copyText);

      const blob = await zip.generateAsync({ type: 'blob' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a'); a.href = url;
      a.download = `carousel-${carouselNum}-${session.topic.replace(/\s+/g, '-')}.zip`; a.click();
      URL.revokeObjectURL(url);
    } catch (e) { console.error(e); }
    setDownloading(false);
  }

  async function downloadAll() {
    setDownloading(true);
    try {
      const { data: carousels } = await supabase.from('carousels').select('*').eq('session_id', session.session_id).order('carousel_num');
      const zip = new JSZip();

      for (const carousel of carousels) {
        const folder   = zip.folder(`carousel-${carousel.carousel_num}`);
        const copyData = session.all_copy?.find(c => c.carousel_num === carousel.carousel_num);

        for (const slide of carousel.slides) {
          if (slide.image_url) {
            const res  = await fetch(slide.image_url);
            const blob = await res.arrayBuffer();
            folder.file(`slide-${String(slide.num).padStart(2, '0')}.png`, blob);
          }
        }

        const copyText = `CAROUSEL ${carousel.carousel_num}\n${'='.repeat(40)}\n\n${carousel.slides.map(s => `SLIDE ${s.num} (${s.type.toUpperCase()})\n${s.headline}\n${s.body || ''}`).join('\n\n')}\n\n${'='.repeat(40)}\nCAPTION\n\n${copyData?.caption}\n\n${copyData?.hashtags}`;
        folder.file('copy.txt', copyText);
      }

      // Master copy guide
      const masterCopy = session.all_copy?.map(c => `CAROUSEL ${c.carousel_num}: ${c.slides[0]?.headline}\n\nCAPTION:\n${c.caption}\n\nHASHTAGS:\n${c.hashtags}`).join('\n\n' + '—'.repeat(40) + '\n\n');
      zip.file('_master-copy-guide.txt', masterCopy || '');

      const blob = await zip.generateAsync({ type: 'blob' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a'); a.href = url;
      a.download = `carousel-studio-${session.topic.replace(/\s+/g, '-')}-full.zip`; a.click();
      URL.revokeObjectURL(url);
    } catch (e) { console.error(e); }
    setDownloading(false);
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28, flexWrap: 'wrap', gap: 14 }}>
        <div>
          <div style={{ fontSize: 9, letterSpacing: '0.18em', color: 'var(--accentd)', marginBottom: 6 }}>OUTPUT</div>
          <div className="serif-heading">Your content kit</div>
          <p className="muted" style={{ marginTop: 6 }}>
            <span style={{ color: 'var(--accent)', fontWeight: 700 }}>{session.topic}</span> · {session.all_copy?.length} carousels ready to post
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button className="btn btn-primary" onClick={downloadAll} disabled={downloading}>
            {downloading ? 'Preparing ZIP...' : '↓ Download all carousels'}
          </button>
          <button className="btn btn-secondary" onClick={onRestart}>↺ New session</button>
        </div>
      </div>

      {/* Carousel selector */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
        {session.all_copy?.map((c, i) => (
          <button key={i} onClick={() => setOpenIdx(i)}
            className={`btn ${openIdx === i ? 'btn-primary' : 'btn-secondary'}`}
            style={{ fontSize: 11, padding: '6px 14px' }}>
            {i + 1}. {c.slides[0]?.headline?.slice(0, 24)}...
          </button>
        ))}
      </div>

      {/* Active carousel preview */}
      {session.all_copy?.[openIdx] && (
        <>
          <CarouselPreview
            carousel={{ slides: [] }} // slides with image_url loaded from generation
            copyData={session.all_copy[openIdx]}
          />
          <div style={{ marginTop: 10, textAlign: 'right' }}>
            <button className="btn btn-secondary" onClick={() => downloadCarousel(session.all_copy[openIdx].carousel_num)} disabled={downloading} style={{ fontSize: 11 }}>
              ↓ Download carousel {openIdx + 1}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
