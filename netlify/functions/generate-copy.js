// netlify/functions/generate-copy.js
const { validateUser, callClaude, getSupabaseAdmin, ok, err, CORS } = require('./_utils');

const SYSTEM = `You are an expert Instagram copywriter for faceless niche pages. You write copy that sounds like a real human in the niche — not an AI.

HARD RULES — never violate these:
- No em dashes (—)
- No "delve into", "it's worth noting", "in conclusion", "furthermore", "moreover"
- No "it is important to", "one must", "when considering", "diving deep"
- No "game-changer", "unlock", "harness", "leverage", "in today's world"
- No "at the end of the day", "needless to say", "let's explore"
- Never start a sentence with: When, If, While, Although, As a, In order to
- Never summarize at the end of a caption
- Captions: 80-150 words max. No hashtags in caption body.
- Use contractions always. Short sentences. First person.
- Start captions with the hook — the most valuable or provocative line.
- End captions with a direct question OR a specific save CTA. Never vague "follow for more".

Respond ONLY with valid raw JSON — no markdown fences, no preamble. Start directly with [`;

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS };
  if (event.httpMethod !== 'POST') return err('Method not allowed', 405);

  try {
    const userId = await validateUser(event.headers.authorization);
    const { session_id, niche_brief, content_plan } = JSON.parse(event.body);

    const db = getSupabaseAdmin();
    const { data: session } = await db.from('sessions').select('*').eq('id', session_id).eq('user_id', userId).single();
    if (!session) return err('Session not found', 404);

    const b = niche_brief;

    const slidesSchema = `[{
  "carousel_num": 1,
  "slides": [
    {"num": 1, "type": "cover", "headline": "hook headline max 8 words", "subtext": "optional 4-6 word subtext or empty string", "body": ""},
    {"num": 2, "type": "content", "headline": "slide headline max 6 words", "subtext": "", "body": "2-3 punchy lines. Each line is a complete thought. No padding."},
    ... all slides matching the recommended_slides count for each carousel ...
    {"num": N, "type": "cta", "headline": "Follow for more [niche topic]", "subtext": "", "body": "Save this. You'll thank yourself later."}
  ],
  "caption": "Full caption. Hook first. Value in 2-3 sentences. Ends with question or specific CTA. 80-150 words.",
  "hashtags": "#tag1 #tag2 ... (12-18 hashtags, mix niche-specific and mid-size, no massive generic tags)",
  "image_prompt_subjects": ["what slide 1 image should depict", "what slide 2 image should depict", ...]
}]`;

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

Write all copy for every carousel. Match the voice_descriptor closely. Use the niche slang naturally — not forced. Every caption must sound like a real person in this community wrote it on their phone.

Return this exact shape:
${slidesSchema}`,
    });

    await db.from('sessions').update({ all_copy: result }).eq('id', session_id);

    return ok({ all_copy: result });
  } catch (e) {
    return err(e.message);
  }
};
