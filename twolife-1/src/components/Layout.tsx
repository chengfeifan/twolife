import { Outlet, Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { 
  LayoutDashboard, 
  Clock, 
  Image as ImageIcon, 
  Feather, 
  CalendarHeart, 
  Settings, 
  LogOut 
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useEffect } from 'react';
import { useState } from 'react';
import { Menu, X } from 'lucide-react';

const NAV_ITEMS = [
  { name: '首页', path: '/dashboard', icon: LayoutDashboard },
  { name: '时间线', path: '/timeline', icon: Clock },
  { name: '相册', path: '/photos', icon: ImageIcon },
  { name: '日记', path: '/blog', icon: Feather },
  { name: '纪念日', path: '/anniversaries', icon: CalendarHeart },
  { name: '设置', path: '/settings', icon: Settings },
];

export function Layout() {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const { data: user } = useQuery({
    queryKey: ['me'],
    queryFn: () => api.request('/auth/me')
  });

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: () => api.request('/settings')
  });

  // Apply theme class
  useEffect(() => {
    if (settings?.theme_color) {
      document.documentElement.className = `theme-${settings.theme_color}`;
    }
  }, [settings?.theme_color]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
  };

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  return (
    <div className="flex h-screen w-full bg-background text-foreground font-sans overflow-hidden">
      <button
        className="md:hidden fixed top-4 left-4 z-50 rounded-xl border border-border bg-white/95 p-2 shadow-sm"
        onClick={() => setSidebarOpen((v) => !v)}
        aria-label={sidebarOpen ? '关闭导航' : '打开导航'}
      >
        {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {sidebarOpen && <div className="md:hidden fixed inset-0 bg-black/30 z-30" onClick={() => setSidebarOpen(false)} />}

      {/* Sidebar Navigation */}
      <aside className={cn(
        "border-r border-border bg-white flex flex-col fixed md:static inset-y-0 left-0 z-40 transition-all duration-200",
        sidebarCollapsed ? "md:w-20" : "md:w-64",
        sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      )}>
        <div className={cn("pb-4 flex items-start justify-between", sidebarCollapsed ? "p-4 pt-6" : "p-8")}>
          <div className={cn("text-2xl font-serif italic text-primary font-bold tracking-tight", sidebarCollapsed && "hidden")}>TwoLife</div>
          {!sidebarCollapsed && <div className="text-[10px] uppercase tracking-[0.1em] text-[#B4A096] mt-1">时光记录</div>}
          <button
            className="hidden md:flex p-2 rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
            onClick={() => setSidebarCollapsed((v) => !v)}
            aria-label={sidebarCollapsed ? '展开侧栏' : '收起侧栏'}
          >
            {sidebarCollapsed ? <Menu className="w-4 h-4" /> : <X className="w-4 h-4" />}
          </button>
        </div>

        <nav className="flex-1 px-4 py-4 space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname.startsWith(item.path);
            
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium",
                  sidebarCollapsed && "md:justify-center md:px-2",
                  isActive 
                    ? "bg-secondary text-primary" 
                    : "text-muted-foreground hover:bg-white hover:shadow-sm"
                )}
                title={sidebarCollapsed ? item.name : undefined}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {!sidebarCollapsed && item.name}
              </Link>
            );
          })}
        </nav>

        <div className="p-6 border-t border-border">
          <div className={cn("flex items-center gap-3 w-full justify-between group", sidebarCollapsed && "md:justify-center")}>
            <div className="flex items-center gap-3">
              <div className="flex -space-x-3">
                <div className="w-10 h-10 rounded-full border-2 border-white bg-primary flex items-center justify-center text-xs text-white">
                  {user?.nickname?.[0] || 'U'}
                </div>
                <div className="w-10 h-10 rounded-full border-2 border-white bg-[#A7C5BD] flex items-center justify-center text-xs text-white">
                  ♡
                </div>
              </div>
              <div className={cn("text-sm", sidebarCollapsed && "hidden")}>
                <div className="font-semibold text-foreground">{user?.nickname}</div>
                <div className="text-[10px] text-[#B4A096] uppercase tracking-[0.1em]">{user?.role}</div>
              </div>
            </div>
            <button onClick={handleLogout} className="p-2 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive transition-all">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-y-auto w-full">
        <Outlet />
      </main>
    </div>
  );
}
