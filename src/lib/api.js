// src/lib/api.js
import { supabase } from './supabase';

async function getAuthHeader() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');
  return `Bearer ${session.access_token}`;
}

const BASE = '/.netlify/functions';

async function post(path, body) {
  const auth = await getAuthHeader();
  const res = await fetch(`${BASE}/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: auth },
    body: JSON.stringify(body),
  });

  // Safely parse body — background functions sometimes return empty 202
  let data = {};
  const text = await res.text();
  if (text) {
    try { data = JSON.parse(text); } catch (_) { data = {}; }
  }

  if (!res.ok && res.status !== 202) {
    throw new Error(data.error || `Request failed: ${res.status}`);
  }
  return data;
}

// Poll a session field until it hits 'done' or 'failed'
export async function pollSession(sessionId, statusField, resultField, intervalMs = 2000, timeoutMs = 120000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const iv = setInterval(async () => {
      if (Date.now() - start > timeoutMs) {
        clearInterval(iv);
        reject(new Error('Timed out waiting for result. Check Netlify function logs.'));
        return;
      }
      try {
        const { data, error } = await supabase
          .from('sessions')
          .select(`${statusField}, ${resultField}`)
          .eq('id', sessionId)
          .single();
        if (error || !data) return; // retry on error
        if (data[statusField] === 'done') {
          clearInterval(iv);
          resolve(data[resultField]);
        } else if (data[statusField] === 'failed') {
          clearInterval(iv);
          reject(new Error(`Generation failed — check Netlify logs for ${statusField}`));
        }
      } catch (_) { /* retry */ }
    }, intervalMs);
  });
}

export const api = {
  generateNiche: async (topic, goal) => {
    const data = await post('generate-niche-background', { topic, goal });
    return data; // { session_id }
  },

  generatePlan: async (session_id, niche_brief) => {
    await post('generate-plan-background', { session_id, niche_brief });
    return pollSession(session_id, 'plan_status', 'content_plan');
  },

  generateVisualDNA: async (session_id, niche_brief, generate_sample = true) => {
    await post('generate-visual-dna-background', { session_id, niche_brief, generate_sample });
    const dna = await pollSession(session_id, 'dna_status', 'visual_dna', 2000, 180000);
    return { visual_dna: dna };
  },

  generateCopy: async (session_id, niche_brief, content_plan) => {
    await post('generate-copy-background', { session_id, niche_brief, content_plan });
    const copy = await pollSession(session_id, 'copy_status', 'all_copy', 2000, 180000);
    return { all_copy: copy };
  },

  generateImages: (session_id, all_copy, visual_dna) =>
    post('generate-images-background', { session_id, all_copy, visual_dna }),
};
