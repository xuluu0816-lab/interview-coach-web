import { useState } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { LayoutDashboard, FileSearch, MessageSquare, ListTodo, Briefcase, Menu } from 'lucide-react';

const navItems = [
  { to: '/', label: '首页', icon: LayoutDashboard },
  { to: '/prep', label: '面试预习', icon: FileSearch },
  { to: '/review', label: '面试复盘', icon: ListTodo },
  { to: '/mock', label: 'AI模拟面试', icon: MessageSquare },
  { to: '/track', label: '投递追踪', icon: ListTodo },
  { to: '/jobs', label: '实时岗位', icon: Briefcase },
];

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  return (
    <div className="flex h-screen bg-gray-50">
      {sidebarOpen && <div className="fixed inset-0 z-20 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      <aside className={cn('fixed inset-y-0 left-0 z-30 w-56 bg-white border-r transform transition-transform lg:translate-x-0 lg:static lg:flex lg:flex-col', sidebarOpen ? 'translate-x-0' : '-translate-x-full')}>
        <div className="flex items-center gap-2 px-5 py-4 border-b">
          <MessageSquare className="w-5 h-5 text-primary" />
          <span className="text-base font-bold">面试助手</span>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map(item => {
            const active = location.pathname === item.to || (item.to !== '/' && location.pathname.startsWith(item.to));
            return (
              <NavLink key={item.to} to={item.to} onClick={() => setSidebarOpen(false)} className={cn('flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors', active ? 'bg-primary/10 text-primary' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900')}>
                <item.icon className="w-4 h-4" />{item.label}
              </NavLink>
            );
          })}
        </nav>
        <div className="px-5 py-3 border-t text-xs text-gray-400">Interview Coach v2.0</div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="flex items-center h-14 px-4 border-b bg-white lg:px-6">
          <button className="lg:hidden p-2 -ml-2 rounded-md hover:bg-gray-100" onClick={() => setSidebarOpen(true)}><Menu className="w-5 h-5" /></button>
          <div className="flex-1" />
          <span className="text-sm text-gray-500">{localStorage.getItem('userName') || '用户'}</span>
        </header>
        <main className="flex-1 overflow-y-auto p-4 lg:p-6"><Outlet /></main>
      </div>
    </div>
  );
}
