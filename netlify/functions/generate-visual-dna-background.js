// netlify/functions/generate-visual-dna-background.js
const { validateUser, callClaude, callDallE, storeImage, getSupabaseAdmin, CORS } = require('./_utils');

const SYSTEM = `You are an art director specializing in Instagram visual identity for faceless niche content pages. Respond ONLY with valid raw JSON — no markdown fences, no preamble. Start directly with {`;

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS };

  const db = getSupabaseAdmin();
  let session_id;

  try {
    await validateUser(event.headers.authorization);
    const body = JSON.parse(event.body || '{}');
    session_id = body.session_id;
    const { niche_brief: b, generate_sample = true } = body;

    const { data: session } = await db.from('sessions').select('*').eq('id', session_id).single();
    if (!session) throw new Error('Session not found');

    await db.from('sessions').update({ dna_status: 'generating' }).eq('id', session_id);

    const dna = await callClaude({
      system: SYSTEM,
      maxTokens: 1800,
      user: `Niche: "${session.topic}" | Audience: "${b.audience}" | Tone: "${b.voice_descriptor}"
Viral insight: "${b.viral_insight}"

Design a visual system for a faceless Instagram carousel page in this niche.

TARGET STYLE: Clean editorial illustration — white or very light cream background, cartoon/illustrated subjects centered or bottom-anchored, bright friendly colors, clear negative space in upper portion for text. Think: educational Instagram carousels that look like illustrated infographics. NOT photography, NOT dark moody images, NOT cinematic. The background must be white or near-white so text can be placed on top without any overlay.

{
  "art_style": "clean flat digital illustration on white background, friendly cartoon style, bright colors, educational infographic aesthetic",
  "color_palette": {
    "primary": "#hex — main brand color for text accents e.g. warm orange or deep teal",
    "secondary": "#hex — secondary accent",
    "accent": "#hex — highlight color",
    "background": "#FFFFFF or #FFF8F0 — always white or very light cream"
  },
  "lighting": "flat even lighting, no shadows, no mood lighting — clean and bright",
  "composition": "illustrated subject anchored at bottom or center, upper 40-50% of frame left as clean white/cream space for text overlay",
  "texture_surface": "slight paper or parchment texture on white background, warm and approachable",
  "subject_framing": "full character or object illustration, centered or bottom-third, surrounded by clean space",
  "what_to_avoid": "dark backgrounds, moody lighting, photography style, cinematic color grading, busy backgrounds, subjects that fill the entire frame",
  "slide_text_style": "Choose ONE based on niche: 'minimal' (lifestyle/story), 'overlay' (educational/tips), 'balanced' (general). For educational niches always pick 'overlay'.",
  "dalle_style_anchor": "60-80 words. MUST specify: white or very light cream background, clean flat illustration style, cartoon characters, bright colors. The prompt will specify text to include on the slide — render it clearly in large bold dark font upper portion, with one key word in accent color. Illustrated subject sits in lower half. Written as DALL-E prompt language. End EXACTLY with: Render all specified text clearly and legibly on the image."
}`,
    });

    let sample_image_url = null;
    if (generate_sample) {
      try {
        const samplePrompt = `${dna.dalle_style_anchor} Subject: a clear illustration of something iconic from the "${session.topic}" niche, centered composition, clean simple background.`;
        const tempUrl = await callDallE(samplePrompt);
        sample_image_url = await storeImage(tempUrl, `${session_id}/sample.png`);
      } catch (imgErr) {
        console.error('Sample image failed:', imgErr.message);
      }
    }

    await db.from('sessions').update({ visual_dna: { ...dna, sample_image_url }, dna_status: 'done' }).eq('id', session_id);

  } catch (e) {
    console.error('generate-visual-dna-background error:', e.message);
    if (session_id) await db.from('sessions').update({ dna_status: 'failed', dna_error: e.message }).eq('id', session_id);
  }
};
