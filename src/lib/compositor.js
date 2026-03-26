// src/lib/compositor.js
// Intelligent compositor with three text style modes:
//   minimal  — image-forward, headline only, lots of breathing room
//   overlay  — text-forward, full panel with bullets
//   balanced — headline + one short supporting line

const SIZE = 1080;
const PAD  = 60;

// ── Zone analysis ─────────────────────────────────────────────
function analyzeImage(ctx) {
  const zones = [
    { name: 'top',    y: 0,           h: SIZE * 0.33 },
    { name: 'middle', y: SIZE * 0.33, h: SIZE * 0.34 },
    { name: 'bottom', y: SIZE * 0.67, h: SIZE * 0.33 },
  ];

  const scored = zones.map(zone => {
    const data = ctx.getImageData(0, zone.y, SIZE, zone.h);
    let brightness = 0; const vals = [];
    for (let i = 0; i < data.data.length; i += 32) {
      const lum = data.data[i]*0.299 + data.data[i+1]*0.587 + data.data[i+2]*0.114;
      vals.push(lum); brightness += lum;
    }
    brightness = brightness / vals.length / 255;
    const mean = vals.reduce((a,b)=>a+b,0)/vals.length;
    const variance = Math.sqrt(vals.reduce((s,v)=>s+Math.pow(v-mean,2),0)/vals.length)/255;
    return { ...zone, brightness, variance, score: brightness*0.6 + variance*0.4 };
  });

  scored.sort((a,b) => a.score - b.score);
  const best = scored[0];

  // Overall image brightness — average all zones
  const overallBrightness = scored.reduce((s,z) => s + z.brightness, 0) / scored.length;

  // Detect light/white background style (like illustration on white)
  // If the overall image is very bright AND top zone is bright AND variance is low
  const topZone = scored.find(z => z.name === 'top');
  const isLightBackground = overallBrightness > 0.72 && (topZone?.brightness || 0) > 0.65;

  return {
    zone: best.name,
    brightness: best.brightness,
    variance: best.variance,
    overlayStrength: Math.min(0.45 + best.brightness*0.35 + best.variance*0.15, 0.92),
    isLightBackground,
    overallBrightness,
  };
}

// ── Main entry ────────────────────────────────────────────────
export async function compositeSlide(imageUrl, slide, visualDna) {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = SIZE;
    const ctx = canvas.getContext('2d');

    const brandColor = extractHex(visualDna?.color_palette?.accent)
      || extractHex(visualDna?.color_palette?.primary)
      || '#c8943a';

    // Determine text style — default 'balanced' if not set
    const textStyle = (visualDna?.slide_text_style || 'balanced').toLowerCase().trim();

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      ctx.drawImage(img, 0, 0, SIZE, SIZE);
      const analysis = analyzeImage(ctx);

      // Light background detected — dark text on light, no overlay needed
      if (analysis.isLightBackground) {
        drawLightBackground(ctx, slide, brandColor, analysis);
        return resolve(canvas.toDataURL('image/jpeg', 0.93));
      }

      if (slide.type === 'cover') {
        drawCover(ctx, slide, brandColor, analysis, textStyle);
      } else if (slide.type === 'cta') {
        drawCTA(ctx, slide, brandColor, analysis);
      } else {
        drawContent(ctx, slide, brandColor, analysis, textStyle);
      }

      resolve(canvas.toDataURL('image/jpeg', 0.93));
    };
    img.onerror = () => reject(new Error('Image load failed'));
    img.src = imageUrl;
  });
}

