// src/components/OutputPanel.jsx
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { compositeSlide } from '../lib/compositor';
import JSZip from 'jszip';

// Composites one slide and caches the result
function useComposited(imageUrl, slide, visualDna) {
  const [dataUrl, setDataUrl] = useState(null);
  useEffect(() => {
    if (!imageUrl || !slide) return;
    let cancelled = false;
    compositeSlide(imageUrl, slide, visualDna)
      .then(url => { if (!cancelled) setDataUrl(url); })
      .catch(() => { if (!cancelled) setDataUrl(imageUrl); }); // fallback to raw
    return () => { cancelled = true; };
  }, [imageUrl, slide?.num]);
  return dataUrl;
}

function SlideCard({ slide, imageUrl, visualDna }) {
  const composited = useComposited(imageUrl, slide, visualDna);
  return (
    <div style={{ position: 'relative', aspectRatio: '1', background: '#111', borderRadius: 8, overflow: 'hidden', width: '100%' }}>
      {composited
        ? <img src={composited} alt={slide.headline} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        : imageUrl
          ? <img src={imageUrl} alt={slide.headline} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', opacity: 0.5 }} />
          : <div style={{ width: '100%', height: '100%', background: 'var(--card2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span className="muted" style={{ fontSize: 11 }}>No image</span>
            </div>
      }
      {!composited && imageUrl && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span className="muted" style={{ fontSize: 11 }}>Compositing...</span>
        </div>
      )}
    </div>
  );
}

function CarouselPreview({ dbCarousel, copyData, visualDna }) {
  const [slideIdx, setSlideIdx] = useState(0);
  const [copying, setCopying]   = useState(false);
  const slides     = copyData?.slides || [];
  const current    = slides[slideIdx];
  const imageUrl   = dbCarousel?.slides?.[slideIdx]?.image_url || null;

  function copyCaption() {
    navigator.clipboard.writeText(`${copyData.caption}\n\n${copyData.hashtags}`);
    setCopying(true); setTimeout(() => setCopying(false), 2000);
  }

  return (
    <div className="card" style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 20, alignItems: 'start' }}>
      <div>
        {current && <SlideCard slide={current} imageUrl={imageUrl} visualDna={visualDna} />}
        <div style={{ display: 'flex', gap: 5, justifyContent: 'center', marginTop: 10, flexWrap: 'wrap' }}>
          {slides.map((_, i) => (
            <button key={i} onClick={() => setSlideIdx(i)} style={{ width: i === slideIdx ? 20 : 6, height: 6, borderRadius: 3, background: i === slideIdx ? 'var(--accent)' : 'var(--borderl)', border: 'none', cursor: 'pointer', padding: 0, transition: 'all 0.2s' }} />
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <button className="btn btn-secondary" onClick={() => setSlideIdx(i => Math.max(0, i - 1))} disabled={slideIdx === 0} style={{ flex: 1, fontSize: 11, padding: '7px' }}>← Prev</button>
          <button className="btn btn-secondary" onClick={() => setSlideIdx(i => Math.min(slides.length - 1, i + 1))} disabled={slideIdx === slides.length - 1} style={{ flex: 1, fontSize: 11, padding: '7px' }}>Next →</button>
        </div>
      </div>
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
        <span className="muted">{slides.length} slides · {dbCarousel?.slides?.filter(s => s.image_url).length || 0} images ready</span>
      </div>
    </div>
  );
}

export default function OutputPanel({ session, onRestart }) {
  const [dbCarousels, setDbCarousels] = useState([]);
  const [downloading, setDownloading] = useState(false);
  const [openIdx, setOpenIdx]         = useState(0);

  useEffect(() => {
    if (!session.session_id) return;
    supabase.from('carousels').select('*').eq('session_id', session.session_id).order('carousel_num')
      .then(({ data }) => { if (data) setDbCarousels(data); });
  }, [session.session_id]);

  async function downloadCarousel(carouselNum) {
    setDownloading(true);
    try {
      const dbCarousel = dbCarousels.find(c => c.carousel_num === carouselNum);
      const copyData   = session.all_copy?.find(c => c.carousel_num === carouselNum);
      if (!dbCarousel || !copyData) return;

      const zip    = new JSZip();
      const folder = zip.folder(`carousel-${carouselNum}`);

      for (let i = 0; i < copyData.slides.length; i++) {
        const imageUrl = dbCarousel.slides[i]?.image_url;
        if (!imageUrl) continue;
        try {
          // Composite text onto image before downloading
          const composited = await compositeSlide(imageUrl, copyData.slides[i], session.visual_dna);
          const base64     = composited.split(',')[1];
          folder.file(`slide-${String(i + 1).padStart(2, '0')}.jpg`, base64, { base64: true });
        } catch {
          // Fallback: download raw image
          const res    = await fetch(imageUrl);
          const buffer = await res.arrayBuffer();
          folder.file(`slide-${String(i + 1).padStart(2, '0')}.png`, buffer);
        }
      }

      const copyText = `CAROUSEL ${carouselNum}\n${'='.repeat(40)}\n\n${copyData.slides.map(s => `SLIDE ${s.num} (${s.type.toUpperCase()})\n${s.headline}\n${s.body || ''}`).join('\n\n')}\n\n${'='.repeat(40)}\nCAPTION\n\n${copyData.caption}\n\n${copyData.hashtags}`;
      folder.file('copy.txt', copyText);

      const blob = await zip.generateAsync({ type: 'blob' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a'); a.href = url;
      a.download = `carousel-${carouselNum}-${session.topic?.replace(/\s+/g, '-')}.zip`; a.click();
      URL.revokeObjectURL(url);
    } catch (e) { console.error(e); }
    setDownloading(false);
  }

  async function downloadAll() {
    setDownloading(true);
    try {
      const zip = new JSZip();
      for (const dbCarousel of dbCarousels) {
        const copyData = session.all_copy?.find(c => c.carousel_num === dbCarousel.carousel_num);
        if (!copyData) continue;
        const folder = zip.folder(`carousel-${dbCarousel.carousel_num}`);

        for (let i = 0; i < copyData.slides.length; i++) {
          const imageUrl = dbCarousel.slides[i]?.image_url;
          if (!imageUrl) continue;
          try {
            const composited = await compositeSlide(imageUrl, copyData.slides[i], session.visual_dna);
            const base64     = composited.split(',')[1];
            folder.file(`slide-${String(i + 1).padStart(2, '0')}.jpg`, base64, { base64: true });
          } catch {
            const res    = await fetch(imageUrl);
            const buffer = await res.arrayBuffer();
            folder.file(`slide-${String(i + 1).padStart(2, '0')}.png`, buffer);
          }
        }

        const copyText = `CAROUSEL ${dbCarousel.carousel_num}\n${'='.repeat(40)}\n\n${copyData.slides.map(s => `SLIDE ${s.num} (${s.type.toUpperCase()})\n${s.headline}\n${s.body || ''}`).join('\n\n')}\n\n${'='.repeat(40)}\nCAPTION\n\n${copyData.caption}\n\n${copyData.hashtags}`;
        folder.file('copy.txt', copyText);
      }

      const masterCopy = session.all_copy?.map(c => `CAROUSEL ${c.carousel_num}: ${c.slides[0]?.headline}\n\nCAPTION:\n${c.caption}\n\nHASHTAGS:\n${c.hashtags}`).join('\n\n' + '—'.repeat(40) + '\n\n');
      zip.file('_master-copy-guide.txt', masterCopy || '');

      const blob = await zip.generateAsync({ type: 'blob' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a'); a.href = url;
      a.download = `carousel-studio-${session.topic?.replace(/\s+/g, '-')}-full.zip`; a.click();
      URL.revokeObjectURL(url);
    } catch (e) { console.error(e); }
    setDownloading(false);
  }

  const currentCopy = session.all_copy?.[openIdx];
  const currentDb   = dbCarousels.find(c => c.carousel_num === currentCopy?.carousel_num);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28, flexWrap: 'wrap', gap: 14 }}>
        <div>
          <div style={{ fontSize: 9, letterSpacing: '0.18em', color: 'var(--accentd)', marginBottom: 6 }}>OUTPUT</div>
          <div className="serif-heading">Your content kit</div>
          <p className="muted" style={{ marginTop: 6 }}>
            <span style={{ color: 'var(--accent)', fontWeight: 700 }}>{session.topic}</span> · {session.all_copy?.length} carousels · text composited onto images
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button className="btn btn-primary" onClick={downloadAll} disabled={downloading || !dbCarousels.length}>
            {downloading ? 'Compositing + zipping...' : '↓ Download all carousels'}
          </button>
          <button className="btn btn-secondary" onClick={onRestart}>↺ New session</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
        {session.all_copy?.map((c, i) => (
          <button key={i} onClick={() => setOpenIdx(i)}
            className={`btn ${openIdx === i ? 'btn-primary' : 'btn-secondary'}`}
            style={{ fontSize: 11, padding: '6px 14px' }}>
            {i + 1}. {c.slides[0]?.headline?.slice(0, 22)}...
          </button>
        ))}
      </div>

      {currentCopy && (
        <>
          <CarouselPreview dbCarousel={currentDb} copyData={currentCopy} visualDna={session.visual_dna} />
          <div style={{ marginTop: 10, textAlign: 'right' }}>
            <button className="btn btn-secondary" onClick={() => downloadCarousel(currentCopy.carousel_num)} disabled={downloading || !currentDb} style={{ fontSize: 11 }}>
              ↓ Download carousel {openIdx + 1}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
