// netlify/functions/generate-plan-background.js
const { validateUser, callClaude, getSupabaseAdmin, CORS } = require('./_utils');

const SYSTEM = `You are an expert Instagram content strategist for faceless niche pages. Respond ONLY with valid raw JSON — no markdown fences, no preamble. Start directly with [`;

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS };

  const db = getSupabaseAdmin();
  let session_id;

  try {
    await validateUser(event.headers.authorization);
    const body = JSON.parse(event.body || '{}');
    session_id = body.session_id;
    const { niche_brief: b } = body;

    const { data: session } = await db.from('sessions').select('*').eq('id', session_id).single();
    if (!session) throw new Error('Session not found');

    await db.from('sessions').update({ plan_status: 'generating' }).eq('id', session_id);

    const result = await callClaude({
      system: SYSTEM,
      maxTokens: 2500,
      user: `Niche: "${session.topic}" | Goal: "${session.goal}"
Audience: ${b.audience}
Pain points: ${b.pain_points.join(', ')}
Desires: ${b.desires.join(', ')}
Viral insight: ${b.viral_insight}
Voice: ${b.voice_descriptor}
Pillars: ${b.content_pillars.map(p => p.name).join(', ')}

Plan a week of Instagram carousel content. Recommend 5-8 carousels. Mix formats strategically.

Format types and ideal slide counts:
- mistakes_list: 8-10 slides
- tips_list: 6-9 slides
- how_to_guide: 5-8 slides
- myth_busting: 5-7 slides
- deep_dive: 4-6 slides
- comparison: 4-6 slides
- story_lesson: 4-5 slides
- quick_wins: 5-7 slides

Return JSON array:
[{
  "carousel_num": 1,
  "pillar": "exact pillar name",
  "format": "format_type",
  "hook": "5-8 word hook with number or power word",
  "topic": "exactly what this carousel teaches",
  "angle": "the unique twist that makes this shareable",
  "recommended_slides": 8,
  "rationale": "one sentence: why this format and count"
}]`,
    });

    await db.from('sessions').update({ content_plan: result, plan_status: 'done' }).eq('id', session_id);

  } catch (e) {
    console.error('generate-plan-background error:', e.message);
    if (session_id) await db.from('sessions').update({ plan_status: 'failed', plan_error: e.message }).eq('id', session_id);
  }
};
