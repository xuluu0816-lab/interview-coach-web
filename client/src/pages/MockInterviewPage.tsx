import { useState } from 'react';
import { MockSetup } from '@/components/mock/MockSetup';
import { MockChat } from '@/components/mock/MockChat';
import type { Session, MockInterviewConfig } from '@/types';

export default function MockInterviewPage() {
  const [step, setStep] = useState<'setup' | 'chat'>('setup');
  const [session, setSession] = useState<Session | null>(null);
  const [config, setConfig] = useState<MockInterviewConfig | null>(null);

  const handleStart = (s: Session, c: MockInterviewConfig) => { setSession(s); setConfig(c); setStep('chat'); };

  return step === 'chat' && session && config
    ? <MockChat session={session} config={config} onBack={() => setStep('setup')} />
    : <MockSetup onStart={handleStart} />;
}
