// netlify/functions/generate-niche-background.js
//
// Netlify Background Functions: Netlify sends 202 to client automatically.
// The handler just runs to completion — do NOT return early.
// Any return value is ignored. Just await all the work.

const { validateUser, callClaude, getSupabaseAdmin, CORS } = require('./_utils');

const SYSTEM = `You are an expert Instagram growth strategist specializing in faceless niche pages. Respond ONLY with valid raw JSON — no markdown fences, no preamble. Start directly with {`;

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS };

  const db = getSupabaseAdmin();
  let session_id;

  try {
    await validateUser(event.headers.authorization);
    const body = JSON.parse(event.body || '{}');
    session_id = body.session_id;
    const { topic, goal } = body;

    if (!session_id) throw new Error('session_id required');

    // Mark as generating
    await db.from('sessions').update({ niche_status: 'generating' }).eq('id', session_id);

    // Do the actual Claude work
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

    // Write result — this triggers the frontend poll to resolve
    await db.from('sessions').update({ niche_brief: result, niche_status: 'done' }).eq('id', session_id);

  } catch (e) {
    console.error('generate-niche-background error:', e.message);
    if (session_id) {
      await db.from('sessions').update({ niche_status: 'failed', niche_error: e.message }).eq('id', session_id);
    }
  }
};