// ── LIGHT BACKGROUND — dark text on top, illustration below ──
// Matches the style: white/cream bg, large dark headline fills top,
// illustrated character anchored at bottom. No overlay needed.
function drawLightBackground(ctx, slide, brandColor, analysis) {
  const headline = slide.headline || '';
  const subtext  = slide.subtext  || '';
  const body     = slide.body     || '';
  const isCover  = slide.type === 'cover';
  const isCTA    = slide.type === 'cta';

  if (isCTA) {
    // CTA on light bg — brand color band across middle
    const bandH = 120;
    const bandY = SIZE * 0.35;
    ctx.fillStyle = brandColor;
    ctx.globalAlpha = 0.12;
    ctx.fillRect(0, bandY, SIZE, bandH);
    ctx.globalAlpha = 1;

    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    const headSize   = fitFontSize(ctx, headline, '800 52px', SIZE - PAD*2, 52, 28);
    ctx.font         = `800 ${headSize}px Arial, sans-serif`;
    ctx.fillStyle    = '#1a1814'; // near-black
    ctx.fillText(headline, SIZE/2, bandY + bandH/2 - 16);
    ctx.font      = `400 28px Arial, sans-serif`;
    ctx.fillStyle = brandColor;
    ctx.fillText(body || 'Save this for later.', SIZE/2, bandY + bandH/2 + 30);
    return;
  }

  // Text occupies top region, illustration has the bottom 45%
  const textAreaH  = SIZE * 0.52; // text lives in top 52%
  const textAreaPad = 52;

  // For content/cover slides — figure out font size that fills the space nicely
  const maxTextWidth  = SIZE - textAreaPad * 2;
  const headline2Show = isCover ? headline : headline;
  const fontSize      = fitFontSize(ctx, headline2Show, '900 90px', maxTextWidth, 90, 38);
  ctx.font = `900 ${fontSize}px Arial Black, Arial, sans-serif`;

  const lines  = breakLines(ctx, headline2Show, maxTextWidth);
  const lineH  = fontSize * 1.15;
  const totalH = lines.length * lineH + (subtext || body ? fontSize * 0.8 : 0);

  // Vertically center text in top region
  const startY = Math.max(textAreaPad, (textAreaH - totalH) / 2);

  // Text — dark on light
  ctx.fillStyle    = '#1a1814';
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'top';
  ctx.shadowColor  = 'rgba(0,0,0,0.06)';
  ctx.shadowBlur   = 3;
  ctx.shadowOffsetY = 2;

  lines.forEach((line, i) => {
    ctx.font = `900 ${fontSize}px Arial Black, Arial, sans-serif`;
    ctx.fillText(line, SIZE/2, startY + i * lineH);
  });

  // Supporting text — brand color
  const supportText = subtext || (body && !isCover ? body.split('\n')[0] : '');
  if (supportText) {
    const suppSize = Math.min(fontSize * 0.42, 32);
    ctx.font      = `600 ${suppSize}px Arial, sans-serif`;
    ctx.fillStyle = brandColor;
    ctx.shadowBlur = 0;
    ctx.fillText(supportText, SIZE/2, startY + lines.length * lineH + 8);
  }

  // Slide number — small pill, top-left
  if (!isCover && slide.num) {
    ctx.shadowBlur = 0;
    drawPill(ctx, `${slide.num}`, textAreaPad, textAreaPad - 10, brandColor, '#fff', 18, 34);
  }

  // Thin brand underline below last text line
  ctx.shadowBlur = 0;
  const lastLineW = ctx.measureText(lines[lines.length - 1]).width;
  const underlineY = startY + lines.length * lineH + (supportText ? fontSize*0.42 + 20 : 12);
  const underlineW = Math.min(lastLineW * 0.35, 100);
  ctx.fillStyle = brandColor;
  ctx.fillRect(SIZE/2 - underlineW/2, underlineY, underlineW, 4);

  clearShadow(ctx);
}

// ── COVER — same across all styles, but overlay weight varies ──
function drawCover(ctx, slide, brandColor, analysis, textStyle) {
  const { zone, overlayStrength } = analysis;
  const isMinimal  = textStyle === 'minimal';
  const gradDepth  = isMinimal ? overlayStrength * 0.55 : Math.min(overlayStrength + 0.1, 0.93);

  // Gradient anchored to zone
  const [g1, g2] = zoneGrad(zone);
  const grad = ctx.createLinearGradient(0, g1, 0, g2);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(0.5, `rgba(0,0,0,${(gradDepth * 0.55).toFixed(2)})`);
  grad.addColorStop(1, `rgba(0,0,0,${gradDepth.toFixed(2)})`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, SIZE, SIZE);

  const headline = slide.headline || '';
  const subtext  = slide.subtext  || '';
  const maxFontSize = isMinimal ? 80 : 72;
  const fontSize = fitFontSize(ctx, headline, `900 ${maxFontSize}px`, SIZE - PAD*2 - (isMinimal?0:16), maxFontSize, 38);
  ctx.font = `900 ${fontSize}px Arial Black, Arial, sans-serif`;
  const lines  = breakLines(ctx, headline, SIZE - PAD*2 - (isMinimal?0:16));
  const lineH  = fontSize * 1.18;
  const blockH = lines.length * lineH + (subtext ? 52 : 0);
  const blockY = zoneTextY(zone, blockH, PAD);

  if (!isMinimal) {
    // Accent bar — left edge
    ctx.fillStyle = brandColor;
    ctx.fillRect(PAD - 16, blockY - 8, 5, blockH + 16);
  }

  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  setShadow(ctx, 0, 2, isMinimal ? 20 : 12, 'rgba(0,0,0,0.7)');

  lines.forEach((line, i) => {
    ctx.font = `900 ${fontSize}px Arial Black, Arial, sans-serif`;
    ctx.fillText(line, PAD, blockY + i * lineH);
  });

  if (subtext) {
    ctx.font = `600 ${isMinimal?28:24}px Arial, sans-serif`;
    ctx.fillStyle = isMinimal ? 'rgba(255,255,255,0.75)' : brandColor;
    ctx.fillText(isMinimal ? subtext : subtext.toUpperCase(), PAD, blockY + lines.length * lineH + 14);
  }

  clearShadow(ctx);
}

