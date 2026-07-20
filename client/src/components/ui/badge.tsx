import { cn } from '@/lib/utils';
import { HTMLAttributes, forwardRef } from 'react';

export const Badge = forwardRef<
  HTMLDivElement,
  HTMLAttributes<HTMLDivElement> & { variant?: 'default' | 'secondary' | 'destructive' | 'outline' }
>(({ className, variant = 'default', ...props }, ref) => {
  const v: Record<string, string> = {
    default: 'border-transparent bg-primary text-primary-foreground hover:bg-primary/80',
    secondary: 'border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80',
    destructive: 'border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80',
    outline: 'text-foreground',
  };
  return (
    <div
      ref={ref}
      className={cn('inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none', v[variant], className)}
      {...props}
    />
  );
});
Badge.displayName = 'Badge';

export const Separator = forwardRef<HTMLHRElement, HTMLAttributes<HTMLHRElement>>(
  ({ className, ...props }, ref) => (
    <hr ref={ref} className={cn('shrink-0 bg-border h-[1px] w-full', className)} {...props} />
  )
);
Separator.displayName = 'Separator';
