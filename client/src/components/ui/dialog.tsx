import { cn } from '@/lib/utils';
import { X } from 'lucide-react';

interface DialogProps { open: boolean; onClose: () => void; title?: string; className?: string; children: React.ReactNode; }

export function Dialog({ open, onClose, title, className, children }: DialogProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="fixed inset-0 bg-black/50" />
      <div className={cn('relative z-50 w-full max-w-lg mx-4 rounded-lg border bg-background p-6 shadow-lg', className)} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          {title && <h2 className="text-lg font-semibold">{title}</h2>}
          <button onClick={onClose} className="rounded-sm opacity-70 hover:opacity-100"><X className="h-4 w-4" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
