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

Design a visual system for a faceless Instagram carousel page in this niche. Style reference: clean digital illustration like successful educational Instagram pages — flat or semi-flat, clear subjects, bright approachable colors, simple backgrounds. NOT photography. Text is overlaid by the app so images are supporting visuals only.

Adapt the style specifically to this niche's aesthetic and audience. 40+ images must look consistent.

{
  "art_style": "specific illustration style — e.g. clean flat digital illustration, slightly textured, educational infographic feel",
  "color_palette": {
    "primary": "#hex — description",
    "secondary": "#hex — description",
    "accent": "#hex — description",
    "background": "#hex — description e.g. soft cream or clean white"
  },
  "lighting": "how light works in illustrations — e.g. soft diffused, subtle shadows, no harsh contrast",
  "composition": "layout rules — e.g. centered subject, clean negative space, subject fills 60-70% of frame",
  "texture_surface": "texture feel — e.g. slight paper texture, gentle grain",
  "subject_framing": "what to depict — e.g. close-up of subject, minimal background, clear focal point",
  "what_to_avoid": "e.g. photorealism, cluttered compositions, dark moody tones, complex backgrounds, text",
  "dalle_style_anchor": "60-80 words prepended to every DALL-E prompt. Must encode: illustration style, color palette, mood, composition rules. Written as DALL-E prompt language, not prose. Make it specific to this niche. End EXACTLY with this sentence: Do NOT include any text, words, letters, numbers, or typographic elements in this image."
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
