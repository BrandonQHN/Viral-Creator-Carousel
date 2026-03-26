// netlify/functions/generate-visual-dna.js
const { validateUser, callClaude, callDallE, storeImage, getSupabaseAdmin, ok, err, CORS } = require('./_utils');

const SYSTEM = `You are an art director specializing in Instagram visual identity for niche content pages. Respond ONLY with valid raw JSON — no markdown fences, no preamble. Start directly with {`;

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS };
  if (event.httpMethod !== 'POST') return err('Method not allowed', 405);

  try {
    const userId = await validateUser(event.headers.authorization);
    const { session_id, niche_brief, generate_sample = true } = JSON.parse(event.body);

    const db = getSupabaseAdmin();
    const { data: session } = await db.from('sessions').select('*').eq('id', session_id).eq('user_id', userId).single();
    if (!session) return err('Session not found', 404);

    const b = niche_brief;

    const dna = await callClaude({
      system: SYSTEM,
      maxTokens: 1000,
      user: `Niche: "${session.topic}" | Audience: "${b.audience}" | Tone: "${b.voice_descriptor}"
Viral insight: "${b.viral_insight}"

Design a cohesive visual system for a faceless Instagram page about this niche. This system will generate EVERY image across multiple carousels — it must be specific enough that 40+ separately generated images look like one art director made them.

Be extremely specific. Name exact photography styles, color hex values with natural language descriptions, exact lighting setups.

{
  "art_style": "e.g. warm documentary photography, shallow depth of field, natural light only",
  "color_palette": {
    "primary": "#hex — natural language description",
    "secondary": "#hex — description",
    "accent": "#hex — description",
    "background": "#hex — description"
  },
  "lighting": "very specific — e.g. golden hour side lighting, soft shadows, warm 3200K",
  "composition": "e.g. rule of thirds, subject fills 60% of frame, negative space top-right",
  "texture_surface": "e.g. rough organic textures — wood, soil, straw, worn fabric",
  "subject_framing": "e.g. close-up details and mid-shots only, no wide landscape shots",
  "what_to_avoid": "3-4 things that break the aesthetic",
  "dalle_style_anchor": "A single paragraph 60-80 words prepended to EVERY image prompt. Encode art style, colors, lighting, mood. Written as DALL-E prompt language. End with: Do NOT include any text, words, letters, numbers, or typographic elements in this image."
}`,
    });

    // Generate sample image so user can preview before committing
    let sample_image_url = null;
    if (generate_sample) {
      try {
        const sampleSubjects = {
          default: 'a close-up of relevant niche objects on a textured natural surface, beautifully lit',
        };
        const samplePrompt = `${dna.dalle_style_anchor} Subject: ${sampleSubjects.default}`;
        const tempUrl = await callDallE(samplePrompt);
        sample_image_url = await storeImage(tempUrl, `${session_id}/sample.png`);
      } catch (imgErr) {
        // Sample generation failure is non-fatal — user can still proceed
        console.error('Sample image failed:', imgErr.message);
      }
    }

    const payload = { ...dna, sample_image_url };
    await db.from('sessions').update({ visual_dna: payload }).eq('id', session_id);

    return ok({ visual_dna: payload });
  } catch (e) {
    return err(e.message);
  }
};
