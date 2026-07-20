import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn, gradeColor, gradeLabel } from '@/lib/utils';
import type { ReviewReport, ReviewedQuestion } from '@/types';
import { Star, Lightbulb, Target, FileText } from 'lucide-react';

function ScoreBar({ label, score, max = 10 }: { label: string; score: number; max?: number }) {
  const pct = (score / max) * 100;
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-gray-500 w-20">{label}</span>
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all',
            pct >= 70 ? 'bg-green-500' : pct >= 40 ? 'bg-yellow-500' : 'bg-red-400'
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-sm font-semibold w-8 text-right">{score}</span>
    </div>
  );
}

function QuestionReview({ q }: { q: ReviewedQuestion }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="outline" className="text-xs">{q.category}{q.sub_category ? `-${q.sub_category}` : ''}</Badge>
            </div>
            <p className="text-sm text-gray-700 font-medium">{q.question_text}</p>
          </div>
          <div className="text-right ml-4">
            <span className={cn('text-2xl font-bold', q.total >= 28 ? 'text-green-600' : q.total >= 21 ? 'text-yellow-600' : 'text-red-500')}>
              {q.total}
            </span>
            <span className="text-xs text-gray-400">/40</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 回答摘要 */}
        <div>
          <p className="text-xs text-gray-400 mb-1">回答摘要</p>
          <p className="text-sm text-gray-600">{q.user_answer_summary}</p>
        </div>

        {/* 评分 */}
        <div className="space-y-2">
          <ScoreBar label="结构完整性" score={q.scores.structure} />
          <ScoreBar label="内容深度" score={q.scores.content} />
          <ScoreBar label="表达清晰度" score={q.scores.clarity} />
          <ScoreBar label="亮点加分" score={q.scores.highlight} />
        </div>

        {/* 优点 */}
        <div>
          <p className="text-xs text-gray-400 mb-1 flex items-center gap-1">
            <Star className="w-3 h-3" /> 做得好
          </p>
          <ul className="list-disc list-inside space-y-1">
            {q.feedback.strengths.map((s, i) => (
              <li key={i} className="text-sm text-green-700">{s}</li>
            ))}
          </ul>
        </div>

        {/* 改进建议 */}
        <div>
          <p className="text-xs text-gray-400 mb-1 flex items-center gap-1">
            <Target className="w-3 h-3" /> 改进建议
          </p>
          {q.feedback.improvements.map((imp, i) => (
            <div key={i} className="mb-2 pl-4 border-l-2 border-orange-300">
              <p className="text-sm font-medium text-orange-700">{imp.title}</p>
              <p className="text-xs text-gray-600 mt-0.5">{imp.detail}</p>
              {imp.example && (
                <p className="text-xs text-gray-500 italic mt-0.5">示例：{imp.example}</p>
              )}
            </div>
          ))}
        </div>

        {/* 高分示范 */}
        <div className="bg-blue-50 rounded-lg p-3">
          <p className="text-xs text-blue-600 font-medium mb-2 flex items-center gap-1">
            <Lightbulb className="w-3 h-3" /> 高分示范（STAR框架）
          </p>
          <div className="space-y-1 text-xs text-blue-800">
            <p><strong>S:</strong> {q.feedback.model_answer.situation}</p>
            <p><strong>T:</strong> {q.feedback.model_answer.task}</p>
            <p><strong>A:</strong> {q.feedback.model_answer.action}</p>
            <p><strong>R:</strong> {q.feedback.model_answer.result}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function ReviewCard({ report }: { report: ReviewReport }) {
  return (
    <div className="space-y-6">
      {/* 总览 */}
      <Card className="border-2 border-primary/20">
        <CardContent className="pt-6 text-center">
          <p className="text-sm text-gray-500">整体评分</p>
          <p className={cn('text-5xl font-bold my-2', report.overall_score >= 28 ? 'text-green-600' : report.overall_score >= 21 ? 'text-yellow-600' : 'text-red-500')}>
            {report.overall_score}
            <span className="text-xl text-gray-400">/40</span>
          </p>
          <Badge className={cn('text-sm px-3 py-1', gradeColor(report.grade))}>
            {gradeLabel(report.grade)}
          </Badge>
          <p className="text-sm text-gray-600 mt-3">{report.overall_feedback}</p>
        </CardContent>
      </Card>

      {/* 逐题复盘 */}
      <div>
        <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <FileText className="w-4 h-4" /> 逐题复盘（共{report.questions.length}题）
        </h3>
        <div className="space-y-4">
          {report.questions.map((q, i) => (
            <QuestionReview key={i} q={q} />
          ))}
        </div>
      </div>
    </div>
  );
}