// ── CONTENT — three very different treatments ─────────────────
function drawContent(ctx, slide, brandColor, analysis, textStyle) {
  const { zone, overlayStrength } = analysis;
  const headline = slide.headline || '';
  const body     = slide.body     || '';

  if (textStyle === 'minimal') {
    drawContentMinimal(ctx, slide, brandColor, analysis);
  } else if (textStyle === 'overlay') {
    drawContentOverlay(ctx, slide, brandColor, analysis);
  } else {
    drawContentBalanced(ctx, slide, brandColor, analysis);
  }
}

// MINIMAL — headline only, featherlight gradient, generous negative space
function drawContentMinimal(ctx, slide, brandColor, analysis) {
  const { zone, overlayStrength } = analysis;
  const headline = slide.headline || '';

  // Subtle gradient only — no panel
  const [g1, g2] = zoneGrad(zone);
  const grad = ctx.createLinearGradient(0, g1, 0, g2);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(0.6, `rgba(0,0,0,${(overlayStrength * 0.45).toFixed(2)})`);
  grad.addColorStop(1, `rgba(0,0,0,${(overlayStrength * 0.72).toFixed(2)})`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, SIZE, SIZE);

  // Slide number — small, top corner
  drawPill(ctx, `${slide.num||''}`, PAD, PAD, brandColor, '#fff', 18, 34);

  // Headline — large, clean, no panel behind it
  const fontSize = fitFontSize(ctx, headline, '800 62px', SIZE - PAD*2, 62, 36);
  ctx.font = `800 ${fontSize}px Arial, sans-serif`;
  const lines  = breakLines(ctx, headline, SIZE - PAD*2);
  const lineH  = fontSize * 1.2;
  const blockH = lines.length * lineH;
  const blockY = zoneTextY(zone, blockH, PAD + 60); // avoid overlapping pill

  ctx.fillStyle    = '#ffffff';
  ctx.textAlign    = 'left';
  ctx.textBaseline = 'top';
  setShadow(ctx, 0, 2, 18, 'rgba(0,0,0,0.65)');
  lines.forEach((line, i) => ctx.fillText(line, PAD, blockY + i * lineH));

  // Brand color underline on last word
  ctx.shadowBlur = 0;
  const lastLine = lines[lines.length - 1];
  const lastY    = blockY + (lines.length - 1) * lineH + fontSize + 6;
  const lastW    = ctx.measureText(lastLine).width;
  ctx.fillStyle  = brandColor;
  ctx.fillRect(PAD, lastY, Math.min(lastW * 0.4, 120), 4);

  clearShadow(ctx);
}

