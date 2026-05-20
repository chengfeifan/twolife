import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { CalendarHeart, MapPin, Search } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { Link } from 'react-router-dom';

export function Dashboard() {
  const { data: user } = useQuery({ queryKey: ['me'], queryFn: () => api.request('/auth/me') });
  const { data: annivs } = useQuery({ queryKey: ['anniversaries'], queryFn: () => api.request('/anniversaries') });
  const { data: timeline } = useQuery({ queryKey: ['timeline'], queryFn: () => api.request('/timeline') });
  const { data: posts } = useQuery({ queryKey: ['posts'], queryFn: () => api.request('/posts') });
  const { data: photos } = useQuery({ queryKey: ['photos'], queryFn: () => api.request('/photos') });

  const firstMeetDateStr = annivs?.[0]?.date || '2023-05-20';
  const meetingPlace = annivs?.[0]?.title || 'we met';
  const daysTogether = differenceInDays(new Date(), new Date(firstMeetDateStr));

  const upcomingAnniversary = annivs?.[0]; // Assuming sorted by date

  return (
    <div className="p-8 max-w-7xl mx-auto w-full">
      {/* Header Section */}
      <header className="flex flex-col sm:flex-row sm:justify-between sm:items-end mb-8 gap-4">
        <div>
          <h1 className="text-4xl font-serif font-bold text-foreground mb-1">
            你好，{user?.nickname}。
          </h1>
          <p className="text-muted-foreground">今天是 {format(new Date(), 'yyyy年MM月dd日')}。</p>
        </div>
        <div className="sm:text-right">
          <div className="text-5xl font-serif text-primary font-light tracking-tight">
            {daysTogether} <span className="text-lg font-sans text-muted-foreground ml-1">天</span>
          </div>
          <div className="text-xs uppercase tracking-[0.2em] text-[#B4A096] mt-1">从 {meetingPlace} 点滴开始</div>
        </div>
      </header>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-0">
        
        {/* Left Column: Anniversary & Photos */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          {/* Anniversary Card */}
          <div className="bg-[#F9EDEB] p-8 rounded-[2rem] border border-[#F2D7D4] flex flex-col min-h-[300px] justify-between relative overflow-hidden group">
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-4">
                <span className="p-2 bg-white rounded-full text-primary shadow-sm group-hover:scale-110 transition-transform">
                  <CalendarHeart className="w-5 h-5 fill-current opacity-20 absolute" />
                  <CalendarHeart className="w-5 h-5" />
                </span>
                <span className="text-xs uppercase tracking-widest font-bold text-primary">里程碑</span>
              </div>
              <h2 className="text-3xl font-serif font-bold mb-2 text-foreground leading-tight">
                {upcomingAnniversary?.title || '我们的纪念日'}
              </h2>
              <p className="text-muted-foreground">{upcomingAnniversary?.description || '一个值得庆祝的特殊日子。'}</p>
            </div>
            
            <div className="mt-8 flex items-center justify-between relative z-10">
              <div className="flex gap-2">
                <div className="text-center">
                  <div className="w-14 h-14 bg-white/80 backdrop-blur rounded-2xl flex items-center justify-center text-2xl font-bold font-serif text-foreground shadow-sm">
                    {Math.floor(daysTogether / 365)}
                  </div>
                  <div className="text-[10px] mt-2 uppercase font-semibold text-muted-foreground tracking-wider">年</div>
                </div>
              </div>
              <Link to="/anniversaries" className="px-6 py-3 bg-primary text-primary-foreground rounded-full text-sm font-medium hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20">
                查看全部
              </Link>
            </div>
          </div>

          {/* Photos Grid */}
          <div className="bg-card p-8 rounded-[2rem] border border-border shadow-sm flex flex-col min-h-[300px]">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-serif font-bold">近期回忆</h3>
              <Link to="/photos" className="text-xs text-primary font-medium hover:underline">查看全部</Link>
            </div>
            <div className="grid grid-cols-2 gap-3 flex-1 min-h-[220px]">
              {photos
                ?.slice()
                .sort((a: any, b: any) => new Date(b.created_at || b.taken_date).getTime() - new Date(a.created_at || a.taken_date).getTime())
                .slice(0, 4)
                .map((photo: any) => (
                  <Link key={photo.id} to="/photos" className="aspect-square bg-muted rounded-2xl overflow-hidden border border-border group relative">
                    <img src={photo.image_url} alt={photo.title || '回忆照片'} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                    <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/60 to-transparent text-white">
                      <p className="text-xs font-medium truncate">{photo.title || '未命名回忆'}</p>
                    </div>
                  </Link>
                ))}

              {(!photos || photos.length === 0) && (
                <div className="col-span-2 rounded-2xl border border-dashed border-border bg-muted/20 flex items-center justify-center text-sm text-muted-foreground">
                  还没有上传照片，去相册添加第一张回忆吧。
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Timeline & Blog */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          <div className="flex-1 bg-card p-8 rounded-[2rem] border border-border shadow-sm flex flex-col min-h-[500px]">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-8 gap-4">
              <h3 className="text-2xl font-serif font-bold">我们的时间线</h3>
              <div className="flex gap-2">
                <span className="px-3 py-1 bg-background border border-border rounded-full text-xs font-medium text-muted-foreground">所有</span>
                <span className="px-3 py-1 bg-background border border-border rounded-full text-xs font-medium text-muted-foreground">{new Date().getFullYear()}</span>
              </div>
            </div>
            
            <div className="flex-1 relative pl-2 lg:pl-4">
              <div className="absolute left-[24px] lg:left-[32px] top-3 bottom-0 w-[1px] bg-border"></div>
              
              <div className="space-y-10">
                {timeline?.slice(0, 3).map((event: any, i: number) => {
                  const borderColors = ['border-primary', 'border-border', 'border-[#A7C5BD]'];
                  const borderColor = borderColors[i % borderColors.length];
                  
                  return (
                    <div key={event.id} className="relative flex gap-6 pl-10 lg:pl-14">
                      {/* Timeline Node */}
                      <div className={`absolute left-0 top-1.5 w-[19px] h-[19px] lg:w-[23px] lg:h-[23px] rounded-full bg-card border-[5px] lg:border-[6px] ${borderColor} shadow-sm z-10`}></div>
                      
                      <div className="flex-1 group">
                        <div className="text-[10px] lg:text-xs font-bold text-[#B4A096] mb-1.5 uppercase tracking-widest">
                          {format(new Date(event.event_date), 'MMM dd, yyyy')} • {format(new Date(event.event_date), 'EEEE')}
                        </div>
                        <h4 className="text-lg font-bold text-foreground group-hover:text-primary transition-colors">{event.title}</h4>
                        <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                          {event.description}
                        </p>
                        
                        {(event.location || event.tags) && (
                           <div className="mt-3 flex flex-wrap gap-2">
                            {event.location && (
                                <span className="px-2 py-1 bg-background rounded text-[10px] font-bold text-muted-foreground border border-border flex items-center gap-1">
                                  <MapPin className="w-3 h-3" /> {event.location}
                                </span>
                            )}
                            {event.tags && (
                               <span className="px-2 py-1 bg-background rounded text-[10px] font-bold text-muted-foreground border border-border">
                                  #{event.tags}
                               </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {(!timeline || timeline.length === 0) && (
                   <div className="relative flex gap-6 pl-14 opacity-50">
                     <div className="absolute left-0 top-1.5 w-[23px] h-[23px] rounded-full bg-card border-[6px] border-border z-10"></div>
                     <div>
                       <div className="text-xs font-bold text-[#B4A096] mb-1 uppercase tracking-widest">空</div>
                       <h4 className="text-lg font-bold">还没有事件</h4>
                       <p className="text-sm text-muted-foreground mt-2">开始添加属于你们的回忆吧。</p>
                     </div>
                   </div>
                )}
              </div>
            </div>
          </div>

          {/* Blog / Notes Preview */}
          <Link to="/blog" className="bg-card px-8 py-6 rounded-[2rem] border border-border flex items-center justify-between group cursor-pointer hover:border-primary transition-all shadow-sm">
            <div className="flex gap-4 items-center">
              <div className="w-14 h-14 rounded-2xl bg-secondary flex items-center justify-center text-primary shadow-inner">
                <Search className="w-6 h-6" />
              </div>
              <div>
                <div className="text-[10px] font-bold text-[#B4A096] uppercase tracking-widest mb-1">最新日记</div>
                <div className="font-bold text-lg text-foreground group-hover:text-primary transition-colors">
                  {posts?.[0]?.title || '一起挑选窗帘的美学'}
                </div>
              </div>
            </div>
            <div className="w-10 h-10 rounded-full border border-border flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground group-hover:border-primary transition-all">
              <span className="text-xl leading-none">&rsaquo;</span>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
