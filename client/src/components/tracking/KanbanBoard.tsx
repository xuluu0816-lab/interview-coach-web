import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn, stageLabel, stageColor } from '@/lib/utils';
import { AppTimeline } from '@/components/tracking/AppTimeline';
import type { ApplicationV2, ApplicationStage } from '@/types';
import { APP_STAGES } from '@/types';
import { Plus, Edit3, Trash2, Calendar, GripVertical } from 'lucide-react';

interface Props {
  applications: ApplicationV2[];
  onMove: (appId: string, to: ApplicationStage) => void;
  onEdit: (app: ApplicationV2) => void;
  onDelete: (id: string) => void;
  onAdd: () => void;
}

export function KanbanBoard({ applications, onMove, onEdit, onDelete, onAdd }: Props) {
  const [dragging, setDragging] = useState<string | null>(null);

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDragging(id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);
  };

  const handleDragEnd = () => setDragging(null);

  const handleDrop = (e: React.DragEvent, stage: ApplicationStage) => {
    e.preventDefault();
    if (dragging) {
      onMove(dragging, stage);
      setDragging(null);
    }
  };

  return (
    <div className="flex gap-3 overflow-x-auto pb-4 min-h-[55vh] snap-x">
      {APP_STAGES.map(stage => {
        const items = applications.filter(a => a.currentStage === stage);
        return (
          <div
            key={stage}
            className="flex-shrink-0 w-60 snap-start"
            onDragOver={e => e.preventDefault()}
            onDrop={e => handleDrop(e, stage)}
          >
            {/* 列头 */}
            <div className="flex items-center justify-between mb-2 px-1 sticky top-0 bg-background z-10">
              <div className="flex items-center gap-2">
                <Badge className={cn('text-xs font-semibold', stageColor(stage))}>
                  {stageLabel(stage)}
                </Badge>
                <span className="text-xs text-gray-400 font-mono">{items.length}</span>
              </div>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onAdd}>
                <Plus className="w-3 h-3" />
              </Button>
            </div>

            {/* 卡片列表 */}
            <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-0.5">
              {items.map(app => (
                <Card
                  key={app.id}
                  className={cn(
                    'cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow select-none',
                    dragging === app.id && 'opacity-40 ring-2 ring-primary'
                  )}
                  draggable
                  onDragStart={e => handleDragStart(e, app.id)}
                  onDragEnd={handleDragEnd}
                >
                  <CardContent className="p-3">
                    <div className="flex items-start gap-1">
                      <GripVertical className="w-3 h-3 text-gray-300 mt-0.5 shrink-0" />
                      <div className="min-w-0 flex-1">
                        {/* 公司 + 岗位 */}
                        <p className="text-sm font-semibold truncate">{app.company}</p>
                        <p className="text-xs text-gray-500 truncate">{app.position}</p>
                        {app.city && (
                          <p className="text-[10px] text-gray-400 mt-0.5">{app.city}</p>
                        )}

                        {/* 紧凑时间线 */}
                        <div className="mt-2">
                          <AppTimeline app={app} compact />
                        </div>

                        {/* 投递日期 */}
                        {app.appliedAt && (
                          <div className="mt-2 flex items-center gap-1 text-[10px] text-gray-400">
                            <Calendar className="w-2.5 h-2.5" />
                            {app.appliedAt}
                          </div>
                        )}
                      </div>

                      {/* 操作按钮 */}
                      <div className="flex flex-col gap-0.5 shrink-0">
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onEdit(app)}>
                          <Edit3 className="w-3 h-3 text-gray-400" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onDelete(app.id)}>
                          <Trash2 className="w-3 h-3 text-red-400" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {/* 空列提示 */}
              {items.length === 0 && (
                <div
                  className="border-2 border-dashed border-gray-200 rounded-lg p-8 text-center text-xs text-gray-400 hover:border-gray-300 transition-colors cursor-pointer"
                  onClick={onAdd}
                >
                  拖拽卡片到此<br />或点击 + 添加
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
