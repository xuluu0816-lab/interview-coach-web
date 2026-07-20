import { cn } from '@/lib/utils';

interface Props { jdText?: string; resumeText?: string; collapsed: boolean; onToggle: () => void; }

export function ContextPanel({ jdText, resumeText, collapsed, onToggle }: Props) {
  if (collapsed) return (
    <button onClick={onToggle} className="w-8 bg-gray-100 hover:bg-gray-200 rounded-l-lg flex items-center justify-center text-xs text-gray-500">JD<br/>+<br/>CV</button>
  );

  return (
    <div className="w-64 border-l bg-gray-50 flex flex-col h-full">
      <div className="flex items-center justify-between p-3 border-b bg-white"><span className="text-xs font-semibold">面试参考</span><button onClick={onToggle} className="text-xs text-gray-400 hover:text-gray-600">收起 &gt;</button></div>
      <div className="flex-1 overflow-y-auto p-3 space-y-3 text-xs">
        {jdText && <div><p className="font-medium text-blue-700 mb-1">JD 要点</p><p className="text-gray-600 whitespace-pre-wrap line-clamp-[20]">{jdText.slice(0, 800)}{jdText.length > 800 && '...'}</p></div>}
        {resumeText && <div><p className="font-medium text-green-700 mb-1">简历 要点</p><p className="text-gray-600 whitespace-pre-wrap line-clamp-[20]">{resumeText.slice(0, 800)}{resumeText.length > 800 && '...'}</p></div>}
        {!jdText && !resumeText && <p className="text-gray-400">未提供JD和简历</p>}
      </div>
    </div>
  );
}
