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
  let data = {};
  const text = await res.text();
  if (text) { try { data = JSON.parse(text); } catch (_) { data = {}; } }
  if (!res.ok && res.status !== 202) throw new Error(data.error || `Request failed: ${res.status}`);
  return data;
}

// Poll until statusField = 'done' or 'failed'
export async function pollSession(sessionId, statusField, resultField, intervalMs = 2500, timeoutMs = 600000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const iv = setInterval(async () => {
      if (Date.now() - start > timeoutMs) {
        clearInterval(iv);
        reject(new Error('Timed out — check Netlify function logs for details.'));
        return;
      }
      try {
        const { data, error } = await supabase
          .from('sessions')
          .select(`${statusField}, ${resultField}`)
          .eq('id', sessionId)
          .single();
        if (error || !data) return;
        if (data[statusField] === 'done') { clearInterval(iv); resolve(data[resultField]); }
        else if (data[statusField] === 'failed') {
          clearInterval(iv);
          // Fetch the error detail
          const { data: errRow } = await supabase.from('sessions')
            .select(`${statusField.replace('_status', '_error')}`)
            .eq('id', sessionId).single();
          const errMsg = errRow?.[statusField.replace('_status', '_error')] || 'Unknown error';
          reject(new Error(errMsg));
        }
      } catch (_) { /* retry */ }
    }, intervalMs);
  });
}

export const api = {
  generateNiche: async (session_id, topic, goal) => {
    await post('generate-niche-background', { session_id, topic, goal });
  },

  generatePlan: async (session_id, niche_brief) => {
    await post('generate-plan-background', { session_id, niche_brief });
    return pollSession(session_id, 'plan_status', 'content_plan');
  },

  generateVisualDNA: async (session_id, niche_brief, generate_sample = true) => {
    await post('generate-visual-dna-background', { session_id, niche_brief, generate_sample });
    const dna = await pollSession(session_id, 'dna_status', 'visual_dna', 2500, 300000);
    return { visual_dna: dna };
  },

  // Copy polls with 10 min timeout — generates one carousel at a time
  generateCopy: async (session_id, niche_brief, content_plan) => {
    await post('generate-copy-background', { session_id, niche_brief, content_plan });
    return pollSession(session_id, 'copy_status', 'all_copy', 2500, 600000);
  },

  generateImages: (session_id, all_copy, visual_dna) =>
    post('generate-images-background', { session_id, all_copy, visual_dna }),
};
