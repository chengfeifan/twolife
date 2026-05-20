import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { UploadCloud, Image as ImageIcon, Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { format } from 'date-fns';
import { toast } from 'sonner';

export function Photos() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [fileUrl, setFileUrl] = useState('');

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
      toast.error('上传失败');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!fileUrl) {
      toast.error('请先上传一张图片');
      return;
    }
    const formData = new FormData(e.currentTarget);
    createMutation.mutate({
      title: formData.get('title'),
      image_url: fileUrl,
      taken_date: formData.get('taken_date') || new Date().toISOString(),
    });
  };

  return (
    <div className="p-8 max-w-6xl mx-auto pb-20">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">我们的相册</h1>
          <p className="text-muted-foreground mt-1">最美好时光的快照。</p>
        </div>
        
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger render={
            <Button className="rounded-full gap-2 px-6 shadow-sm">
              <UploadCloud className="w-4 h-4" /> 上传照片
            </Button>
          } />
          <DialogContent>
            <DialogHeader>
              <DialogTitle>添加照片</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="border border-dashed border-border rounded-[2rem] p-8 text-center bg-background relative overflow-hidden group">
                <input 
                  type="file" 
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                />
                {fileUrl ? (
                  <img src={fileUrl} alt="preview" className="absolute inset-0 w-full h-full object-cover rounded-[2rem]" />
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
                <Input name="title" placeholder="例如：阳光明媚的一天..." />
              </div>
              <div className="space-y-2">
                <Label>拍摄日期</Label>
                <Input name="taken_date" type="date" defaultValue={new Date().toISOString().split('T')[0]} />
              </div>
              <Button type="submit" className="w-full" disabled={createMutation.isPending || uploading}>
                保存照片
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="columns-2 md:columns-3 lg:columns-4 gap-4 space-y-4">
        {photos?.map((photo: any) => (
          <div key={photo.id} className="break-inside-avoid relative group rounded-[2rem] overflow-hidden shadow-sm border border-border">
            <img src={photo.image_url} alt={photo.title || 'Photo'} className="w-full object-cover transition-transform duration-500 group-hover:scale-105" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-6">
              <div className="text-white">
                <p className="font-bold truncate text-lg font-serif">{photo.title}</p>
                <time className="text-[10px] font-bold text-white/80 uppercase tracking-widest">{format(new Date(photo.taken_date || photo.created_at), 'yyyy年MM月dd日')}</time>
              </div>
            </div>
          </div>
        ))}
      </div>
      
      {!isLoading && photos?.length === 0 && (
         <div className="py-20 text-center text-muted-foreground flex flex-col items-center justify-center bg-card rounded-[2rem] border border-border mt-4">
            <ImageIcon className="w-16 h-16 mb-4 opacity-20" />
            <p className="font-medium">尚未上传照片。开始建立相册吧！</p>
         </div>
      )}
    </div>
  );
}
