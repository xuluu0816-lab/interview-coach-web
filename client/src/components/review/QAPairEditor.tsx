import { useState, useEffect, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import type { QAPair } from '@/types';
import { Plus, Trash2, Clock, MessageSquare } from 'lucide-react';

interface Props {
  qaPairs: QAPair[];
  onChange: (qaPairs: QAPair[]) => void;
}

/** 格式化秒数为 mm:ss */
function fmtTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function QAPairEditor({ qaPairs, onChange }: Props) {
  // 内部维护一份副本，输入框绑定到本地 state，避免父组件重渲染时 value 被覆盖
  const [local, setLocal] = useState<QAPair[]>(() =>
    qaPairs.map(p => ({ ...p })),
  );

  // 只在外部数据"真正变化"（新增/删除段落）时同步，而非每次渲染
  const prevLength = useRef(qaPairs.length);
  const externalVersion = useRef(0);

  useEffect(() => {
    // 如果段落数量变了（新增或删除），同步外部数据
    if (qaPairs.length !== prevLength.current) {
      prevLength.current = qaPairs.length;
      externalVersion.current++;
      // 保留本地已有的 question/answer 编辑内容，只合并新增的
      setLocal(prev => {
        const existing = new Map(prev.map(p => [p.id, p]));
        return qaPairs.map(p => {
          const old = existing.get(p.id);
          if (old) return old; // 保留本地编辑
          return { ...p };     // 新增的段落
        });
      });
      return;
    }

    // 如果外部数据的 answer 变化了（如来自 STT），且本地 answer 为空，则同步
    const hasNewData = qaPairs.some(p => {
      const lp = local.find(l => l.id === p.id);
      return lp && !lp.answer && p.answer;
    });
    if (hasNewData) {
      externalVersion.current++;
      setLocal(prev =>
        prev.map(p => {
          const ext = qaPairs.find(e => e.id === p.id);
          if (ext && !p.answer && ext.answer) {
            return { ...ext };
          }
          return p;
        }),
      );
    }
  }, [qaPairs]);

  // 每次本地编辑后向上通知
  const notify = (updated: QAPair[]) => {
    onChange(updated);
  };

  const handleChange = (index: number, field: 'question' | 'answer', value: string) => {
    setLocal(prev => {
      const updated = prev.map((pair, i) =>
        i === index ? { ...pair, [field]: value } : pair,
      );
      // 异步通知父组件（不阻塞本地更新）
      setTimeout(() => notify(updated), 0);
      return updated;
    });
  };

  const handleDelete = (index: number) => {
    const target = local[index];
    if ((target.answer.trim() || target.question.trim())) {
      if (!window.confirm('确定删除这个问答对？')) return;
    }
    setLocal(prev => {
      const updated = prev.filter((_, i) => i !== index);
      prevLength.current = updated.length;
      setTimeout(() => notify(updated), 0);
      return updated;
    });
  };

  const handleAdd = () => {
    const pair: QAPair = {
      id: `qa_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      question: '',
      answer: '',
    };
    setLocal(prev => {
      const updated = [...prev, pair];
      prevLength.current = updated.length;
      setTimeout(() => notify(updated), 0);
      return updated;
    });
  };

  if (local.length === 0) {
    return (
      <div className="text-center py-8 space-y-3">
        <MessageSquare className="w-10 h-10 text-gray-300 mx-auto" />
        <p className="text-sm text-gray-400">暂无问答段落</p>
        <p className="text-xs text-gray-400">请先上传录音转写，或点击下方按钮手动添加</p>
        <Button variant="outline" size="sm" onClick={handleAdd}>
          <Plus className="w-3 h-3 mr-1" />添加问答对
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 段落信息 */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <MessageSquare className="w-4 h-4" />
        <span>
          共检测到 <strong className="text-gray-700">{local.length}</strong> 个问答段落
        </span>
        <span className="text-xs text-gray-400">
          （问题需手动输入，答案根据语音停顿自动分割）
        </span>
      </div>

      {/* Q&A 卡片列表 */}
      {local.map((pair, i) => (
        <Card key={pair.id} className="border-l-4 border-l-blue-400">
          <CardContent className="pt-4 space-y-3">
            {/* 行头：编号 + 时间戳 + 删除 */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-blue-100 text-blue-700 text-xs font-bold">
                  {i + 1}
                </span>
                {pair.startTime !== undefined && pair.endTime !== undefined && (
                  <span className="inline-flex items-center gap-1 text-xs text-gray-400 bg-gray-50 px-2 py-0.5 rounded">
                    <Clock className="w-3 h-3" />
                    {fmtTime(pair.startTime)} — {fmtTime(pair.endTime)}
                  </span>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-gray-400 hover:text-red-500 h-7"
                onClick={() => handleDelete(i)}
                title="删除此问答对"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>

            {/* 问题输入 */}
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">
                面试问题 {i + 1}
              </label>
              <Input
                placeholder="输入面试官的问题..."
                value={pair.question}
                onChange={e => handleChange(i, 'question', e.target.value)}
                className="text-sm"
              />
            </div>

            {/* 答案编辑 */}
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">
                你的回答
              </label>
              <Textarea
                className="min-h-[100px] text-sm leading-relaxed"
                placeholder="根据语音停顿自动分割的回答内容..."
                value={pair.answer}
                onChange={e => handleChange(i, 'answer', e.target.value)}
              />
            </div>
          </CardContent>
        </Card>
      ))}

      {/* 添加按钮 */}
      <Button variant="outline" size="sm" onClick={handleAdd} className="w-full border-dashed">
        <Plus className="w-3 h-3 mr-1" />添加问答对
      </Button>
    </div>
  );
}
