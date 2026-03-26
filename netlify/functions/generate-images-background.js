// netlify/functions/generate-images-background.js
//
// Netlify Background Function — returns 202 immediately, runs up to 15 min.
// Naming convention: *-background.js tells Netlify to treat it as background.
//
// Progress tracking: writes to Supabase as each image completes.
// Frontend subscribes to Supabase Realtime on the carousels table
// and gets live updates without holding any HTTP connection open.

const {
  validateUser, checkUsageCap, callClaude,
  callDallE, storeImage, getSupabaseAdmin, CORS,
} = require('./_utils');

const PROMPT_SYSTEM = `You are an expert at writing DALL-E 3 image prompts. Respond ONLY with a valid raw JSON array of strings — no markdown fences, no preamble. Start directly with [`;

exports.handler = async (event) => {
  // Background functions must return 202 synchronously before doing any work.
  // Netlify sees the 202 and keeps running the handler async.
  // We do auth + validation first so we can return 400 on bad input.

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS };
  if (event.httpMethod !== 'POST')    return { statusCode: 405, body: 'Method not allowed' };

  let userId, body;

  try {
    userId = await validateUser(event.headers.authorization);
    await checkUsageCap(userId);
    body = JSON.parse(event.body);
  } catch (e) {
    return {
      statusCode: 400,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: e.message }),
    };
  }

  const { session_id, all_copy, visual_dna } = body;

  // ── Return 202 immediately — work continues below ───────
  // (Netlify keeps the Lambda alive after this return in background mode)

  // NOTE: In Netlify background functions the handler keeps running after
  // returning. We kick off the async work without awaiting here.
  runGeneration(userId, session_id, all_copy, visual_dna).catch(async (err) => {
    const db = getSupabaseAdmin();
    await db.from('sessions')
      .update({ status: 'failed', generation_error: err.message })
      .eq('id', session_id);
  });

  return {
    statusCode: 202,
    headers: { ...CORS, 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: 'Generation started', session_id }),
  };
};

async function runGeneration(userId, session_id, all_copy, visual_dna) {
  const db = getSupabaseAdmin();

  // ── Step 1: Generate all image prompts via Claude ────────
  await db.from('sessions').update({ status: 'generating', generation_stage: 'prompts' }).eq('id', session_id);

  const allSubjects = all_copy.flatMap(c =>
    (c.image_prompt_subjects || c.slides.map(s => `${s.type}: ${s.headline}`))
      .map((subject, idx) => ({
        carousel_num: c.carousel_num,
        slide_num: idx + 1,
        subject,
      }))
  );

  const imagePrompts = await callClaude({
    system: PROMPT_SYSTEM,
    maxTokens: 4000,
    user: `Visual DNA anchor (prepend this VERBATIM to every prompt):
"${visual_dna.dalle_style_anchor}"

Generate one DALL-E 3 image prompt per slide. Each prompt = the anchor above (verbatim, first) + slide-specific subject (after). Keep each total prompt under 150 words. Do NOT include text, words, letters, or typography — the app overlays text separately.

Slides (in order):
${allSubjects.map((s, i) => `${i + 1}. Carousel ${s.carousel_num}, Slide ${s.slide_num}: ${s.subject}`).join('\n')}

Return a flat JSON array of ${allSubjects.length} prompt strings in the same order.`,
  });

  // ── Step 2: Insert carousel rows with pending status ─────
  await db.from('sessions').update({ generation_stage: 'images' }).eq('id', session_id);

  const { data: sessionRow } = await db.from('sessions').select('content_plan').eq('id', session_id).single();

  const carouselInserts = all_copy.map(c => ({
    session_id,
    carousel_num:  c.carousel_num,
    hook:    c.slides[0]?.headline || '',
    format:  sessionRow.content_plan?.find(p => p.carousel_num === c.carousel_num)?.format || '',
    caption: c.caption,
    hashtags: c.hashtags,
    status:  'pending',
    slides:  c.slides.map((s, idx) => {
      const subjectIdx = allSubjects.findIndex(
        a => a.carousel_num === c.carousel_num && a.slide_num === idx + 1
      );
      return {
        ...s,
        image_prompt:  imagePrompts[subjectIdx] || '',
        image_url:     null,
        image_status:  'pending',
      };
    }),
  }));

  const { data: carouselRows } = await db
    .from('carousels')
    .insert(carouselInserts)
    .select('id, carousel_num');

  // ── Step 3: Generate images carousel by carousel ─────────
  // Writing slide-level progress back to Supabase after each image.
  // Frontend subscribes via Realtime and sees updates in real time.

  let promptIndex = 0;

  for (const carousel of all_copy) {
    const row = carouselRows.find(r => r.carousel_num === carousel.carousel_num);
    if (!row) continue;

    await db.from('carousels').update({ status: 'generating' }).eq('id', row.id);

    // Deep copy slides so we can mutate and write back
    const slides = JSON.parse(
      JSON.stringify(carouselInserts.find(c => c.carousel_num === carousel.carousel_num).slides)
    );

    for (let i = 0; i < carousel.slides.length; i++) {
      const prompt = imagePrompts[promptIndex] || '';
      promptIndex++;

      // Mark slide as generating
      slides[i] = { ...slides[i], image_status: 'generating' };
      await db.from('carousels').update({ slides }).eq('id', row.id);

      try {
        const tempUrl     = await callDallE(prompt);
        const storagePath = `${session_id}/carousel-${carousel.carousel_num}/slide-${i + 1}.png`;
        const imageUrl    = await storeImage(tempUrl, storagePath);

        slides[i] = { ...slides[i], image_url: imageUrl, image_status: 'done' };
      } catch (imgErr) {
        slides[i] = { ...slides[i], image_status: 'failed', image_error: imgErr.message };
      }

      // Write after every single slide — Realtime pushes this to the frontend
      await db.from('carousels').update({ slides }).eq('id', row.id);
    }

    const allDone = slides.every(s => s.image_status === 'done' || s.image_status === 'failed');
    await db.from('carousels')
      .update({ status: allDone ? 'complete' : 'failed' })
      .eq('id', row.id);
  }

  // ── Step 4: Mark session complete + deduct run ───────────
  await db.from('sessions')
    .update({ status: 'complete', completed_at: new Date().toISOString(), run_deducted: true })
    .eq('id', session_id);

  await db.rpc('increment_runs', { p_user_id: userId });
}
