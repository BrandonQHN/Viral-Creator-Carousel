// netlify/functions/generate-copy-background.js
// Generates copy one carousel at a time to avoid token limits and timeouts
const { validateUser, callClaude, getSupabaseAdmin, CORS } = require('./_utils');

const SYSTEM = `You are an expert Instagram copywriter for faceless niche pages. You write copy that sounds like a real human in the niche — not an AI.

HARD RULES:
- No em dashes (—)
- No "delve into", "it's worth noting", "in conclusion", "furthermore", "moreover"
- No "game-changer", "unlock", "harness", "leverage", "in today's world"
- Never start a sentence with: When, If, While, Although, As a, In order to
- Never summarize at the end of a caption
- Captions: 80-150 words max. No hashtags in caption body.
- Use contractions always. Short sentences. First person.
- Start captions with the hook — most valuable or provocative line.
- End captions with a direct question OR specific save CTA.

Respond ONLY with valid raw JSON — no markdown fences, no preamble. Start directly with {`;

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS };

  const db = getSupabaseAdmin();
  let session_id;

  try {
    await validateUser(event.headers.authorization);
    const body = JSON.parse(event.body || '{}');
    session_id = body.session_id;
    const { niche_brief: b, content_plan } = body;

    const { data: session } = await db.from('sessions').select('*').eq('id', session_id).single();
    if (!session) throw new Error('Session not found');

    await db.from('sessions').update({ copy_status: 'generating' }).eq('id', session_id);

    const allCopy = [];

    // Generate one carousel at a time — avoids token limits and timeouts
    for (const carousel of content_plan) {
      const result = await callClaude({
        system: SYSTEM,
        maxTokens: 2000,
        user: `Niche: "${session.topic}" | Voice: "${b.voice_descriptor}"
Audience: ${b.audience}
Niche slang to use naturally: ${(b.niche_slang || []).join(', ')}
Viral insight: ${b.viral_insight}

Write copy for this ONE carousel:
Carousel ${carousel.carousel_num}: "${carousel.hook}"
Topic: ${carousel.topic}
Format: ${carousel.format}
Slides: ${carousel.recommended_slides}
Angle: ${carousel.angle}

Return a single JSON object (not an array):
{
  "carousel_num": ${carousel.carousel_num},
  "slides": [
    {"num": 1, "type": "cover", "headline": "hook headline max 8 words", "subtext": "optional 4-6 word subtext or empty string", "body": ""},
    {"num": 2, "type": "content", "headline": "slide headline max 6 words", "subtext": "", "body": "2-3 punchy lines. Each line is a complete thought."},
    ... continue for all ${carousel.recommended_slides} slides ...
    {"num": ${carousel.recommended_slides}, "type": "cta", "headline": "Follow for more [niche] tips", "subtext": "", "body": "Save this. You'll need it later."}
  ],
  "caption": "Full caption. Hook first. 80-150 words. No hashtags.",
  "hashtags": "#tag1 #tag2 ... (12-18 hashtags, mix niche-specific and mid-size)",
  "image_prompt_subjects": ["brief subject description for slide 1 image", "for slide 2", ... for all ${carousel.recommended_slides} slides]
}`,
      });

      allCopy.push(result);

      // Write partial progress after each carousel
      await db.from('sessions').update({ all_copy: allCopy }).eq('id', session_id);
    }

    await db.from('sessions').update({ all_copy: allCopy, copy_status: 'done' }).eq('id', session_id);

  } catch (e) {
    console.error('generate-copy-background error:', e.message);
    if (session_id) await db.from('sessions').update({ copy_status: 'failed', copy_error: e.message }).eq('id', session_id);
  }
};
