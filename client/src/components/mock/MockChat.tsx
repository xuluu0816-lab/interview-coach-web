import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { streamChat, generateReview, generateGapReport, completeSession } from '@/lib/api';
import type { Session, MockInterviewConfig, ChatMessage, ReviewReport, RealTimeFeedback } from '@/types';
import { ContextPanel } from './ContextPanel';
import { ArrowLeft, Send, SkipForward, Loader2, PanelRight, Star } from 'lucide-react';
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
  const [gapReport, setGapReport] = useState<any>(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [showContext, setShowContext] = useState(false);
  const [feedback, setFeedback] = useState<RealTimeFeedback | null>(null);
  const [confidence, setConfidence] = useState(3); // 信心自评 1-5
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { handleAction('start', ''); }, []);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, streamingText]);

  const handleAction = (action: string, msg: string) => {
    setIsStreaming(true); setStreamingText(''); setInput(''); setFeedback(null);
    let fullStream = '';
    streamChat(session.id, action, msg, confidence,
      (token) => { fullStream += token; setStreamingText(fullStream); },
      (type, data) => {
        if (type === 'question') {
          setQuestionCount(prev => prev + 1);
          setMessages(prev => [...prev, { role: 'interviewer', content: fullStream || data.text as string, isQuestion: true, category: data.category as string }]);
          setStreamingText(''); fullStream = '';
        }
        if (type === 'quick_feedback' && data && config.feedbackMode === 'practice') {
          setFeedback(data as RealTimeFeedback);
        }
        if (type === 'done') {
          if (fullStream.trim()) setMessages(prev => [...prev, { role: 'interviewer', content: fullStream }]);
          setStreamingText(''); fullStream = ''; setIsStreaming(false);
        }
      },
      (err) => { setIsStreaming(false); alert('请求失败：' + err.message); },
      () => { setIsStreaming(false); setTimeout(() => inputRef.current?.focus(), 100); },
      config.intensity,
      config.feedbackMode
    );
  };

  const handleSend = () => { if (!input.trim() || isStreaming) return; setMessages(prev => [...prev, { role: 'user', content: input.trim() }]); handleAction('answer', input.trim()); };
  const handleSkip = () => { setMessages(prev => [...prev, { role: 'system', content: '已跳过' }]); handleAction('next_question', ''); };
  const handleEndAndReview = async () => {
    setReviewLoading(true);
    try {
      await completeSession(session.id);
      const [reviewResult, gapResult] = await Promise.all([
        generateReview(session.id),
        generateGapReport(session.id).catch(() => null),
      ]);
      setReview(reviewResult);
      setGapReport(gapResult);
      setPhase('review');
    } catch (err: any) { alert(err.message); } finally { setReviewLoading(false); }
  };

  if (phase === 'review' && review) {
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        <Button variant="ghost" onClick={onBack} size="sm" className="mb-2"><ArrowLeft className="w-4 h-4 mr-1" />返回</Button>
        <ReviewReportComponent report={review} />
        {gapReport && <GapReportView report={gapReport} />}
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto flex h-[calc(100vh-10rem)]">
      {/* 对话区 */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3"><Button variant="ghost" onClick={onBack} size="sm"><ArrowLeft className="w-4 h-4" /></Button><div><h2 className="font-semibold">AI模拟面试</h2><p className="text-xs text-gray-400">已提问 {questionCount} 题 | {config.feedbackMode === 'practice' ? '练习模式' : '考试模式'} | {config.intensity === 'mild' ? '温和HR' : config.intensity === 'deep' ? '深挖技术' : 'Bar-raiser'}</p></div></div>
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

        {/* 信心自评 */}
        <div className="flex items-center gap-2 px-1">
          <span className="text-xs text-gray-400 whitespace-nowrap">把握度：</span>
          {[1, 2, 3, 4, 5].map(n => (
            <Star
              key={n}
              className={cn('w-4 h-4 cursor-pointer transition-colors', n <= confidence ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300 hover:text-yellow-300')}
              onClick={() => setConfidence(n)}
            />
          ))}
          <span className="text-xs text-gray-400 ml-1">
            {confidence === 1 ? '完全没把握' : confidence === 2 ? '不太确定' : confidence === 3 ? '一般' : confidence === 4 ? '比较有把握' : '非常有把握'}
          </span>
        </div>

        <div className="pt-2 flex gap-3">
          <Textarea ref={inputRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }} placeholder="输入你的回答... (Enter发送)" className="min-h-[56px] resize-none" disabled={isStreaming} />
          <Button onClick={handleSend} disabled={!input.trim() || isStreaming} size="icon"><Send className="w-4 h-4" /></Button>
        </div>
      </div>

      {/* 右侧参考面板 */}
      {showContext && <ContextPanel jdText={config.jdText} resumeText={config.resumeText} collapsed={false} onToggle={() => setShowContext(false)} />}
    </div>
  );
}

/** MockInterview 风格差距报告展示 */
function GapReportView({ report }: { report: any }) {
  if (!report) return null;

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-bold border-l-4 border-orange-500 pl-3">📊 差距报告（MockInterview 风格）</h3>

      {/* 总体印象 */}
      {report.overallImpression && (
        <div className="bg-gray-50 border rounded-lg p-4">
          <p className="text-sm font-medium text-gray-700 mb-1">总体印象</p>
          <p className="text-sm text-gray-600">{report.overallImpression}</p>
        </div>
      )}

      {/* 能力维度雷达 */}
      {report.dimensionRadar?.length > 0 && (
        <div className="border rounded-lg p-4">
          <p className="text-sm font-medium text-gray-700 mb-3">能力维度评估</p>
          <div className="space-y-2">
            {report.dimensionRadar.map((d: any, i: number) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-xs w-20 text-gray-600">{d.dimension}</span>
                <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all',
                      d.level === 'strong' ? 'bg-green-500' : d.level === 'pass' ? 'bg-yellow-400' : 'bg-red-400',
                    )}
                    style={{ width: `${((d.score || 5) / 10) * 100}%` }}
                  />
                </div>
                <Badge variant="secondary" className={cn(
                  'text-xs',
                  d.level === 'strong' ? 'bg-green-50 text-green-700' : d.level === 'pass' ? 'bg-yellow-50 text-yellow-700' : 'bg-red-50 text-red-700',
                )}>
                  {d.level === 'strong' ? '🟢 强' : d.level === 'pass' ? '🟡 合格' : '🔴 弱'}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 信心盲区 */}
      {report.confidenceBlindSpots?.length > 0 && (
        <div className="border rounded-lg p-4 bg-orange-50 border-orange-200">
          <p className="text-sm font-medium text-orange-800 mb-2">⚠️ 信心盲区（自评高但实际弱——真面试最易翻车）</p>
          {report.confidenceBlindSpots.map((b: any, i: number) => (
            <div key={i} className="text-xs text-orange-700 mt-1">
              <span className="font-medium">Q{b.questionId}</span>：自评 {b.selfRating}/5 分 → 实际 {b.actualLevel}（落差：{b.gap}）
              <p className="text-orange-600 mt-0.5">{b.reminder}</p>
            </div>
          ))}
        </div>
      )}

      {/* 简历经历体检 */}
      {report.resumeHealthCheck?.length > 0 && (
        <div className="border rounded-lg p-4">
          <p className="text-sm font-medium text-gray-700 mb-3">📋 简历经历体检（只诊断，不代写）</p>
          <div className="space-y-2">
            {report.resumeHealthCheck.map((h: any, i: number) => (
              <div key={i} className="text-xs bg-gray-50 rounded p-2">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{h.experience}</span>
                  <Badge className={cn(
                    'text-xs',
                    h.jdFit === '撑得起' ? 'bg-green-50 text-green-700' : h.jdFit === '勉强' ? 'bg-yellow-50 text-yellow-700' : 'bg-red-50 text-red-700',
                  )}>{h.jdFit}</Badge>
                </div>
                <p className="text-gray-500 mt-1">缺失：{h.missingEvidence} | 会被问穿：{h.howPoked}</p>
                <p className="text-blue-600 mt-0.5">补的方向：{h.fixDirection}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 弱项强答案 */}
      {report.weaknessStrongAnswers?.length > 0 && (
        <div className="border rounded-lg p-4">
          <p className="text-sm font-medium text-gray-700 mb-3">💪 弱项可背强答案</p>
          {report.weaknessStrongAnswers.map((w: any, i: number) => (
            <div key={i} className="text-xs mb-2">
              <p className="font-medium text-red-600">{w.dimension}（暴露在：{w.exposedIn}）</p>
              <p className="text-gray-700 mt-1 bg-blue-50 rounded p-2 whitespace-pre-wrap">{w.memorizableAnswer}</p>
            </div>
          ))}
        </div>
      )}

      {/* 反问清单 */}
      {report.counterQuestions?.length > 0 && (
        <div className="border rounded-lg p-4">
          <p className="text-sm font-medium text-gray-700 mb-2">💬 建议反问面试官</p>
          <ul className="list-disc list-inside text-xs text-gray-600 space-y-1">
            {report.counterQuestions.map((q: string, i: number) => <li key={i}>{q}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}
