import { cn } from '@/lib/utils';
import { HTMLAttributes, forwardRef } from 'react';

export const ScrollArea = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => (
    <div ref={ref} className={cn('overflow-auto', className)} {...props}>{children}</div>
  )
);
ScrollArea.displayName = 'ScrollArea';
