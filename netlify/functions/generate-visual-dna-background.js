// netlify/functions/generate-visual-dna-background.js
const { validateUser, callClaude, callDallE, storeImage, getSupabaseAdmin, CORS } = require('./_utils');

const SYSTEM = `You are an art director specializing in Instagram visual identity for niche content pages. Respond ONLY with valid raw JSON — no markdown fences, no preamble. Start directly with {`;

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

Design a cohesive visual system for a faceless Instagram page. Must be specific enough that 40+ separately generated images look like one art director made them.

{
  "art_style": "photography style, depth, light source",
  "color_palette": {
    "primary": "#hex — description",
    "secondary": "#hex — description",
    "accent": "#hex — description",
    "background": "#hex — description"
  },
  "lighting": "very specific lighting setup",
  "composition": "framing and layout rules",
  "texture_surface": "surface and texture feel",
  "subject_framing": "what distance/angle shots to use",
  "what_to_avoid": "3-4 things that break the aesthetic",
  "dalle_style_anchor": "60-80 word paragraph prepended to every image prompt. Written as DALL-E prompt language. End with: Do NOT include any text, words, letters, numbers, or typographic elements in this image."
}`,
    });

    let sample_image_url = null;
    if (generate_sample) {
      try {
        const samplePrompt = `${dna.dalle_style_anchor} Subject: a close-up of objects related to "${session.topic}" on a textured natural surface, beautifully composed.`;
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
