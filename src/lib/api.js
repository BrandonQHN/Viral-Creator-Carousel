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
  const data = await res.json();
  // Accept 202 (background function accepted) as success
  if (!res.ok && res.status !== 202) throw new Error(data.error || `Request failed: ${res.status}`);
  return data;
}

export const api = {
  generateNiche:     (topic, goal)                           => post('generate-niche',     { topic, goal }),
  generatePlan:      (session_id, niche_brief)               => post('generate-plan',      { session_id, niche_brief }),
  generateVisualDNA: (session_id, niche_brief, generate_sample = true) =>
                                                                post('generate-visual-dna', { session_id, niche_brief, generate_sample }),
  generateCopy:      (session_id, niche_brief, content_plan) => post('generate-copy',       { session_id, niche_brief, content_plan }),

  // Fires the background function (returns 202 immediately).
  // Frontend subscribes to Supabase Realtime for live progress — no connection held open.
  generateImages: (session_id, all_copy, visual_dna) =>
    post('generate-images-background', { session_id, all_copy, visual_dna }),
};
