// netlify/functions/generate-niche-background.js
const { validateUser, checkUsageCap, callClaude, getSupabaseAdmin, CORS } = require('./_utils');

const SYSTEM = `You are an expert Instagram growth strategist specializing in faceless niche pages. You deeply understand what makes content go viral in specific communities. Respond ONLY with valid raw JSON — no markdown fences, no preamble, no explanation. Start directly with {`;

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS };
  if (event.httpMethod !== 'POST')    return { statusCode: 405, body: 'Method not allowed' };

  let userId, body;
  try {
    userId = await validateUser(event.headers.authorization);
    await checkUsageCap(userId);
    body = JSON.parse(event.body);
  } catch (e) {
    return { statusCode: 400, headers: { ...CORS, 'Content-Type': 'application/json' }, body: JSON.stringify({ error: e.message }) };
  }

  const { topic, goal } = body;
  if (!topic?.trim()) return { statusCode: 400, headers: { ...CORS, 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Topic is required' }) };

  // Create session row synchronously before returning 202
  const db = getSupabaseAdmin();
  const { data: session, error: sessionErr } = await db
    .from('sessions')
    .insert({ user_id: userId, topic: topic.trim(), goal: goal || 'grow audience', status: 'drafting' })
    .select('id')
    .single();

  if (sessionErr) return { statusCode: 500, headers: { ...CORS, 'Content-Type': 'application/json' }, body: JSON.stringify({ error: sessionErr.message }) };

  // Kick off background work
  runNiche(session.id, topic, goal, db).catch(async (err) => {
    await db.from('sessions').update({ niche_status: 'failed', niche_error: err.message }).eq('id', session.id);
  });

  return {
    statusCode: 202,
    headers: { ...CORS, 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id: session.id }),
  };
};

async function runNiche(sessionId, topic, goal, db) {
  await db.from('sessions').update({ niche_status: 'generating' }).eq('id', sessionId);

  const result = await callClaude({
    system: SYSTEM,
    maxTokens: 900,
    user: `Research this Instagram niche topic: "${topic}"
Niche goal: "${goal || 'grow audience'}"

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
  "viral_insight": "the single most important insight about what makes this niche share content",
  "niche_slang": ["term1", "term2", "term3", "term4"]
}`,
  });

  await db.from('sessions').update({ niche_brief: result, niche_status: 'done' }).eq('id', sessionId);
}
