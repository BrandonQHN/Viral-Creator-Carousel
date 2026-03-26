// netlify/functions/generate-niche-background.js
// Session row is created by the frontend before calling this function.
// We just need session_id + topic + goal passed in.
const { validateUser, callClaude, getSupabaseAdmin, CORS } = require('./_utils');

const SYSTEM = `You are an expert Instagram growth strategist specializing in faceless niche pages. Respond ONLY with valid raw JSON — no markdown fences, no preamble. Start directly with {`;

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: CORS, body: 'Method not allowed' };

  let userId, body;
  try {
    userId = await validateUser(event.headers.authorization);
    body = JSON.parse(event.body || '{}');
  } catch (e) {
    return { statusCode: 400, headers: { ...CORS, 'Content-Type': 'application/json' }, body: JSON.stringify({ error: e.message }) };
  }

  const { session_id, topic, goal } = body;
  if (!session_id) return { statusCode: 400, headers: { ...CORS, 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'session_id required' }) };

  const db = getSupabaseAdmin();

  // Fire background work — Netlify keeps Lambda alive after 202 return
  runNiche(session_id, topic, goal, db).catch(async (err) => {
    console.error('Niche generation failed:', err.message);
    await db.from('sessions').update({ niche_status: 'failed', niche_error: err.message }).eq('id', session_id);
  });

  return {
    statusCode: 202,
    headers: { ...CORS, 'Content-Type': 'application/json' },
    body: JSON.stringify({ ok: true }),
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
