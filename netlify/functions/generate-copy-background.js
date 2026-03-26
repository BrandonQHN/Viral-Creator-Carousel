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
- End captions with a direct question OR specific save CTA. Never vague "follow for more".

Respond ONLY with valid raw JSON — no markdown fences, no preamble. Start directly with [`;

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS };
  if (event.httpMethod !== 'POST')    return { statusCode: 405, body: 'Method not allowed' };

  let userId, body;
  try {
    userId = await validateUser(event.headers.authorization);
    body = JSON.parse(event.body);
  } catch (e) {
    return { statusCode: 400, headers: { ...CORS, 'Content-Type': 'application/json' }, body: JSON.stringify({ error: e.message }) };
  }

  const { session_id, niche_brief, content_plan } = body;
  const db = getSupabaseAdmin();
  const { data: session } = await db.from('sessions').select('*').eq('id', session_id).eq('user_id', userId).single();
  if (!session) return { statusCode: 404, headers: { ...CORS, 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Session not found' }) };

  runCopy(session, niche_brief, content_plan, db).catch(async (err) => {
    await db.from('sessions').update({ copy_status: 'failed', copy_error: err.message }).eq('id', session_id);
  });

  return {
    statusCode: 202,
    headers: { ...CORS, 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: 'Copy generation started' }),
  };
};

async function runCopy(session, b, content_plan, db) {
  await db.from('sessions').update({ copy_status: 'generating' }).eq('id', session.id);

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

Write all copy for every carousel. Match the voice_descriptor. Use niche slang naturally. Every caption must sound like a real person in this community wrote it on their phone.

Return JSON array:
[{
  "carousel_num": 1,
  "slides": [
    {"num": 1, "type": "cover", "headline": "hook headline max 8 words", "subtext": "optional 4-6 word subtext or empty string", "body": ""},
    {"num": 2, "type": "content", "headline": "slide headline max 6 words", "subtext": "", "body": "2-3 punchy lines. No padding."},
    {"num": N, "type": "cta", "headline": "Follow for more [niche topic]", "subtext": "", "body": "Save this. You'll thank yourself later."}
  ],
  "caption": "Full caption. Hook first. Value in 2-3 sentences. Ends with question or specific CTA. 80-150 words.",
  "hashtags": "#tag1 #tag2 ... (12-18 hashtags, mix niche-specific and mid-size)",
  "image_prompt_subjects": ["what slide 1 image should depict", "what slide 2 image should depict"]
}]`,
  });

  await db.from('sessions').update({ all_copy: result, copy_status: 'done' }).eq('id', session.id);
}