// OVERLAY — full panel, headline + body bullets, image is background
function drawContentOverlay(ctx, slide, brandColor, analysis) {
  const { zone, overlayStrength } = analysis;
  const headline = slide.headline || '';
  const body     = slide.body     || '';

  const bodyLines    = body ? body.split('\n').flatMap(l => breakLines(ctx, l, SIZE - PAD*2 - 24, '400 27px')) : [];
  const headFontSize = fitFontSize(ctx, headline, '800 50px', SIZE - PAD*2, 50, 30);
  const headLines    = breakLines(ctx, headline, SIZE - PAD*2, `800 ${headFontSize}px`);
  const lineH        = headFontSize * 1.2;
  const bodyLineH    = 40;
  const pp           = 28;
  const panelH       = pp + headLines.length*lineH + (bodyLines.length>0?16+bodyLines.length*bodyLineH:0) + pp;
  const panelY       = Math.max(0, Math.min(zoneTextY(zone, panelH, 0), SIZE - panelH));

  // Side gradient to keep image visible on opposite side
  const sideGrad = ctx.createLinearGradient(0, zone==='top'?SIZE*0.5:0, 0, zone==='top'?SIZE:SIZE*0.5);
  sideGrad.addColorStop(0, 'rgba(0,0,0,0)');
  sideGrad.addColorStop(1, `rgba(0,0,0,${(overlayStrength*0.2).toFixed(2)})`);
  ctx.fillStyle = sideGrad;
  ctx.fillRect(0, 0, SIZE, SIZE);

  // Panel
  ctx.fillStyle = `rgba(8,6,4,${Math.min(overlayStrength+0.1,0.92).toFixed(2)})`;
  ctx.fillRect(0, panelY, SIZE, panelH);

  // Brand border on panel edge facing into image
  ctx.fillStyle = brandColor;
  ctx.fillRect(0, zone==='top' ? panelY+panelH-4 : panelY, SIZE, 4);

  // Slide number pill
  drawPill(ctx, `${slide.num||''}`, PAD, zone==='top'?panelY+pp:Math.max(panelY-48, 8), brandColor, '#fff');

  ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  setShadow(ctx, 0, 1, 4, 'rgba(0,0,0,0.3)');

  let y = panelY + pp;
  headLines.forEach((line, i) => {
    ctx.font = `800 ${headFontSize}px Arial, sans-serif`;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(line, PAD, y + i*lineH);
  });

  if (bodyLines.length > 0) {
    y += headLines.length*lineH + 16;
    bodyLines.forEach((line, i) => {
      ctx.font = `400 27px Arial, sans-serif`;
      ctx.fillStyle = 'rgba(255,255,255,0.80)';
      ctx.fillText(line, PAD, y + i*bodyLineH);
    });
  }

  clearShadow(ctx);
}

// BALANCED — headline + max one short supporting line, moderate overlay
function drawContentBalanced(ctx, slide, brandColor, analysis) {
  const { zone, overlayStrength } = analysis;
  const headline   = slide.headline || '';
  const body       = slide.body     || '';
  // Only use first line of body for balanced
  const firstBody  = body.split('\n')[0] || '';
  const shortBody  = firstBody.length > 60 ? firstBody.slice(0, 57) + '...' : firstBody;

  const headFontSize = fitFontSize(ctx, headline, '800 52px', SIZE - PAD*2, 52, 32);
  const headLines    = breakLines(ctx, headline, SIZE - PAD*2, `800 ${headFontSize}px`);
  const lineH        = headFontSize * 1.2;
  const hasBody      = shortBody.length > 0;
  const pp           = 24;
  const panelH       = pp + headLines.length*lineH + (hasBody ? 14 + 36 : 0) + pp;
  const panelY       = Math.max(0, Math.min(zoneTextY(zone, panelH, 0), SIZE - panelH));

  // Gradient scrim (not full panel — shows more image)
  const scrimGrad = ctx.createLinearGradient(0, panelY - 60, 0, panelY + panelH);
  scrimGrad.addColorStop(0, 'rgba(0,0,0,0)');
  scrimGrad.addColorStop(0.4, `rgba(0,0,0,${(overlayStrength*0.5).toFixed(2)})`);
  scrimGrad.addColorStop(1, `rgba(0,0,0,${Math.min(overlayStrength+0.05,0.88).toFixed(2)})`);
  ctx.fillStyle = scrimGrad;
  ctx.fillRect(0, panelY - 60, SIZE, panelH + 60);

  // Thin brand line at top of text block
  ctx.fillStyle = brandColor;
  ctx.fillRect(PAD, panelY, Math.min(160, SIZE*0.25), 3);

  // Slide number pill
  drawPill(ctx, `${slide.num||''}`, SIZE - PAD - 70, panelY + pp, brandColor, '#fff');

  ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  setShadow(ctx, 0, 1, 10, 'rgba(0,0,0,0.55)');

  let y = panelY + pp;
  headLines.forEach((line, i) => {
    ctx.font = `800 ${headFontSize}px Arial, sans-serif`;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(line, PAD, y + i*lineH);
  });

  if (hasBody) {
    y += headLines.length*lineH + 14;
    ctx.font = `400 28px Arial, sans-serif`;
    ctx.fillStyle = 'rgba(255,255,255,0.72)';
    ctx.fillText(shortBody, PAD, y);
  }

  clearShadow(ctx);
}

