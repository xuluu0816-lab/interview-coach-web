import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { cn, stageLabel, stageColor, stageStatusLabel, stageStatusColor, formatDate } from '@/lib/utils';
import type { ApplicationV2, ApplicationStage, StageInfo } from '@/types';
import { APP_STAGES } from '@/types';
import { Plus, Edit3, Trash2, Calendar } from 'lucide-react';

interface Props { applications: ApplicationV2[]; onMove: (appId: string, to: ApplicationStage) => void; onEdit: (app: ApplicationV2) => void; onDelete: (id: string) => void; onAdd: () => void; }

export function KanbanBoard({ applications, onMove, onEdit, onDelete, onAdd }: Props) {
  const [dragging, setDragging] = useState<string | null>(null);

  const handleDragStart = (id: string) => setDragging(id);
  const handleDragEnd = () => setDragging(null);
  const handleDrop = (stage: ApplicationStage) => {
    if (dragging) { onMove(dragging, stage); setDragging(null); }
  };

  return (
    <div className="flex gap-4 overflow-x-auto pb-4 min-h-[60vh]">
      {APP_STAGES.map(stage => {
        const items = applications.filter(a => a.currentStage === stage);
        return (
          <div
            key={stage}
            className="flex-shrink-0 w-64"
            onDragOver={e => e.preventDefault()}
            onDrop={() => handleDrop(stage)}
          >
            <div className="flex items-center justify-between mb-2 px-1">
              <div className="flex items-center gap-2">
                <Badge className={cn('text-xs', stageColor(stage))}>{stageLabel(stage)}</Badge>
                <span className="text-xs text-gray-400">{items.length}</span>
              </div>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onAdd}><Plus className="w-3 h-3" /></Button>
            </div>

            <div className="space-y-2">
              {items.map(app => (
                <Card
                  key={app.id}
                  className={cn('cursor-pointer hover:shadow-md transition-shadow', dragging === app.id && 'opacity-50')}
                  draggable
                  onDragStart={() => handleDragStart(app.id)}
                  onDragEnd={handleDragEnd}
                >
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold truncate">{app.company}</p>
                        <p className="text-xs text-gray-500 truncate">{app.position}</p>
                        {app.city && <p className="text-xs text-gray-400 mt-0.5">{app.city}</p>}
                        <div className="flex flex-col gap-0.5 mt-2">
                          {app.appliedAt && <span className="text-[10px] text-gray-400 flex items-center gap-1"><Calendar className="w-2.5 h-2.5" />{app.appliedAt}</span>}
                          {app.stages?.filter(s => s.status === 'passed' || s.status === 'current').slice(0, 3).map((s, i) => (
                            <span key={i} className={cn('text-[10px]', stageStatusColor(s.status))}>{stageLabel(s.stage)} {s.timestamp?.slice(0, 10)}</span>
                          ))}
                        </div>
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onEdit(app)}><Edit3 className="w-3 h-3 text-gray-400" /></Button>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onDelete(app.id)}><Trash2 className="w-3 h-3 text-red-400" /></Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
