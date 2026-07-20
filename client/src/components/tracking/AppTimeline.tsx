import { cn, stageLabel, stageColor, stageStatusLabel, stageStatusColor, formatDate } from '@/lib/utils';
import type { ApplicationV2, ApplicationStage } from '@/types';
import { APP_STAGES } from '@/types';
import { Check, Clock, SkipForward, Circle } from 'lucide-react';

export function AppTimeline({ app }: { app: ApplicationV2 }) {
  return (
    <div className="relative pl-8 space-y-1">
      {APP_STAGES.map((stage, i) => {
        const info = app.stages?.find(s => s.stage === stage);
        const isCurrent = app.currentStage === stage;
        const isPassed = info?.status === 'passed';
        const isSkipped = info?.status === 'skipped';

        return (
          <div key={stage} className="relative pb-6 last:pb-0">
            {/* 竖线 */}
            {i < APP_STAGES.length - 1 && (
              <div className={cn('absolute left-[-20px] top-6 w-0.5 h-full', isPassed ? 'bg-green-300' : 'bg-gray-200')} />
            )}
            {/* 圆点 */}
            <div className={cn(
              'absolute left-[-25px] top-1 w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center',
              isPassed ? 'bg-green-500 border-green-500' : isSkipped ? 'bg-gray-300 border-gray-300' : isCurrent ? 'bg-blue-500 border-blue-500' : 'bg-white border-gray-300'
            )}>
              {isPassed && <Check className="w-2 h-2 text-white" />}
              {isSkipped && <SkipForward className="w-2 h-2 text-white" />}
            </div>
            {/* 内容 */}
            <div>
              <span className={cn('text-sm font-medium', stageColor(stage))}>{stageLabel(stage)}</span>
              {info?.timestamp && <span className="text-xs text-gray-400 ml-2">{formatDate(info.timestamp)}</span>}
              {info?.status && (
                <span className={cn('text-xs ml-2', stageStatusColor(info.status))}>{stageStatusLabel(info.status)}</span>
              )}
              {info?.notes && <p className="text-xs text-gray-500 mt-1">{info.notes}</p>}
              {info?.score != null && <span className="text-xs text-blue-600 ml-2">得分: {info.score}</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
