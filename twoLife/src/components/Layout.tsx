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

  const { data: user } = useQuery({
    queryKey: ['me'],
    queryFn: () => api.request('/auth/me')
  });

  // Apply theme class
  useEffect(() => {
    const theme = localStorage.getItem('two-life-theme') || 'pink';
    document.documentElement.className = `theme-${theme}`;
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
  };

  return (
    <div className="flex h-screen w-full bg-background text-foreground font-sans overflow-hidden">
      {/* Sidebar Navigation */}
      <aside className="w-64 border-r border-border bg-white flex flex-col">
        <div className="p-8 pb-4">
          <div className="text-2xl font-serif italic text-primary font-bold tracking-tight">TwoLife</div>
          <div className="text-[10px] uppercase tracking-[0.1em] text-[#B4A096] mt-1">时光记录</div>
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
                  isActive 
                    ? "bg-secondary text-primary" 
                    : "text-muted-foreground hover:bg-white hover:shadow-sm"
                )}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="p-6 border-t border-border">
          <div className="flex items-center gap-3 w-full justify-between group">
            <div className="flex items-center gap-3">
              <div className="flex -space-x-3">
                <div className="w-10 h-10 rounded-full border-2 border-white bg-primary flex items-center justify-center text-xs text-white">
                  {user?.nickname?.[0] || 'U'}
                </div>
                <div className="w-10 h-10 rounded-full border-2 border-white bg-[#A7C5BD] flex items-center justify-center text-xs text-white">
                  ♡
                </div>
              </div>
              <div className="text-sm">
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
      <main className="flex-1 flex flex-col overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
