import { cn, stageLabel, stageColor, stageStatusLabel, stageStatusColor, formatDate } from '@/lib/utils';
import type { ApplicationV2 } from '@/types';
import { APP_STAGES } from '@/types';
import { Check } from 'lucide-react';

interface Props {
  app: ApplicationV2;
  /** 紧凑模式：用于卡片列表预览 */
  compact?: boolean;
}

/**
 * 7 阶段可视化时间线
 *
 * 渲染规则：
 *  - passed  → 绿色实心圆 + 勾 ✓
 *  - current → 蓝色实心圆（无勾，表示进行中）
 *  - pending（无时间戳）→ 空心圆 + 灰色标签（空白节点，尚未到达）
 *  - pending（有时间戳）→ 空心圆 + 灰色标签（等待中）
 *
 * 竖线：已通过阶段之间为绿色，其余为灰色。
 */
export function AppTimeline({ app, compact = false }: Props) {
  const stages = app.stages || [];

  // 找到最后一个 passed 阶段的索引，用于竖线着色
  const lastPassedIdx = (() => {
    let idx = -1;
    for (let i = APP_STAGES.length - 1; i >= 0; i--) {
      const s = stages.find(st => st.stage === APP_STAGES[i]);
      if (s && s.status === 'passed') { idx = i; break; }
    }
    return idx;
  })();

  if (compact) {
    // 紧凑模式：单行水平展示当前进度
    const currentIdx = APP_STAGES.indexOf(app.currentStage);
    return (
      <div className="flex items-center gap-1 text-xs text-gray-500">
        {APP_STAGES.map((stage, i) => {
          const info = stages.find(s => s.stage === stage);
          const isPassed = info?.status === 'passed';
          const isCurrent = i === currentIdx;
          const isFuture = i > currentIdx && !isPassed;
          return (
            <div key={stage} className="flex items-center gap-0.5">
              <div
                className={cn(
                  'w-2 h-2 rounded-full',
                  isPassed ? 'bg-green-500' : isCurrent ? 'bg-blue-500' : 'bg-gray-200'
                )}
              />
              {i < APP_STAGES.length - 1 && (
                <div className={cn('w-3 h-px', i < lastPassedIdx ? 'bg-green-300' : 'bg-gray-200')} />
              )}
            </div>
          );
        })}
        <span className="ml-1">{stageLabel(app.currentStage)}</span>
      </div>
    );
  }

  // 完整模式：垂直时间线
  return (
    <div className="relative pl-8 space-y-0">
      {APP_STAGES.map((stage, i) => {
        const info = stages.find(s => s.stage === stage);
        const isCurrent = app.currentStage === stage;
        const isPassed = info?.status === 'passed';
        const hasReached = isPassed || isCurrent || (info?.status === 'current');

        // 该阶段从未被到达过（初次录入时未覆盖 或 二次更新时跳过）
        const isUntouched = !info || (info.status === 'pending' && !info.timestamp);

        return (
          <div key={stage} className="relative pb-7 last:pb-0">
            {/* 竖线 */}
            {i < APP_STAGES.length - 1 && (
              <div
                className={cn(
                  'absolute left-[-20px] w-0.5',
                  'top-5',
                  // 高度覆盖到下一个节点
                  i < lastPassedIdx ? 'bg-green-300' : 'bg-gray-200'
                )}
                style={{ height: 'calc(100% - 0.5rem)' }}
              />
            )}

            {/* 节点圆点 */}
            <div
              className={cn(
                'absolute left-[-25px] top-1 w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center',
                isPassed
                  ? 'bg-green-500 border-green-500'
                  : isCurrent
                    ? 'bg-blue-500 border-blue-500 ring-2 ring-blue-200'
                    : 'bg-white border-gray-300'
              )}
            >
              {isPassed && <Check className="w-2 h-2 text-white" />}
            </div>

            {/* 阶段内容 */}
            <div>
              <span
                className={cn(
                  'text-sm font-medium',
                  isUntouched ? 'text-gray-400' : stageColor(stage)
                )}
              >
                {stageLabel(stage)}
              </span>

              {/* 时间戳 */}
              {info?.timestamp && !isUntouched && (
                <span className="text-xs text-gray-400 ml-2">
                  {formatDate(info.timestamp)}
                </span>
              )}

              {/* 状态标签 — 仅在已到达的阶段显示 */}
              {!isUntouched && info?.status && (
                <span className={cn('text-xs ml-2', stageStatusColor(info.status))}>
                  {stageStatusLabel(info.status)}
                </span>
              )}

              {/* 从未到达过的阶段 → 空白提示 */}
              {isUntouched && (
                <span className="text-xs text-gray-300 ml-2">—</span>
              )}

              {/* 备注 */}
              {info?.notes && (
                <p className="text-xs text-gray-500 mt-0.5">{info.notes}</p>
              )}

              {/* 得分 */}
              {info?.score != null && (
                <span className="text-xs text-blue-600 ml-2">得分: {info.score}</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
