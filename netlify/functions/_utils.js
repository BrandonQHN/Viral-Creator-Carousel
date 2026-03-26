// netlify/functions/_utils.js
// Shared across all Netlify functions

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL     = process.env.SUPABASE_URL;
const SUPABASE_SERVICE = process.env.SUPABASE_SERVICE_KEY;
const ANTHROPIC_KEY    = process.env.ANTHROPIC_KEY;
const OPENAI_KEY       = process.env.OPENAI_KEY;

// ── Supabase admin client (bypasses RLS for server-side ops) ──
function getSupabaseAdmin() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE);
}

// ── Validate JWT + return user_id ────────────────────────────
async function validateUser(authHeader) {
  if (!authHeader?.startsWith('Bearer ')) throw new Error('Missing auth token');
  const token = authHeader.replace('Bearer ', '');
  const supabase = createClient(SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) throw new Error('Invalid token');
  return user.id;
}

// ── Check + enforce usage cap ────────────────────────────────
async function checkUsageCap(userId) {
  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from('users')
    .select('runs_used, runs_cap, plan')
    .eq('id', userId)
    .single();
  if (error) throw new Error('Could not load user usage');
  if (data.runs_used >= data.runs_cap) {
    throw new Error(`Usage cap reached. You've used ${data.runs_used}/${data.runs_cap} runs this period.`);
  }
  return data;
}

// ── Increment run count (call ONLY on successful completion) ──
async function incrementUsage(userId) {
  const db = getSupabaseAdmin();
  await db.rpc('increment_runs', { p_user_id: userId });
}

// ── Call Claude API ───────────────────────────────────────────
async function callClaude({ system, user, maxTokens = 2000 }) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: user }],
    }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(`Claude API error: ${err.error?.message || res.status}`);
  }
  const data = await res.json();
  const text = data.content.find(b => b.type === 'text')?.text || '';
  // Strip markdown code fences if present
  const clean = text.replace(/^```[\w]*\n?/, '').replace(/\n?```$/, '').trim();
  try {
    return JSON.parse(clean);
  } catch (e) {
    // If JSON is truncated, log it and throw a clear error
    console.error('JSON parse failed. Response length:', clean.length, 'Error:', e.message);
    console.error('Raw response tail:', clean.slice(-200));
    throw new Error(`Claude response was cut off (${clean.length} chars) — maxTokens too low. Increase maxTokens in the function.`);
  }
}

// ── Call DALL-E 3 ─────────────────────────────────────────────
async function callDallE(prompt) {
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_KEY}`,
    },
    body: JSON.stringify({
      model: 'dall-e-3',
      prompt: prompt.slice(0, 4000), // DALL-E prompt limit
      n: 1,
      size: '1024x1024',
      quality: 'standard',
      response_format: 'url',
    }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(`DALL-E error: ${err.error?.message || res.status}`);
  }
  const data = await res.json();
  return data.data[0].url;
}

// ── Upload image URL → Supabase Storage ──────────────────────
async function storeImage(tempUrl, path) {
  const db = getSupabaseAdmin();
  // Download from OpenAI temp URL
  const imgRes = await fetch(tempUrl);
  if (!imgRes.ok) throw new Error('Failed to fetch image from OpenAI');
  const buffer = await imgRes.arrayBuffer();
  const { data, error } = await db.storage
    .from('carousel-images')
    .upload(path, buffer, { contentType: 'image/png', upsert: true });
  if (error) throw new Error(`Storage upload failed: ${error.message}`);
  const { data: urlData } = db.storage.from('carousel-images').getPublicUrl(path);
  return urlData.publicUrl;
}

// ── Standard CORS headers ─────────────────────────────────────
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function ok(body) {
  return { statusCode: 200, headers: { ...CORS, 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}

function err(message, code = 400) {
  return { statusCode: code, headers: { ...CORS, 'Content-Type': 'application/json' }, body: JSON.stringify({ error: message }) };
}

module.exports = { validateUser, checkUsageCap, incrementUsage, callClaude, callDallE, storeImage, getSupabaseAdmin, CORS, ok, err };
