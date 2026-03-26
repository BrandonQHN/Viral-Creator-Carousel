// netlify/functions/generate-niche.js
const { validateUser, checkUsageCap, callClaude, getSupabaseAdmin, ok, err, CORS } = require('./_utils');

const SYSTEM = `You are an expert Instagram growth strategist specializing in faceless niche pages. You deeply understand what makes content go viral in specific communities. Respond ONLY with valid raw JSON — no markdown fences, no preamble, no explanation. Start directly with {`;

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS };
  if (event.httpMethod !== 'POST') return err('Method not allowed', 405);

  try {
    const userId = await validateUser(event.headers.authorization);
    await checkUsageCap(userId);

    const { topic, goal } = JSON.parse(event.body);
    if (!topic?.trim()) return err('Topic is required');

    const db = getSupabaseAdmin();

    // Create session row
    const { data: session, error: sessionErr } = await db
      .from('sessions')
      .insert({ user_id: userId, topic: topic.trim(), goal: goal || 'grow audience', status: 'drafting' })
      .select('id')
      .single();
    if (sessionErr) throw new Error(sessionErr.message);

    const result = await callClaude({
      system: SYSTEM,
      maxTokens: 1200,
      user: `Research this Instagram niche topic: "${topic}"
Niche goal: "${goal || 'grow audience'}" (grow audience / educate / sell)

Return this exact JSON:
{
  "audience": "2-3 sentences: who they are, skill level, what drives them",
  "pain_points": ["p1", "p2", "p3", "p4", "p5"],
  "desires": ["d1", "d2", "d3", "d4", "d5"],
  "content_pillars": [
    {"name": "Pillar Name", "description": "what this covers", "viral_potential": "high"},
    {"name": "Pillar Name", "description": "what this covers", "viral_potential": "medium"},
    {"name": "Pillar Name", "description": "what this covers", "viral_potential": "high"},
    {"name": "Pillar Name", "description": "what this covers", "viral_potential": "medium"}
  ],
  "voice_descriptor": "3-4 words describing how someone in this niche actually talks",
  "viral_insight": "the single most important insight about what makes content in this niche get shared",
  "niche_slang": ["term1", "term2", "term3", "term4"]
}`,
    });

    // Persist niche brief to session
    await db.from('sessions').update({ niche_brief: result }).eq('id', session.id);

    return ok({ session_id: session.id, niche_brief: result });
  } catch (e) {
    return err(e.message);
  }
};
