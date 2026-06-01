import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { UploadCloud, Image as ImageIcon, Edit2, Trash2, Folder, ChevronLeft, ChevronRight } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Comments } from '@/components/Comments';

export function Photos() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [fileUrls, setFileUrls] = useState<string[]>([]);
  const [editItem, setEditItem] = useState<any>(null);
  const [viewPhoto, setViewPhoto] = useState<any>(null);
  const [zoomed, setZoomed] = useState(false);

  const { data: photos, isLoading } = useQuery({ queryKey: ['photos'], queryFn: () => api.request('/photos') });

  const photoList = photos || [];
  const currentPhotoIndex = viewPhoto ? photoList.findIndex((photo: any) => photo.id === viewPhoto.id) : -1;
  const albums = photoList.reduce((acc: any[], photo: any) => {
    const albumKey = photo.album_id || `single-${photo.id}`;
    let album = acc.find((item) => item.key === albumKey);
    if (!album) {
      album = {
        key: albumKey,
        name: photo.album_name || photo.title || '未命名相册',
        cover: photo.album_cover_image_url || photo.image_url,
        createdAt: photo.album_created_at || photo.created_at,
        photos: [],
      };
      acc.push(album);
    }
    album.photos.push(photo);
    return acc;
  }, []);

  const navigatePhoto = (direction: -1 | 1) => {
    if (currentPhotoIndex === -1 || photoList.length === 0) return;
    const nextIndex = (currentPhotoIndex + direction + photoList.length) % photoList.length;
    setViewPhoto(photoList[nextIndex]);
    setZoomed(false);
  };

  const createMutation = useMutation({
    mutationFn: (newPhoto: any) => api.request('/photos', { method: 'POST', body: JSON.stringify(newPhoto) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['photos'] });
      setOpen(false);
      setFileUrls([]);
      toast.success('照片添加成功！');
    }
  });

  const updateMutation = useMutation({
    mutationFn: (data: { id: string, payload: any }) => api.request(`/photos/${data.id}`, { method: 'PUT', body: JSON.stringify(data.payload) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['photos'] });
      setOpen(false);
      setFileUrls([]);
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
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setUploading(true);
    const formData = new FormData();
    files.forEach((file) => formData.append('files', file));
    
    try {
      const res = await api.request('/upload/multiple', {
        method: 'POST',
        body: formData,
      });
      setFileUrls(res.file_urls || []);
      toast.success(`已上传 ${res.file_urls?.length || 0} 张照片，保存后将自动生成相册文件夹`);
    } catch (err: any) {
      toast.error(err?.message || '上传失败，请检查登录状态、文件大小或服务器上传配置');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (fileUrls.length === 0 && !editItem) {
      toast.error('请先上传图片');
      return;
    }
    const formData = new FormData(e.currentTarget);
    const title = String(formData.get('title') || '').trim();
    const takenDate = formData.get('taken_date') || new Date().toISOString();
    if (editItem) {
      updateMutation.mutate({
        id: editItem.id,
        payload: {
          title,
          image_url: fileUrls[0] || editItem?.image_url,
          taken_date: takenDate,
          album_id: editItem.album_id,
        },
      });
    } else {
      createMutation.mutate({
        album_name: title || `相册 ${format(new Date(), 'yyyy-MM-dd HH:mm')}`,
        taken_date: takenDate,
        photos: fileUrls.map((imageUrl, index) => ({
          title: fileUrls.length > 1 && title ? `${title} ${index + 1}` : title,
          image_url: imageUrl,
          taken_date: takenDate,
        })),
      });
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto pb-20">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">我们的相册</h1>
          <p className="text-muted-foreground mt-1">最美好时光的快照。</p>
        </div>
        
        <Dialog open={open} onOpenChange={(val) => { setOpen(val); if (!val) { setEditItem(null); setFileUrls([]); } }}>
          <DialogTrigger render={
            <Button onClick={() => { setEditItem(null); setFileUrls([]); }} className="rounded-full gap-2 px-6 shadow-sm">
              <UploadCloud className="w-4 h-4" /> 上传照片
            </Button>
          } />
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editItem ? '编辑照片' : '添加照片'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="border border-dashed border-border rounded-[2rem] p-8 text-center bg-background relative overflow-hidden group min-h-64">
                <input 
                  type="file" 
                  accept="image/*"
                  multiple={!editItem}
                  onChange={handleFileUpload}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                />
                {(fileUrls.length > 0 || editItem?.image_url) ? (
                  <div className="absolute inset-0 grid grid-cols-2 gap-1 p-2 overflow-hidden rounded-[2rem] bg-muted">
                    {(fileUrls.length > 0 ? fileUrls : [editItem?.image_url]).slice(0, 4).map((url, index) => (
                      <div key={url || index} className="relative overflow-hidden rounded-2xl bg-background">
                        <img src={url} alt="preview" className="w-full h-full object-cover" />
                        {index === 3 && fileUrls.length > 4 && (
                          <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white text-lg font-bold">+{fileUrls.length - 4}</div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <ImageIcon className="w-8 h-8 text-muted-foreground group-hover:text-primary transition-colors" />
                    <span className="text-sm font-medium text-muted-foreground">
                      {uploading ? '上传中...' : '点击或拖拽图片到这里（支持多选）'}
                    </span>
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label>{editItem ? '标题（可选）' : '相册名称（可选）'}</Label>
                <Input name="title" defaultValue={editItem?.title} placeholder="例如：阳光明媚的一天..." />
              </div>
              <div className="space-y-2">
                <Label>拍摄日期</Label>
                <Input name="taken_date" type="date" defaultValue={editItem?.taken_date ? new Date(editItem.taken_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]} />
              </div>
              <Button type="submit" className="w-full" disabled={createMutation.isPending || updateMutation.isPending || uploading}>
                {editItem ? '保存照片' : '保存并生成相册'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {albums.length > 0 && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {albums.map((album: any) => (
            <Card key={album.key} className="overflow-hidden rounded-[2rem] border-border bg-card/80 shadow-sm">
              <div className="flex gap-4 p-4">
                <div className="relative w-24 h-24 shrink-0 overflow-hidden rounded-3xl bg-muted">
                  <img src={album.cover} alt={album.name} className="w-full h-full object-cover" />
                  <div className="absolute left-2 top-2 rounded-full bg-black/55 p-1.5 text-white">
                    <Folder className="w-4 h-4" />
                  </div>
                </div>
                <div className="min-w-0 flex flex-col justify-center">
                  <h2 className="font-bold truncate">{album.name}</h2>
                  <p className="text-sm text-muted-foreground">{album.photos.length} 张照片</p>
                  <p className="text-xs text-muted-foreground mt-1">{format(new Date(album.createdAt), 'yyyy年MM月dd日')}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <div className="columns-2 md:columns-3 lg:columns-4 gap-4 space-y-4">
        {photoList.map((photo: any) => (
          <div key={photo.id} className="break-inside-avoid relative group rounded-[2rem] overflow-hidden shadow-sm border border-border cursor-zoom-in" onClick={() => { setViewPhoto(photo); setZoomed(false); }}>
            <img src={photo.image_url} alt={photo.title || 'Photo'} className="w-full object-cover transition-transform duration-500 group-hover:scale-105" />
            <div className="absolute left-2 top-2 rounded-full bg-black/45 px-2 py-1 text-[10px] font-bold text-white backdrop-blur">
              {photo.album_name || '未命名相册'}
            </div>
            <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
              <Button 
                variant="secondary" 
                size="icon" 
                className="w-8 h-8 rounded-full bg-white/80 hover:bg-white text-black drop-shadow"
                onClick={(e) => {
                  e.stopPropagation();
                  setEditItem(photo);
                  setFileUrls([]);
                  setOpen(true);
                }}
              >
                <Edit2 className="w-3 h-3" />
              </Button>
              <Button 
                variant="destructive" 
                size="icon" 
                className="w-8 h-8 rounded-full bg-red-500/80 hover:bg-red-500 drop-shadow"
                onClick={(e) => {
                  e.stopPropagation();
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
      

      <Dialog open={!!viewPhoto} onOpenChange={(v) => { if (!v) { setViewPhoto(null); setZoomed(false); } }}>
        <DialogContent className="w-screen h-screen max-w-none rounded-none p-0 overflow-hidden border-0 md:w-[94vw] md:h-[90vh] md:rounded-2xl md:border md:max-w-7xl">
          {viewPhoto && (
            <div className="grid grid-rows-[1fr_auto] md:grid-cols-5 md:grid-rows-1 h-full">
              <div className="md:col-span-3 bg-black/90 flex items-center justify-center p-4 md:p-6 min-h-0 overflow-auto relative">
                {photoList.length > 1 && (
                  <>
                    <Button type="button" variant="secondary" size="icon" className="absolute left-4 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/85 text-black shadow-lg" onClick={() => navigatePhoto(-1)}>
                      <ChevronLeft className="w-5 h-5" />
                    </Button>
                    <Button type="button" variant="secondary" size="icon" className="absolute right-4 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/85 text-black shadow-lg" onClick={() => navigatePhoto(1)}>
                      <ChevronRight className="w-5 h-5" />
                    </Button>
                  </>
                )}
                <img
                  src={viewPhoto.image_url}
                  className={`rounded-2xl object-contain transition-transform duration-300 cursor-zoom-in ${zoomed ? 'scale-200' : 'scale-100'} max-h-[92vh]`}
                  onClick={() => setZoomed((v) => !v)}
                />
              </div>
              <div className="md:col-span-2 p-4 md:p-8 bg-gradient-to-b from-background to-muted/30 overflow-y-auto">
                <h3 className="text-2xl font-bold">{viewPhoto.title || '未命名照片'}</h3>
                <p className="text-sm text-muted-foreground mt-2">{format(new Date(viewPhoto.taken_date || viewPhoto.created_at), 'yyyy年MM月dd日')}</p>
                <p className="text-xs text-muted-foreground mt-2">点击图片可放大/缩小（2倍），使用左右按钮可连续浏览</p>
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
