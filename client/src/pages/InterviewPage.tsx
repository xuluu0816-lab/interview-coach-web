import { useState } from 'react';
import { InterviewSetup } from '@/components/interview/InterviewSetup';
import { InterviewChat } from '@/components/interview/InterviewChat';
import type { InterviewConfig, Session } from '@/types';

type Step = 'setup' | 'chat';

export default function InterviewPage() {
  const [step, setStep] = useState<Step>('setup');
  const [session, setSession] = useState<Session | null>(null);
  const [config, setConfig] = useState<InterviewConfig | null>(null);

  const handleStart = (s: Session, c: InterviewConfig) => {
    setSession(s);
    setConfig(c);
    setStep('chat');
  };

  const handleBack = () => {
    setStep('setup');
    setSession(null);
  };

  if (step === 'chat' && session) {
    return <InterviewChat session={session} config={config!} onBack={handleBack} />;
  }

  return <InterviewSetup onStart={handleStart} />;
}
