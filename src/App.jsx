// src/App.jsx
import { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import AuthGate from './components/AuthGate';
import UsageHeader from './components/UsageHeader';
import TopicInput from './components/TopicInput';
import NicheBriefGate from './components/NicheBriefGate';
import ContentPlanGate from './components/ContentPlanGate';
import VisualDNAGate from './components/VisualDNAGate';
import CopyReviewGate from './components/CopyReviewGate';
import GenerationPanel from './components/GenerationPanel';
import OutputPanel from './components/OutputPanel';

const STEPS = ['topic', 'niche', 'plan', 'visual', 'copy', 'generating', 'output'];

export default function App() {
  const [user, setUser]       = useState(null);
  const [userData, setUserData] = useState(null);
  const [step, setStep]       = useState('topic');
  const [session, setSession] = useState({
    session_id: null,
    topic: '',
    goal: 'grow audience',
    niche_brief: null,
    content_plan: null,
    visual_dna: null,
    all_copy: null,
    generation: { events: [], carousels: {} },
  });

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user));
    supabase.auth.onAuthStateChange((_, s) => setUser(s?.user ?? null));
  }, []);

  useEffect(() => {
    if (!user) return;
    supabase.from('users').select('*').eq('id', user.id).single()
      .then(({ data }) => setUserData(data));
  }, [user]);

  const refreshUsage = async () => {
    const { data } = await supabase.from('users').select('*').eq('id', user.id).single();
    setUserData(data);
  };

  const update = (key, val) => setSession(s => ({ ...s, [key]: val }));

  if (!user) return <AuthGate onAuth={setUser} />;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--mono)' }}>
      <UsageHeader user={user} userData={userData} step={step} steps={STEPS} />
      <main style={{ maxWidth: 860, margin: '0 auto', padding: '32px 20px 80px' }}>
        {step === 'topic' && (
          <TopicInput
            onComplete={(topic, goal, session_id, niche_brief) => {
              update('topic', topic); update('goal', goal);
              update('session_id', session_id); update('niche_brief', niche_brief);
              setStep('niche');
            }}
          />
        )}
        {step === 'niche' && (
          <NicheBriefGate
            nicheBrief={session.niche_brief}
            topic={session.topic}
            onChange={val => update('niche_brief', val)}
            onBack={() => setStep('topic')}
            onConfirm={async () => setStep('plan')}
            sessionId={session.session_id}
          />
        )}
        {step === 'plan' && (
          <ContentPlanGate
            sessionId={session.session_id}
            nicheBrief={session.niche_brief}
            onBack={() => setStep('niche')}
            onConfirm={(plan) => { update('content_plan', plan); setStep('visual'); }}
          />
        )}
        {step === 'visual' && (
          <VisualDNAGate
            sessionId={session.session_id}
            nicheBrief={session.niche_brief}
            onBack={() => setStep('plan')}
            onConfirm={(dna) => { update('visual_dna', dna); setStep('copy'); }}
          />
        )}
        {step === 'copy' && (
          <CopyReviewGate
            sessionId={session.session_id}
            nicheBrief={session.niche_brief}
            contentPlan={session.content_plan}
            onBack={() => setStep('visual')}
            onConfirm={(copy) => { update('all_copy', copy); setStep('generating'); }}
          />
        )}
        {step === 'generating' && (
          <GenerationPanel
            session={session}
            onComplete={(updatedSession) => {
              setSession(s => ({ ...s, ...updatedSession }));
              refreshUsage();
              setStep('output');
            }}
          />
        )}
        {step === 'output' && (
          <OutputPanel
            session={session}
            onRestart={() => {
              setSession({ session_id: null, topic: '', goal: 'grow audience', niche_brief: null, content_plan: null, visual_dna: null, all_copy: null, generation: { events: [], carousels: {} } });
              setStep('topic');
            }}
          />
        )}
      </main>
    </div>
  );
}
