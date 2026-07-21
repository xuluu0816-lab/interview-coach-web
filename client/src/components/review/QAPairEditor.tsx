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
  const handleChange = (index: number, field: 'question' | 'answer', value: string) => {
    const updated = qaPairs.map((pair, i) =>
      i === index ? { ...pair, [field]: value } : pair,
    );
    onChange(updated);
  };

  const handleDelete = (index: number) => {
    const target = qaPairs[index];
    if ((target.answer.trim() || target.question.trim())) {
      if (!window.confirm('确定删除这个问答对？')) return;
    }
    onChange(qaPairs.filter((_, i) => i !== index));
  };

  const handleAdd = () => {
    const pair: QAPair = {
      id: `qa_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      question: '',
      answer: '',
    };
    onChange([...qaPairs, pair]);
  };

  if (qaPairs.length === 0) {
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
          共检测到 <strong className="text-gray-700">{qaPairs.length}</strong> 个问答段落
        </span>
        <span className="text-xs text-gray-400">
          （问题需手动输入，答案根据语音停顿自动分割）
        </span>
      </div>

      {/* Q&A 卡片列表 */}
      {qaPairs.map((pair, i) => (
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
