import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn, gradeColor, gradeLabel } from '@/lib/utils';
import type { ReviewReport as ReviewReportType } from '@/types';
import { Star, Target, Lightbulb } from 'lucide-react';

export function ReviewReport({ report }: { report: ReviewReportType }) {
  return (
    <div className="space-y-4">
      <Card className="border-2 border-primary/20">
        <CardContent className="pt-6 text-center">
          <p className="text-sm text-gray-500">整体评分</p>
          <p className={cn('text-5xl font-bold my-2', report.overall_score >= 28 ? 'text-green-600' : report.overall_score >= 21 ? 'text-yellow-600' : 'text-red-500')}>
            {report.overall_score}<span className="text-xl text-gray-400">/40</span>
          </p>
          <Badge className={cn('text-sm px-3 py-1', gradeColor(report.grade))}>{gradeLabel(report.grade)}</Badge>
          <p className="text-sm text-gray-600 mt-3">{report.overall_feedback}</p>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <h3 className="text-lg font-semibold">逐题分析（共{report.questions.length}题）</h3>
        {report.questions.map((q, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <div className="flex justify-between items-start">
                <div><Badge variant="outline" className="text-xs mb-1">{q.category}</Badge><p className="text-sm font-medium">{q.question_text}</p></div>
                <span className={cn('text-2xl font-bold', q.total >= 28 ? 'text-green-600' : q.total >= 21 ? 'text-yellow-600' : 'text-red-500')}>{q.total}<span className="text-xs text-gray-400">/40</span></span>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-xs text-gray-500">回答摘要：{q.user_answer_summary}</p>
              <div className="flex gap-2 text-xs">
                <span>结构{q.scores.structure}</span><span>内容{q.scores.content}</span><span>表达{q.scores.clarity}</span><span>亮点{q.scores.highlight}</span>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                {q.feedback.strengths.map((s, j) => <span key={j} className="text-green-700 bg-green-50 px-2 py-0.5 rounded"><Star className="w-3 h-3 inline mr-0.5" />{s}</span>)}
              </div>
              {q.feedback.improvements.slice(0, 2).map((imp, j) => (
                <div key={j} className="bg-orange-50 rounded p-2 text-xs"><span className="font-medium text-orange-700"><Target className="w-3 h-3 inline mr-0.5" />{imp.title}</span>：{imp.detail}</div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
