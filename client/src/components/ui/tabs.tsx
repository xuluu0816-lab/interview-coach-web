import { cn } from '@/lib/utils';
import * as React from 'react';

const TabsContext = React.createContext<{ value: string; onChange: (v: string) => void }>({ value: '', onChange: () => {} });

export function Tabs({ value, onValueChange, className, children }: { value: string; onValueChange: (v: string) => void; className?: string; children: React.ReactNode }) {
  return (
    <TabsContext.Provider value={{ value, onChange: onValueChange }}>
      <div className={cn('', className)}>{children}</div>
    </TabsContext.Provider>
  );
}

export function TabsList({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn('inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground', className)}>{children}</div>;
}

export function TabsTrigger({ value, children, className }: { value: string; children: React.ReactNode; className?: string }) {
  const ctx = React.useContext(TabsContext);
  return (
    <button onClick={() => ctx.onChange(value)} className={cn(
      'inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
      ctx.value === value ? 'bg-background text-foreground shadow-sm' : 'hover:bg-background/50',
      className
    )}>{children}</button>
  );
}

export function TabsContent({ value, className, children }: { value: string; className?: string; children: React.ReactNode }) {
  const ctx = React.useContext(TabsContext);
  if (ctx.value !== value) return null;
  return <div className={cn('mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', className)}>{children}</div>;
}
