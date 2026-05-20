import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Trash2, CalendarHeart, Edit2 } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { toast } from 'sonner';

export function Anniversaries() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  
  const { data: annivs, isLoading } = useQuery({ queryKey: ['anniversaries'], queryFn: () => api.request('/anniversaries') });

  const createMutation = useMutation({
    mutationFn: (newAnniv: any) => api.request('/anniversaries', { method: 'POST', body: JSON.stringify(newAnniv) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['anniversaries'] });
      setOpen(false);
      toast.success('添加成功！');
    }
  });

  const updateMutation = useMutation({
    mutationFn: (data: { id: string, payload: any }) => api.request(`/anniversaries/${data.id}`, { method: 'PUT', body: JSON.stringify(data.payload) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['anniversaries'] });
      setOpen(false);
      setEditItem(null);
      toast.success('更新成功！');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.request(`/anniversaries/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['anniversaries'] });
      toast.success('已删除。');
    }
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const payload = {
      title: formData.get('title'),
      date: formData.get('date'),
      description: formData.get('description'),
      repeat_yearly: true,
    };
    if (editItem) {
       updateMutation.mutate({ id: editItem.id, payload });
    } else {
       createMutation.mutate(payload);
    }
  };

  const getDaysPassed = (dateStr: string) => {
    return differenceInDays(new Date(), new Date(dateStr));
  };

  return (
    <div className="p-8 max-w-4xl mx-auto pb-20">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">纪念日</h1>
          <p className="text-muted-foreground mt-1">铭记特别的日子。</p>
        </div>
        
        <Dialog open={open} onOpenChange={(val) => { setOpen(val); if (!val) setEditItem(null); }}>
          <DialogTrigger render={
            <Button onClick={() => setEditItem(null)} className="rounded-full gap-2 px-6 shadow-sm">
              <Plus className="w-4 h-4" /> 添加纪念日
            </Button>
          } />
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editItem ? '编辑纪念日' : '新纪念日'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>标题</Label>
                <Input name="title" defaultValue={editItem?.title} placeholder="例如：相识纪念日" required />
              </div>
              <div className="space-y-2">
                <Label>日期</Label>
                <Input name="date" type="date" defaultValue={editItem?.date ? new Date(editItem.date).toISOString().split('T')[0] : ''} required />
              </div>
              <div className="space-y-2">
                <Label>描述（可选）</Label>
                <Input name="description" defaultValue={editItem?.description} placeholder="记录一点细节..." />
              </div>
              <Button type="submit" className="w-full" disabled={createMutation.isPending || updateMutation.isPending}>
                保存纪念日
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {annivs?.map((anniv: any) => (
          <Card key={anniv.id} className="relative group overflow-hidden border-border hover:shadow-md transition-all rounded-[2rem]">
            <CardContent className="p-8">
                <div className="absolute right-[-20px] top-[-20px] opacity-[0.03] text-primary">
                   <CalendarHeart className="w-40 h-40" />
                </div>
                <div className="flex justify-between items-start mb-4 relative z-10">
                   <div>
                       <time className="text-[10px] font-bold uppercase tracking-widest text-[#B4A096] block mb-2">
                          {format(new Date(anniv.date), 'yyyy年MM月dd日')}
                       </time>
                       <h3 className="text-2xl font-bold text-foreground font-serif leading-tight">{anniv.title}</h3>
                   </div>
                   <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                     <Button 
                        variant="ghost" 
                        size="icon" 
                        className="text-muted-foreground hover:bg-muted rounded-full"
                        onClick={() => {
                            setEditItem(anniv);
                            setOpen(true);
                        }}
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive rounded-full"
                        onClick={() => {
                            if (confirm('确定要删除吗？')) {
                                deleteMutation.mutate(anniv.id);
                            }
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                   </div>
                </div>
                
                <div className="relative z-10 text-muted-foreground mb-8 text-sm">{anniv.description}</div>
                
                <div className="relative z-10 p-5 bg-background border border-border rounded-2xl flex items-center justify-between">
                   <span className="text-sm font-semibold text-muted-foreground">相伴天数</span>
                   <span className="text-3xl font-serif text-primary">{getDaysPassed(anniv.date)}</span>
                </div>
            </CardContent>
          </Card>
        ))}
      </div>
      
      {!isLoading && annivs?.length === 0 && (
          <div className="py-20 text-center text-muted-foreground flex flex-col items-center justify-center bg-card rounded-[2rem] border border-border mt-4">
            <CalendarHeart className="w-16 h-16 mb-4 opacity-20" />
            <p className="font-medium">还没有添加纪念日。</p>
         </div>
      )}
    </div>
  );
}
