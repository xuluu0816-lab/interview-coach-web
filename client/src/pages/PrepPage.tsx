import { useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { JdAnalyzer } from '@/components/prep/JdAnalyzer';
import { MockSetup } from '@/components/mock/MockSetup';
import { MockChat } from '@/components/mock/MockChat';
import type { Session, MockInterviewConfig } from '@/types';
import { FileSearch, MessageSquare } from 'lucide-react';

export default function PrepPage() {
  const [tab, setTab] = useState('prep');
  const [mockStep, setMockStep] = useState<'setup' | 'chat'>('setup');
  const [session, setSession] = useState<Session | null>(null);
  const [config, setConfig] = useState<MockInterviewConfig | null>(null);

  const handleMockStart = (s: Session, c: MockInterviewConfig) => { setSession(s); setConfig(c); setMockStep('chat'); };

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div><h1 className="text-2xl font-bold">面试准备</h1><p className="text-gray-500 text-sm mt-1">JD预习分析 + AI模拟面试，一站式备战</p></div>

      <Tabs value={tab} onValueChange={v => { setTab(v); if (v === 'mock') setMockStep('setup'); }}>
        <TabsList className="w-full max-w-md">
          <TabsTrigger value="prep" className="flex-1"><FileSearch className="w-4 h-4 mr-1" />JD预习</TabsTrigger>
          <TabsTrigger value="mock" className="flex-1"><MessageSquare className="w-4 h-4 mr-1" />AI模拟面试</TabsTrigger>
        </TabsList>

        <TabsContent value="prep"><JdAnalyzer /></TabsContent>

        <TabsContent value="mock">
          {mockStep === 'chat' && session && config
            ? <MockChat session={session} config={config} onBack={() => setMockStep('setup')} />
            : <MockSetup onStart={handleMockStart} />
          }
        </TabsContent>
      </Tabs>
    </div>
  );
}
