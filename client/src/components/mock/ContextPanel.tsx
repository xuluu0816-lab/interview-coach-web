import { cn } from '@/lib/utils';
import type { RecruiterContext } from '@/types';
import { Badge } from '@/components/ui/badge';

interface Props {
  jdText?: string;
  resumeText?: string;
  collapsed: boolean;
  onToggle: () => void;
  recruiterContext?: RecruiterContext | null;
}

export function ContextPanel({ jdText, resumeText, collapsed, onToggle, recruiterContext }: Props) {
  if (collapsed) return (
    <button onClick={onToggle} className="w-8 bg-gray-100 hover:bg-gray-200 rounded-l-lg flex items-center justify-center text-xs text-gray-500">JD<br/>+<br/>CV</button>
  );

  return (
    <div className="w-72 border-l bg-gray-50 flex flex-col h-full">
      <div className="flex items-center justify-between p-3 border-b bg-white"><span className="text-xs font-semibold">面试参考</span><button onClick={onToggle} className="text-xs text-gray-400 hover:text-gray-600">收起 &gt;</button></div>
      <div className="flex-1 overflow-y-auto p-3 space-y-3 text-xs">
        {/* RECRUITER 预备结果 —— Step 0.3 交集分析 */}
        {recruiterContext?.resumeXjdMatrix && recruiterContext.resumeXjdMatrix.length > 0 && (
          <div>
            <p className="font-medium text-orange-700 mb-1.5">📋 简历×JD 交集分析</p>
            <div className="space-y-1.5">
              {recruiterContext.resumeXjdMatrix.map((m, i) => (
                <div key={i} className="bg-white rounded p-2 border">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <Badge className={cn(
                      'text-[10px] px-1 py-0',
                      m.category?.includes('①') ? 'bg-green-50 text-green-700' :
                      m.category?.includes('②') ? 'bg-yellow-50 text-yellow-700' :
                      'bg-red-50 text-red-700',
                    )}>{m.category}</Badge>
                    <span className="font-medium text-gray-700">{m.experience?.slice(0, 20)}{(m.experience?.length || 0) > 20 ? '…' : ''}</span>
                  </div>
                  <p className="text-gray-500 text-[10px]">{m.digDirection}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* RECRUITER 预备结果 —— Step 0.4 维度框架 */}
        {recruiterContext?.dimensionFramework && recruiterContext.dimensionFramework.length > 0 && (
          <div>
            <p className="font-medium text-purple-700 mb-1.5">🎯 能力维度框架</p>
            <div className="space-y-1">
              {recruiterContext.dimensionFramework.map((d, i) => (
                <div key={i} className="flex items-center gap-1.5 bg-white rounded p-1.5 border">
                  <span className="font-medium text-gray-700 w-14 shrink-0">{d.dimension}</span>
                  <span className="text-gray-500 flex-1 truncate">{d.description}</span>
                  <Badge className={cn(
                    'text-[10px] px-1 py-0 shrink-0',
                    d.weight === '高' ? 'bg-red-50 text-red-700' :
                    d.weight === '中' ? 'bg-yellow-50 text-yellow-700' :
                    'bg-gray-50 text-gray-600',
                  )}>{d.weight}</Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {jdText && <div><p className="font-medium text-blue-700 mb-1">JD 原文</p><p className="text-gray-600 whitespace-pre-wrap line-clamp-[15]">{jdText.slice(0, 600)}{jdText.length > 600 && '...'}</p></div>}
        {resumeText && <div><p className="font-medium text-green-700 mb-1">简历 原文</p><p className="text-gray-600 whitespace-pre-wrap line-clamp-[15]">{resumeText.slice(0, 600)}{resumeText.length > 600 && '...'}</p></div>}
        {!jdText && !resumeText && !recruiterContext && <p className="text-gray-400">未提供JD和简历</p>}
      </div>
    </div>
  );
}
