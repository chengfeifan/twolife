import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { UploadCloud, Image as ImageIcon, Plus, Edit2, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Comments } from '@/components/Comments';

export function Photos() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [fileUrl, setFileUrl] = useState('');
  const [editItem, setEditItem] = useState<any>(null);
  const [viewPhoto, setViewPhoto] = useState<any>(null);

  const { data: photos, isLoading } = useQuery({ queryKey: ['photos'], queryFn: () => api.request('/photos') });

  const createMutation = useMutation({
    mutationFn: (newPhoto: any) => api.request('/photos', { method: 'POST', body: JSON.stringify(newPhoto) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['photos'] });
      setOpen(false);
      setFileUrl('');
      toast.success('照片添加成功！');
    }
  });

  const updateMutation = useMutation({
    mutationFn: (data: { id: string, payload: any }) => api.request(`/photos/${data.id}`, { method: 'PUT', body: JSON.stringify(data.payload) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['photos'] });
      setOpen(false);
      setFileUrl('');
      setEditItem(null);
      toast.success('照片更新成功！');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.request(`/photos/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['photos'] });
      toast.success('照片删除成功！');
    }
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      const res = await api.request('/upload', {
        method: 'POST',
        body: formData,
      });
      setFileUrl(res.file_url);
    } catch (err: any) {
      toast.error(err?.message || '上传失败，请检查登录状态、文件大小或服务器上传配置');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!fileUrl && !editItem) {
      toast.error('请先上传一张图片');
      return;
    }
    const formData = new FormData(e.currentTarget);
    const payload = {
      title: formData.get('title'),
      image_url: fileUrl || editItem?.image_url,
      taken_date: formData.get('taken_date') || new Date().toISOString(),
    };
    if (editItem) {
      updateMutation.mutate({ id: editItem.id, payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto pb-20">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">我们的相册</h1>
          <p className="text-muted-foreground mt-1">最美好时光的快照。</p>
        </div>
        
        <Dialog open={open} onOpenChange={(val) => { setOpen(val); if (!val) { setEditItem(null); setFileUrl(''); } }}>
          <DialogTrigger render={
            <Button onClick={() => { setEditItem(null); setFileUrl(''); }} className="rounded-full gap-2 px-6 shadow-sm">
              <UploadCloud className="w-4 h-4" /> 上传照片
            </Button>
          } />
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editItem ? '编辑照片' : '添加照片'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="border border-dashed border-border rounded-[2rem] p-8 text-center bg-background relative overflow-hidden group">
                <input 
                  type="file" 
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                />
                {(fileUrl || editItem?.image_url) ? (
                  <img src={fileUrl || editItem?.image_url} alt="preview" className="absolute inset-0 w-full h-full object-cover rounded-[2rem]" />
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <ImageIcon className="w-8 h-8 text-muted-foreground group-hover:text-primary transition-colors" />
                    <span className="text-sm font-medium text-muted-foreground">
                      {uploading ? '上传中...' : '点击或拖拽图片到这里'}
                    </span>
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label>标题（可选）</Label>
                <Input name="title" defaultValue={editItem?.title} placeholder="例如：阳光明媚的一天..." />
              </div>
              <div className="space-y-2">
                <Label>拍摄日期</Label>
                <Input name="taken_date" type="date" defaultValue={editItem?.taken_date ? new Date(editItem.taken_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]} />
              </div>
              <Button type="submit" className="w-full" disabled={createMutation.isPending || updateMutation.isPending || uploading}>
                保存照片
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="columns-2 md:columns-3 lg:columns-4 gap-4 space-y-4">
        {photos?.map((photo: any) => (
          <div key={photo.id} className="break-inside-avoid relative group rounded-[2rem] overflow-hidden shadow-sm border border-border cursor-zoom-in" onClick={() => setViewPhoto(photo)}>
            <img src={photo.image_url} alt={photo.title || 'Photo'} className="w-full object-cover transition-transform duration-500 group-hover:scale-105" />
            <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
              <Button 
                variant="secondary" 
                size="icon" 
                className="w-8 h-8 rounded-full bg-white/80 hover:bg-white text-black drop-shadow"
                onClick={() => {
                  setEditItem(photo);
                  setOpen(true);
                }}
              >
                <Edit2 className="w-3 h-3" />
              </Button>
              <Button 
                variant="destructive" 
                size="icon" 
                className="w-8 h-8 rounded-full bg-red-500/80 hover:bg-red-500 drop-shadow"
                onClick={() => {
                  if (confirm('确认删除这张照片吗？')) {
                    deleteMutation.mutate(photo.id);
                  }
                }}
              >
                <Trash2 className="w-3 h-3 text-white" />
              </Button>
            </div>
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-6 pointer-events-none">
              <div className="text-white">
                <p className="font-bold truncate text-lg font-serif">{photo.title}</p>
                <time className="text-[10px] font-bold text-white/80 uppercase tracking-widest">{format(new Date(photo.taken_date || photo.created_at), 'yyyy年MM月dd日')}</time>
              </div>
            </div>
          </div>
        ))}
      </div>
      

      <Dialog open={!!viewPhoto} onOpenChange={(v) => !v && setViewPhoto(null)}>
        <DialogContent className="max-w-5xl">
          {viewPhoto && (
            <div className="grid md:grid-cols-3 gap-6">
              <div className="md:col-span-2"><img src={viewPhoto.image_url} className="w-full rounded-2xl" /></div>
              <div>
                <h3 className="text-xl font-bold">{viewPhoto.title || '未命名照片'}</h3>
                <p className="text-sm text-muted-foreground mt-2">{format(new Date(viewPhoto.taken_date || viewPhoto.created_at), 'yyyy年MM月dd日')}</p>
                <Comments targetType="photo" targetId={viewPhoto.id} />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {!isLoading && photos?.length === 0 && (
         <div className="py-20 text-center text-muted-foreground flex flex-col items-center justify-center bg-card rounded-[2rem] border border-border mt-4">
            <ImageIcon className="w-16 h-16 mb-4 opacity-20" />
            <p className="font-medium">尚未上传照片。开始建立相册吧！</p>
         </div>
      )}
    </div>
  );
}
