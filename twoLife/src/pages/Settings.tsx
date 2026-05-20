import { Card, CardContent } from '@/components/ui/card';
import { CalendarHeart } from 'lucide-react';

export function Settings() {
  return (
    <div className="p-8 max-w-4xl mx-auto pb-20">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-foreground font-serif">设置</h1>
        <p className="text-muted-foreground mt-1">你的专属空间。</p>
      </div>

      <div className="space-y-8">
        <section>
           <h2 className="text-xl font-bold text-foreground mb-4 font-serif">关于</h2>
           <Card className="border-border rounded-[2rem] overflow-hidden shadow-sm relative group">
             <CardContent className="p-8 text-muted-foreground space-y-4">
                <div className="absolute right-[-20px] top-[-20px] opacity-[0.03] text-primary">
                   <CalendarHeart className="w-40 h-40" />
                </div>
                
                <div className="relative z-10">
                  <h3 className="text-2xl font-bold text-foreground font-serif mb-1">TwoLife 双人宇宙</h3>
                  <p className="text-sm font-bold uppercase tracking-widest text-[#B4A096]">版本号 1.0.0</p>
                </div>
                
                <p className="relative z-10 text-sm leading-relaxed max-w-lg">
                   一个私密的二人数字空间，用来珍藏关于时间、照片和文字的美好记忆。
                </p>
             </CardContent>
           </Card>
        </section>
      </div>
    </div>
  );
}
