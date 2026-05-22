import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Plus, MapPin, Smile, Trash2, Edit2, Image as ImageIcon } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

export function Timeline() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [fileUrl, setFileUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  
  const { data: events, isLoading } = useQuery({ queryKey: ['timeline'], queryFn: () => api.request('/timeline') });

  const mutation = useMutation({
    mutationFn: (newEvent: any) => api.request('/timeline', { method: 'POST', body: JSON.stringify(newEvent) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timeline'] });
      setOpen(false);
      toast.success('添加成功！');
    }
  });

  const updateMutation = useMutation({
    mutationFn: (data: { id: string, payload: any }) => api.request(`/timeline/${data.id}`, { method: 'PUT', body: JSON.stringify(data.payload) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timeline'] });
      setOpen(false);
      setEditItem(null);
      toast.success('更新成功！');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.request(`/timeline/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timeline'] });
      toast.success('删除成功！');
    }
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const payload = {
      title: formData.get('title'),
      description: formData.get('description'),
      event_date: formData.get('event_date') || new Date().toISOString(),
      location: formData.get('location'),
      mood: formData.get('mood'),
      cover_image_url: fileUrl || editItem?.cover_image_url,
    };
    if (editItem) {
      updateMutation.mutate({ id: editItem.id, payload });
    } else {
      mutation.mutate(payload);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto pb-20">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">我们的时间线</h1>
          <p className="text-muted-foreground mt-1">每一个瞬间都弥足珍贵。</p>
        </div>
        
        <Dialog open={open} onOpenChange={(val) => { setOpen(val); if (!val) setEditItem(null); }}>
          <DialogTrigger render={
            <Button onClick={() => setEditItem(null)} className="rounded-full gap-2 px-6 shadow-sm">
              <Plus className="w-4 h-4" /> 添加回忆
            </Button>
          } />
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editItem ? '编辑回忆' : '新回忆'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="border border-dashed border-border rounded-[2rem] p-6 text-center bg-background relative overflow-hidden group">
                <input type="file" accept="image/*" onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setUploading(true);
                  const fd = new FormData(); fd.append('file', file);
                  try { const res = await api.request('/upload', { method: 'POST', body: fd }); setFileUrl(res.file_url); } finally { setUploading(false); }
                }} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                {(fileUrl || editItem?.cover_image_url) ? <img src={fileUrl || editItem?.cover_image_url} className="absolute inset-0 w-full h-full object-cover rounded-[2rem]" /> : <div className="flex items-center justify-center gap-2"><ImageIcon className="w-5 h-5" />{uploading ? '上传中...' : '上传时间线图片（可选）'}</div>}
              </div>
              <div className="space-y-2">
                <Label>标题</Label>
                <Input name="title" defaultValue={editItem?.title} placeholder="发生了什么？" required />
              </div>
              <div className="space-y-2">
                <Label>日期</Label>
                <Input name="event_date" type="date" required defaultValue={editItem?.event_date ? new Date(editItem.event_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]} />
              </div>
              <div className="space-y-2">
                <Label>描述</Label>
                <Textarea name="description" defaultValue={editItem?.description} placeholder="一小段描述..." />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>地点（可选）</Label>
                  <Input name="location" defaultValue={editItem?.location} placeholder="例如：巴黎" />
                </div>
                <div className="space-y-2">
                  <Label>心情（可选）</Label>
                  <Input name="mood" defaultValue={editItem?.mood} placeholder="例如：开心" />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={mutation.isPending || updateMutation.isPending || uploading}>
                保存回忆
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative border-l border-border ml-6 pl-8 space-y-12">
        {events?.map((event: any) => (
          <div key={event.id} className="relative group">
            {/* Timeline Dot */}
            <div className="absolute -left-[45px] top-6 w-6 h-6 rounded-full bg-card border-2 border-primary flex items-center justify-center shadow-sm">
              <div className="w-2 h-2 rounded-full bg-primary" />
            </div>

            <Card className="hover:shadow-md transition-shadow border-border rounded-[2rem]">
              <CardContent className="p-8">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <time className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2 block">
                      {format(new Date(event.event_date), 'yyyy年MM月dd日 • EEEE')}
                    </time>
                    <h3 className="text-xl font-bold text-foreground">{event.title}</h3>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="text-muted-foreground hover:bg-muted rounded-full"
                      onClick={() => {
                          setEditItem(event);
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
                          if (confirm('确认删除这段回忆吗？')) {
                              deleteMutation.mutate(event.id);
                          }
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                
                {event.description && (
                  <p className="text-muted-foreground mb-4 whitespace-pre-wrap">{event.description}</p>
                )}

                {event.cover_image_url && <img src={event.cover_image_url} className="rounded-2xl mb-4 w-full" />}
                {(event.location || event.mood) && (
                  <div className="flex gap-4 pt-4 border-t border-border text-xs font-bold text-muted-foreground">
                    {event.location && (
                      <span className="flex items-center gap-1.5 px-2 py-1 bg-background border border-border rounded"><MapPin className="w-3 h-3" /> {event.location}</span>
                    )}
                    {event.mood && (
                      <span className="flex items-center gap-1.5 px-2 py-1 bg-background border border-border rounded"><Smile className="w-3 h-3" /> {event.mood}</span>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        ))}
      </div>
    </div>
  );
}
