// netlify/functions/generate-plan.js
const { validateUser, callClaude, getSupabaseAdmin, ok, err, CORS } = require('./_utils');

const SYSTEM = `You are an expert Instagram content strategist for faceless niche pages. Respond ONLY with valid raw JSON — no markdown fences, no preamble. Start directly with [`;

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS };
  if (event.httpMethod !== 'POST') return err('Method not allowed', 405);

  try {
    const userId = await validateUser(event.headers.authorization);
    const { session_id, niche_brief } = JSON.parse(event.body);

    const db = getSupabaseAdmin();
    const { data: session } = await db.from('sessions').select('*').eq('id', session_id).eq('user_id', userId).single();
    if (!session) return err('Session not found', 404);

    const b = niche_brief;

    const result = await callClaude({
      system: SYSTEM,
      maxTokens: 1200,
      user: `Niche: "${session.topic}" | Goal: "${session.goal}"
Audience: ${b.audience}
Pain points: ${b.pain_points.join(', ')}
Desires: ${b.desires.join(', ')}
Viral insight: ${b.viral_insight}
Voice: ${b.voice_descriptor}
Pillars: ${b.content_pillars.map(p => p.name).join(', ')}

Plan a week of Instagram carousel content. Recommend 5-8 carousels based on what makes sense for this niche and goal. Mix formats strategically.

Format types and ideal slide counts:
- mistakes_list: 8-10 slides (cover + one mistake per slide + CTA)
- tips_list: 6-9 slides (cover + one tip per slide + CTA)
- how_to_guide: 5-8 slides (cover + steps + CTA)
- myth_busting: 5-7 slides (cover + myth/truth pairs + CTA)
- deep_dive: 4-6 slides (cover + sections + CTA)
- comparison: 4-6 slides (cover + criteria + verdict + CTA)
- story_lesson: 4-5 slides (setup + conflict + resolution + lesson + CTA)
- quick_wins: 5-7 slides (cover + wins + CTA)

Return JSON array:
[{
  "carousel_num": 1,
  "pillar": "exact pillar name from above",
  "format": "format_type",
  "hook": "5-8 word hook with number or power word",
  "topic": "exactly what this carousel teaches",
  "angle": "the unique twist that makes this shareable",
  "recommended_slides": 8,
  "rationale": "one sentence: why this format and count"
}]`,
    });

    await db.from('sessions').update({ content_plan: result }).eq('id', session_id);

    return ok({ content_plan: result });
  } catch (e) {
    return err(e.message);
  }
};