// ── CTA — always full attention, adapts position ──────────────
function drawCTA(ctx, slide, brandColor, analysis) {
  const { zone, overlayStrength } = analysis;
  ctx.fillStyle = `rgba(0,0,0,${Math.min(overlayStrength+0.1,0.88).toFixed(2)})`;
  ctx.fillRect(0, 0, SIZE, SIZE);

  const bandH = 200;
  const bandY = zone==='top' ? SIZE*0.1 : zone==='middle' ? SIZE/2-bandH/2 : SIZE*0.62;

  ctx.fillStyle = brandColor; ctx.globalAlpha = 0.18;
  ctx.fillRect(0, bandY, SIZE, bandH);
  ctx.globalAlpha = 1;

  ctx.strokeStyle = brandColor; ctx.lineWidth = 2.5; ctx.globalAlpha = 0.7;
  ctx.beginPath(); ctx.moveTo(PAD, bandY); ctx.lineTo(SIZE-PAD, bandY); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(PAD, bandY+bandH); ctx.lineTo(SIZE-PAD, bandY+bandH); ctx.stroke();
  ctx.globalAlpha = 1;

  const headline = slide.headline || 'Follow for more';
  const body     = slide.body     || 'Save this for later.';
  const centerY  = bandY + bandH/2;

  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const headSize = fitFontSize(ctx, headline, '800 50px', SIZE-PAD*2, 50, 30);
  ctx.font = `800 ${headSize}px Arial, sans-serif`;
  ctx.fillStyle = '#ffffff';
  setShadow(ctx, 0, 2, 8, 'rgba(0,0,0,0.5)');
  ctx.fillText(headline, SIZE/2, centerY - 28);

  ctx.font = `400 28px Arial, sans-serif`;
  ctx.fillStyle = brandColor;
  ctx.fillText(body, SIZE/2, centerY + 34);
  clearShadow(ctx);
}

// ── BATCH ─────────────────────────────────────────────────────
export async function compositeCarousel(dbSlides, copySlides, visualDna) {
  const results = [];
  for (let i = 0; i < copySlides.length; i++) {
    const url = dbSlides[i]?.image_url;
    if (!url) { results.push(null); continue; }
    try   { results.push(await compositeSlide(url, copySlides[i], visualDna)); }
    catch { results.push(null); }
  }
  return results;
}

// ── HELPERS ───────────────────────────────────────────────────
function extractHex(str) {
  if (!str) return null;
  const m = str.match(/#[0-9a-fA-F]{6}/);
  return m ? m[0] : null;
}

function setShadow(ctx, x, y, blur, color) {
  ctx.shadowOffsetX=x; ctx.shadowOffsetY=y; ctx.shadowBlur=blur; ctx.shadowColor=color;
}

function clearShadow(ctx) {
  ctx.shadowOffsetX=0; ctx.shadowOffsetY=0; ctx.shadowBlur=0; ctx.shadowColor='transparent';
}

function zoneGrad(zone) {
  if (zone==='top')    return [0, SIZE*0.55];
  if (zone==='middle') return [SIZE*0.15, SIZE*0.85];
  return [SIZE*0.3, SIZE];
}

function zoneTextY(zone, blockH, topOffset=PAD) {
  if (zone==='top')    return topOffset;
  if (zone==='middle') return SIZE/2 - blockH/2;
  return SIZE - PAD - blockH;
}

function drawPill(ctx, text, x, y, bg, fg, fontSize=20, height=36) {
  ctx.font = `700 ${fontSize}px Arial, sans-serif`;
  const tw = ctx.measureText(text).width;
  const pw = tw + 26; const pr = 8;
  ctx.fillStyle = bg;
  roundRect(ctx, x, y, pw, height, pr); ctx.fill();
  ctx.fillStyle=fg; ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText(text, x+pw/2, y+height/2);
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y); ctx.quadraticCurveTo(x+w,y,x+w,y+r);
  ctx.lineTo(x+w,y+h-r); ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
  ctx.lineTo(x+r,y+h); ctx.quadraticCurveTo(x,y+h,x,y+h-r);
  ctx.lineTo(x,y+r); ctx.quadraticCurveTo(x,y,x+r,y);
  ctx.closePath();
}

function breakLines(ctx, text, maxW, font) {
  if (font) ctx.font = font;
  const words = (text||'').split(' ');
  const lines = []; let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxW && line) { lines.push(line); line=w; }
    else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

function fitFontSize(ctx, text, fontTemplate, maxW, max, min) {
  for (let s=max; s>=min; s-=2) {
    ctx.font = fontTemplate.replace(/\d+px/, `${s}px`);
    const words=(text||'').split(' ');
    let longest='', cur='';
    for (const w of words) {
      const t = cur ? `${cur} ${w}` : w;
      if (ctx.measureText(t).width > maxW) { if(cur.length>longest.length)longest=cur; cur=w; }
      else cur=t;
    }
    if (cur.length>longest.length) longest=cur;
    if (ctx.measureText(longest).width <= maxW) return s;
  }
  return min;
}
