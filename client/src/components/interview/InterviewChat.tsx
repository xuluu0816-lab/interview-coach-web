import { useState, useRef, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { streamChat, generateReview, completeSession } from '@/lib/api';
import type { Session, InterviewConfig, ChatMessage, ReviewReport } from '@/types';
import { ReviewCard } from './ReviewCard';
import { ArrowLeft, Send, SkipForward, Loader2 } from 'lucide-react';

interface Props {
  session: Session;
  config: InterviewConfig;
  onBack: () => void;
}

export function InterviewChat({ session, config, onBack }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [currentQuestionId, setCurrentQuestionId] = useState<string | null>(null);
  const [phase, setPhase] = useState<'chat' | 'review'>('chat');
  const [review, setReview] = useState<ReviewReport | null>(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // 自动开始 — 发送 start 动作
  useEffect(() => {
    handleAction('start', '');
  }, []);

  // 自动滚动到底部
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingText]);

  const handleAction = (action: string, msg: string) => {
    setIsStreaming(true);
    setStreamingText('');
    setInput('');

    let fullStream = '';

    streamChat(
      session.id, action, msg,
      // onToken
      (token) => {
        fullStream += token;
        setStreamingText(fullStream);
      },
      // onEvent
      (type, data) => {
        if (type === 'question' && data.question_id) {
          setCurrentQuestionId(data.question_id as string);
          setMessages(prev => [...prev, {
            role: 'interviewer',
            content: fullStream || data.text as string,
            isQuestion: true,
            category: data.category as string,
          }]);
          setStreamingText('');
          fullStream = '';
        }
        if (type === 'done') {
          if (fullStream.trim()) {
            setMessages(prev => [...prev, { role: 'interviewer', content: fullStream }]);
          }
          setStreamingText('');
          fullStream = '';
          setIsStreaming(false);
        }
      },
      // onError
      (err) => {
        setIsStreaming(false);
        alert('请求失败：' + err.message);
      },
      // onDone
      () => {
        setIsStreaming(false);
        // 聚焦输入框
        setTimeout(() => inputRef.current?.focus(), 100);
      }
    );
  };

  const handleSend = () => {
    if (!input.trim() || isStreaming) return;
    const answer = input.trim();
    setMessages(prev => [...prev, { role: 'user', content: answer }]);
    handleAction('answer', answer);
  };

  const handleSkip = () => {
    setMessages(prev => [...prev, { role: 'system', content: '已跳过此题' }]);
    handleAction('next_question', '');
  };

  const handleNextQuestion = () => {
    handleAction('next_question', '');
  };

  const handleEndAndReview = async () => {
    setReviewLoading(true);
    try {
      await completeSession(session.id);
      const report = await generateReview(session.id);
      setReview(report);
      setPhase('review');
    } catch (err: any) {
      alert('生成报告失败：' + err.message);
    } finally {
      setReviewLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (phase === 'review' && review) {
    return (
      <div className="max-w-3xl mx-auto">
        <Button variant="ghost" onClick={() => { onBack(); }} size="sm" className="mb-4">
          <ArrowLeft className="w-4 h-4 mr-1" /> 返回
        </Button>
        <ReviewCard report={review} />
      </div>
    );
  }

  const questionCount = messages.filter(m => m.isQuestion).length;

  return (
    <div className="max-w-3xl mx-auto flex flex-col h-[calc(100vh-10rem)]">
      {/* 顶栏 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" onClick={onBack} size="sm">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h2 className="font-semibold">{config.company || '模拟面试'}</h2>
            <p className="text-xs text-gray-400">{config.role} · 第{questionCount}题</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleSkip} disabled={isStreaming}>
            <SkipForward className="w-4 h-4 mr-1" /> 跳过
          </Button>
          <Button
            variant="outline" size="sm"
            onClick={handleEndAndReview}
            disabled={isStreaming || reviewLoading || questionCount === 0}
          >
            {reviewLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : '结束面试'}
          </Button>
        </div>
      </div>

      {/* 对话区 */}
      <div className="flex-1 overflow-y-auto space-y-4 pb-4">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={cn(
              'flex',
              msg.role === 'user' ? 'justify-end' : 'justify-start'
            )}
          >
            <div className={cn(
              'max-w-[80%] rounded-lg px-4 py-3',
              msg.role === 'user'
                ? 'bg-primary text-primary-foreground'
                : msg.role === 'system'
                  ? 'bg-gray-100 text-gray-500 text-sm italic'
                  : 'bg-gray-100 text-gray-900'
            )}>
              {msg.isQuestion && msg.category && (
                <Badge variant="secondary" className="mb-2 text-xs">{msg.category}</Badge>
              )}
              <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
            </div>
          </div>
        ))}

        {/* 流式输出 */}
        {streamingText && (
          <div className="flex justify-start">
            <div className="max-w-[80%] rounded-lg px-4 py-3 bg-gray-100">
              <p className="text-sm whitespace-pre-wrap">{streamingText}</p>
            </div>
          </div>
        )}

        {isStreaming && !streamingText && (
          <div className="flex justify-start">
            <div className="rounded-lg px-4 py-3 bg-gray-100">
              <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
            </div>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* 输入区 */}
      <div className="border-t pt-4 mt-2">
        <div className="flex gap-3">
          <Textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入你的回答... (Enter 发送，Shift+Enter 换行)"
            className="min-h-[60px] resize-none"
            disabled={isStreaming}
          />
          <div className="flex flex-col gap-2">
            <Button onClick={handleSend} disabled={!input.trim() || isStreaming} size="icon">
              <Send className="w-4 h-4" />
            </Button>
            <Button variant="outline" onClick={handleNextQuestion} disabled={isStreaming} size="icon" title="下一题">
              <SkipForward className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
