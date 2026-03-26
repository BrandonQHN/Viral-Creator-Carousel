// netlify/functions/generate-copy-background.js
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

Respond ONLY with valid raw JSON — no markdown fences, no preamble. Start directly with [`;

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

    const result = await callClaude({
      system: SYSTEM,
      maxTokens: 6000,
      user: `Niche: "${session.topic}" | Voice: "${b.voice_descriptor}"
Audience: ${b.audience}
Niche slang to use naturally: ${b.niche_slang?.join(', ')}
Viral insight: ${b.viral_insight}
Pain points: ${b.pain_points.join(', ')}
Desires: ${b.desires.join(', ')}

Content plan:
${content_plan.map(c => `Carousel ${c.carousel_num}: "${c.hook}" — ${c.topic} (${c.format}, ${c.recommended_slides} slides) — angle: ${c.angle}`).join('\n')}

Write all copy for every carousel. Match the voice_descriptor. Use niche slang naturally.

Return JSON array:
[{
  "carousel_num": 1,
  "slides": [
    {"num": 1, "type": "cover", "headline": "hook headline max 8 words", "subtext": "optional 4-6 word subtext or empty string", "body": ""},
    {"num": 2, "type": "content", "headline": "slide headline max 6 words", "subtext": "", "body": "2-3 punchy lines. No padding."},
    {"num": N, "type": "cta", "headline": "Follow for more [niche topic]", "subtext": "", "body": "Save this. You'll thank yourself later."}
  ],
  "caption": "Full caption. Hook first. 80-150 words.",
  "hashtags": "#tag1 #tag2 ... (12-18 hashtags)",
  "image_prompt_subjects": ["what slide 1 image should depict", "what slide 2 image should depict"]
}]`,
    });

    await db.from('sessions').update({ all_copy: result, copy_status: 'done' }).eq('id', session_id);

  } catch (e) {
    console.error('generate-copy-background error:', e.message);
    if (session_id) await db.from('sessions').update({ copy_status: 'failed', copy_error: e.message }).eq('id', session_id);
  }
};
