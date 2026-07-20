import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { streamChat, generateReview, completeSession } from '@/lib/api';
import type { Session, MockInterviewConfig, ChatMessage, ReviewReport, RealTimeFeedback } from '@/types';
import { ContextPanel } from './ContextPanel';
import { ArrowLeft, Send, SkipForward, Loader2, PanelRight } from 'lucide-react';
import { ReviewReport as ReviewReportComponent } from '@/components/review/ReviewReport';

interface Props { session: Session; config: MockInterviewConfig; onBack: () => void; }

export function MockChat({ session, config, onBack }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [questionCount, setQuestionCount] = useState(0);
  const [phase, setPhase] = useState<'chat' | 'review'>('chat');
  const [review, setReview] = useState<ReviewReport | null>(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [showContext, setShowContext] = useState(false);
  const [feedback, setFeedback] = useState<RealTimeFeedback | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { handleAction('start', ''); }, []);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, streamingText]);

  const handleAction = (action: string, msg: string) => {
    setIsStreaming(true); setStreamingText(''); setInput(''); setFeedback(null);
    let fullStream = '';
    streamChat(session.id, action, msg,
      (token) => { fullStream += token; setStreamingText(fullStream); },
      (type, data) => {
        if (type === 'question') {
          setQuestionCount(prev => prev + 1);
          setMessages(prev => [...prev, { role: 'interviewer', content: fullStream || data.text as string, isQuestion: true, category: data.category as string }]);
          setStreamingText(''); fullStream = '';
        }
        if (type === 'quick_feedback' && data) {
          setFeedback(data as RealTimeFeedback);
        }
        if (type === 'done') {
          if (fullStream.trim()) setMessages(prev => [...prev, { role: 'interviewer', content: fullStream }]);
          setStreamingText(''); fullStream = ''; setIsStreaming(false);
        }
      },
      (err) => { setIsStreaming(false); alert('请求失败：' + err.message); },
      () => { setIsStreaming(false); setTimeout(() => inputRef.current?.focus(), 100); }
    );
  };

  const handleSend = () => { if (!input.trim() || isStreaming) return; setMessages(prev => [...prev, { role: 'user', content: input.trim() }]); handleAction('answer', input.trim()); };
  const handleSkip = () => { setMessages(prev => [...prev, { role: 'system', content: '已跳过' }]); handleAction('next_question', ''); };
  const handleEndAndReview = async () => { setReviewLoading(true); try { await completeSession(session.id); setReview(await generateReview(session.id)); setPhase('review'); } catch (err: any) { alert(err.message); } finally { setReviewLoading(false); } };

  if (phase === 'review' && review) {
    return (
      <div className="max-w-3xl mx-auto"><Button variant="ghost" onClick={onBack} size="sm" className="mb-4"><ArrowLeft className="w-4 h-4 mr-1" />返回</Button><ReviewReportComponent report={review} /></div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto flex h-[calc(100vh-10rem)]">
      {/* 对话区 */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3"><Button variant="ghost" onClick={onBack} size="sm"><ArrowLeft className="w-4 h-4" /></Button><div><h2 className="font-semibold">AI模拟面试</h2><p className="text-xs text-gray-400">已提问 {questionCount} 题 | 模式：{config.mode === 'deep_dive' ? '纵向深挖' : config.mode === 'cross_scenario' ? '横向拓展' : '混合'}</p></div></div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowContext(!showContext)}><PanelRight className="w-4 h-4 mr-1" />JD/简历</Button>
            <Button variant="outline" size="sm" onClick={handleSkip} disabled={isStreaming}><SkipForward className="w-4 h-4 mr-1" />跳过</Button>
            <Button variant="outline" size="sm" onClick={handleEndAndReview} disabled={isStreaming || reviewLoading || questionCount === 0}>{reviewLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : '结束面试'}</Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto space-y-3 pb-4">
          {messages.map((msg, i) => (
            <div key={i} className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
              <div className={cn('max-w-[75%] rounded-lg px-4 py-2.5', msg.role === 'user' ? 'bg-primary text-primary-foreground' : msg.role === 'system' ? 'bg-gray-100 text-gray-500 text-xs italic' : 'bg-gray-100 text-gray-900')}>
                {msg.isQuestion && msg.category && <Badge variant="secondary" className="mb-1 text-xs">{msg.category}</Badge>}
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
              </div>
            </div>
          ))}
          {streamingText && <div className="flex justify-start"><div className="max-w-[75%] rounded-lg px-4 py-2.5 bg-gray-100"><p className="text-sm whitespace-pre-wrap">{streamingText}</p></div></div>}
          {isStreaming && !streamingText && <div className="flex justify-start"><div className="rounded-lg px-4 py-2.5 bg-gray-100"><Loader2 className="w-4 h-4 animate-spin text-gray-400" /></div></div>}

          {/* 实时反馈 */}
          {feedback && (
            <div className="flex justify-start"><div className="max-w-[75%] rounded-lg px-3 py-2 bg-blue-50 border border-blue-100"><p className="text-xs font-medium text-blue-700">即时点评 ({feedback.total}/40)</p><p className="text-xs text-blue-600 mt-0.5">{feedback.quickTips}</p></div></div>
          )}

          <div ref={chatEndRef} />
        </div>

        <div className="border-t pt-3 flex gap-3">
          <Textarea ref={inputRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }} placeholder="输入你的回答... (Enter发送)" className="min-h-[56px] resize-none" disabled={isStreaming} />
          <Button onClick={handleSend} disabled={!input.trim() || isStreaming} size="icon"><Send className="w-4 h-4" /></Button>
        </div>
      </div>

      {/* 右侧参考面板 */}
      {showContext && <ContextPanel jdText={config.jdText} resumeText={config.resumeText} collapsed={false} onToggle={() => setShowContext(false)} />}
    </div>
  );
}
