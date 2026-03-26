// netlify/functions/generate-images-background.js
const {
  validateUser, checkUsageCap, callClaude,
  callDallE, storeImage, getSupabaseAdmin, CORS,
} = require('./_utils');

const PROMPT_SYSTEM = `You are an expert at writing DALL-E 3 image prompts. Respond ONLY with a valid raw JSON array of strings — no markdown fences, no preamble. Start directly with [`;

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS };

  const db = getSupabaseAdmin();
  let session_id;

  try {
    const userId = await validateUser(event.headers.authorization);
    await checkUsageCap(userId);

    const body = JSON.parse(event.body || '{}');
    session_id = body.session_id;
    const { all_copy, visual_dna } = body;

    if (!session_id || !all_copy || !visual_dna) throw new Error('Missing required fields: session_id, all_copy, visual_dna');

    await db.from('sessions').update({ status: 'generating', generation_stage: 'prompts' }).eq('id', session_id);

    // ── Step 1: Generate all image prompts via Claude ──────
    const allSubjects = all_copy.flatMap(c =>
      (c.image_prompt_subjects || c.slides.map(s => `${s.type}: ${s.headline}`))
        .map((subject, idx) => ({ carousel_num: c.carousel_num, slide_num: idx + 1, subject }))
    );

    const imagePrompts = await callClaude({
      system: PROMPT_SYSTEM,
      maxTokens: 4000,
      user: `Visual DNA anchor (prepend VERBATIM to every prompt):
"${visual_dna.dalle_style_anchor}"

Generate one DALL-E 3 image prompt per slide. Each prompt = anchor (verbatim first) + slide subject. Max 150 words each. Never include text, words, letters, or typography in any image.

Slides:
${allSubjects.map((s, i) => `${i + 1}. Carousel ${s.carousel_num}, Slide ${s.slide_num}: ${s.subject}`).join('\n')}

Return a flat JSON array of ${allSubjects.length} strings in order.`,
    });

    // ── Step 2: Load content_plan from DB for format info ──
    const { data: sessionRow } = await db.from('sessions').select('content_plan').eq('id', session_id).single();

    // ── Step 3: Insert carousel rows ──────────────────────
    await db.from('sessions').update({ generation_stage: 'images' }).eq('id', session_id);

    const carouselInserts = all_copy.map(c => ({
      session_id,
      carousel_num: c.carousel_num,
      hook: c.slides[0]?.headline || '',
      format: sessionRow?.content_plan?.find(p => p.carousel_num === c.carousel_num)?.format || '',
      caption: c.caption,
      hashtags: c.hashtags,
      status: 'pending',
      slides: c.slides.map((s, idx) => {
        const subjectIdx = allSubjects.findIndex(
          a => a.carousel_num === c.carousel_num && a.slide_num === idx + 1
        );
        return { ...s, image_prompt: imagePrompts[subjectIdx] || '', image_url: null, image_status: 'pending' };
      }),
    }));

    const { data: carouselRows } = await db.from('carousels').insert(carouselInserts).select('id, carousel_num');

    // ── Step 4: Generate images carousel by carousel ──────
    let promptIndex = 0;

    for (const carousel of all_copy) {
      const row = carouselRows.find(r => r.carousel_num === carousel.carousel_num);
      if (!row) continue;

      await db.from('carousels').update({ status: 'generating' }).eq('id', row.id);

      const slides = JSON.parse(JSON.stringify(
        carouselInserts.find(c => c.carousel_num === carousel.carousel_num).slides
      ));

      for (let i = 0; i < carousel.slides.length; i++) {
        const prompt = imagePrompts[promptIndex] || '';
        promptIndex++;

        slides[i] = { ...slides[i], image_status: 'generating' };
        await db.from('carousels').update({ slides }).eq('id', row.id);

        try {
          const tempUrl = await callDallE(prompt);
          const storagePath = `${session_id}/carousel-${carousel.carousel_num}/slide-${i + 1}.png`;
          const imageUrl = await storeImage(tempUrl, storagePath);
          slides[i] = { ...slides[i], image_url: imageUrl, image_status: 'done' };
        } catch (imgErr) {
          console.error(`Image failed c${carousel.carousel_num} s${i + 1}:`, imgErr.message);
          slides[i] = { ...slides[i], image_status: 'failed', image_error: imgErr.message };
        }

        await db.from('carousels').update({ slides }).eq('id', row.id);
      }

      const allDone = slides.every(s => s.image_status === 'done' || s.image_status === 'failed');
      await db.from('carousels').update({ status: allDone ? 'complete' : 'failed' }).eq('id', row.id);
    }

    // ── Step 5: Complete session + deduct run ─────────────
    await db.from('sessions').update({
      status: 'complete',
      completed_at: new Date().toISOString(),
      run_deducted: true,
    }).eq('id', session_id);

    await db.rpc('increment_runs', { p_user_id: userId });

  } catch (e) {
    console.error('generate-images-background error:', e.message);
    if (session_id) {
      await db.from('sessions').update({ status: 'failed', generation_error: e.message }).eq('id', session_id);
    }
  }
};
