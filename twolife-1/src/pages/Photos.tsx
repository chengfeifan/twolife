import { useMemo, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import {
  ArrowLeft,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Edit2,
  Folder,
  Image as ImageIcon,
  Loader2,
  Plus,
  Trash2,
  UploadCloud,
  X,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Comments } from '@/components/Comments';

const PAGE_SIZE = 30;
const MAX_FILES = 50;
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const UPLOAD_CONCURRENCY = 3;
const ACCEPTED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

type Album = {
  id: number;
  name: string;
  description?: string;
  cover_thumbnail_url?: string;
  cover_image_url?: string;
  photo_count: number;
  created_at: string;
  updated_at?: string;
  last_photo_updated_at?: string;
};

type Photo = {
  id: number;
  album_id: number;
  title?: string;
  description?: string;
  image_url: string;
  thumbnail_url?: string;
  taken_date?: string;
  created_at: string;
  file_size?: number;
};

type UploadItem = {
  id: string;
  file: File;
  status: '等待压缩' | '压缩中' | '等待上传' | '上传中' | '成功' | '失败';
  progress: number;
  error?: string;
};

const formatDate = (value?: string) => {
  if (!value) return '—';
  return format(new Date(value), 'yyyy年MM月dd日 HH:mm');
};

const fileSizeText = (bytes?: number) => {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
};

const validateFiles = (files: File[]) => {
  const accepted: File[] = [];
  const rejected: string[] = [];
  if (files.length > MAX_FILES) {
    rejected.push(`单次最多选择 ${MAX_FILES} 张图片，已自动忽略超出的文件。`);
  }
  files.slice(0, MAX_FILES).forEach((file) => {
    if (!ACCEPTED_MIME_TYPES.includes(file.type)) {
      rejected.push(`${file.name} 格式不支持，仅允许 jpg、jpeg、png、webp、gif。`);
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      rejected.push(`${file.name} 超过 10MB，请压缩后重试。`);
      return;
    }
    accepted.push(file);
  });
  return { accepted, rejected };
};

const canvasToBlob = (canvas: HTMLCanvasElement, type: string, quality: number) => new Promise<Blob>((resolve, reject) => {
  canvas.toBlob((blob) => {
    if (blob) resolve(blob);
    else reject(new Error('图片压缩失败'));
  }, type, quality);
});

const resizeImage = async (file: File, maxWidth: number, quality: number, preferWebp = true) => {
  if (file.type === 'image/gif') return file;
  const bitmap = await createImageBitmap(file);
  const ratio = Math.min(1, maxWidth / bitmap.width);
  const width = Math.max(1, Math.round(bitmap.width * ratio));
  const height = Math.max(1, Math.round(bitmap.height * ratio));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('当前浏览器不支持图片压缩');
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();
  const type = preferWebp ? 'image/webp' : 'image/jpeg';
  const blob = await canvasToBlob(canvas, type, quality);
  const ext = type === 'image/webp' ? 'webp' : 'jpg';
  return new File([blob], file.name.replace(/\.[^.]+$/, `.${ext}`), { type, lastModified: Date.now() });
};

const uploadWithProgress = (albumId: number, original: File, thumbnail: File, onProgress: (value: number) => void) => new Promise<any>((resolve, reject) => {
  const xhr = new XMLHttpRequest();
  const formData = new FormData();
  formData.append('files', original);
  formData.append('thumbnails', thumbnail);
  xhr.open('POST', `/api/albums/${albumId}/photos`);
  const token = api.getToken();
  if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
  xhr.upload.onprogress = (event) => {
    if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
  };
  xhr.onload = () => {
    let payload: any = null;
    try { payload = JSON.parse(xhr.responseText || '{}'); } catch { payload = {}; }
    if (xhr.status >= 200 && xhr.status < 300) resolve(payload);
    else reject(new Error(payload?.error || `上传失败（${xhr.status}）`));
  };
  xhr.onerror = () => reject(new Error('网络错误，上传失败'));
  xhr.send(formData);
});

async function runWithConcurrency<T>(items: T[], limit: number, worker: (item: T) => Promise<void>) {
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const item = items[cursor++];
      await worker(item);
    }
  });
  await Promise.all(runners);
}

export function Photos() {
  const queryClient = useQueryClient();
  const [selectedAlbumId, setSelectedAlbumId] = useState<number | null>(null);
  const [albumPage, setAlbumPage] = useState(1);
  const [photoPage, setPhotoPage] = useState(1);
  const [albumDialogOpen, setAlbumDialogOpen] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [editingAlbum, setEditingAlbum] = useState<Album | null>(null);
  const [uploadAlbumId, setUploadAlbumId] = useState<number | 'new' | ''>('');
  const [newUploadAlbumName, setNewUploadAlbumName] = useState('');
  const [uploadItems, setUploadItems] = useState<UploadItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<number[]>([]);
  const [viewPhoto, setViewPhoto] = useState<Photo | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const albumsQuery = useQuery({
    queryKey: ['albums', albumPage],
    queryFn: () => api.request(`/albums?page=${albumPage}&page_size=24`),
  });

  const selectedAlbum = useMemo(() => {
    const items = albumsQuery.data?.items || [];
    return items.find((album: Album) => album.id === selectedAlbumId) || null;
  }, [albumsQuery.data?.items, selectedAlbumId]);

  const photosQuery = useQuery({
    queryKey: ['album-photos', selectedAlbumId, photoPage],
    queryFn: () => api.request(`/albums/${selectedAlbumId}/photos?page=${photoPage}&page_size=${PAGE_SIZE}`),
    enabled: !!selectedAlbumId,
  });

  const albums: Album[] = albumsQuery.data?.items || [];
  const photos: Photo[] = photosQuery.data?.items || [];
  const currentPhotoIndex = viewPhoto ? photos.findIndex((photo) => photo.id === viewPhoto.id) : -1;

  const createAlbumMutation = useMutation({
    mutationFn: (payload: { name: string; description?: string }) => api.request('/albums', { method: 'POST', body: JSON.stringify(payload) }),
    onSuccess: (album) => {
      queryClient.invalidateQueries({ queryKey: ['albums'] });
      setAlbumDialogOpen(false);
      setEditingAlbum(null);
      toast.success('相册创建成功');
      return album;
    },
    onError: (err: any) => toast.error(err?.message || '相册创建失败'),
  });

  const updateAlbumMutation = useMutation({
    mutationFn: (payload: { id: number; name: string; description?: string }) => api.request(`/albums/${payload.id}`, { method: 'PUT', body: JSON.stringify(payload) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['albums'] });
      setAlbumDialogOpen(false);
      setEditingAlbum(null);
      toast.success('相册已更新');
    },
    onError: (err: any) => toast.error(err?.message || '相册更新失败'),
  });

  const deleteAlbumMutation = useMutation({
    mutationFn: (id: number) => api.request(`/albums/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['albums'] });
      setSelectedAlbumId(null);
      toast.success('相册及其照片已删除');
    },
    onError: (err: any) => toast.error(err?.message || '删除相册失败'),
  });

  const deletePhotoMutation = useMutation({
    mutationFn: (id: number) => api.request(`/photos/${id}`, { method: 'DELETE' }),
    onSuccess: (_res, deletedId) => {
      queryClient.invalidateQueries({ queryKey: ['album-photos', selectedAlbumId] });
      queryClient.invalidateQueries({ queryKey: ['albums'] });
      setSelectedPhotoIds((ids) => ids.filter((id) => id !== deletedId));
      if (viewPhoto?.id === deletedId) setViewPhoto(null);
      toast.success('照片已删除');
    },
    onError: (err: any) => toast.error(err?.message || '删除照片失败'),
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: (ids: number[]) => api.request('/photos/bulk-delete', { method: 'POST', body: JSON.stringify({ ids }) }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['album-photos', selectedAlbumId] });
      queryClient.invalidateQueries({ queryKey: ['albums'] });
      setSelectedPhotoIds([]);
      toast.success(`已删除 ${res.deleted || 0} 张照片`);
    },
    onError: (err: any) => toast.error(err?.message || '批量删除失败'),
  });

  const handleAlbumSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const name = String(formData.get('name') || '').trim();
    const description = String(formData.get('description') || '').trim();
    if (!name) return toast.error('相册名称不能为空');
    if (name.length > 50) return toast.error('相册名称不能超过 50 个字符');
    if (editingAlbum) updateAlbumMutation.mutate({ id: editingAlbum.id, name, description });
    else createAlbumMutation.mutate({ name, description });
  };

  const addFiles = (files: File[]) => {
    const { accepted, rejected } = validateFiles(files);
    rejected.forEach((message) => toast.error(message));
    setUploadItems((prev) => [
      ...prev,
      ...accepted.map((file) => ({ id: `${file.name}-${file.lastModified}-${crypto.randomUUID()}`, file, status: '等待压缩' as const, progress: 0 })),
    ]);
  };

  const openUploadDialog = (albumId?: number) => {
    setUploadAlbumId(albumId || '');
    setNewUploadAlbumName('');
    setUploadItems([]);
    setUploadDialogOpen(true);
  };

  const startUpload = async () => {
    if (uploadItems.length === 0) return toast.error('请先选择图片');
    let targetAlbumId = typeof uploadAlbumId === 'number' ? uploadAlbumId : null;
    try {
      setIsUploading(true);
      if (!targetAlbumId) {
        const name = uploadAlbumId === 'new' ? newUploadAlbumName.trim() : `相册 ${format(new Date(), 'yyyy-MM-dd HH:mm')}`;
        if (!name) {
          toast.error('请输入新相册名称');
          setIsUploading(false);
          return;
        }
        const album = await api.request('/albums', { method: 'POST', body: JSON.stringify({ name }) });
        targetAlbumId = album.id;
        setSelectedAlbumId(album.id);
      }

      let successCount = 0;
      let failureCount = 0;
      const updateItem = (id: string, patch: Partial<UploadItem>) => {
        setUploadItems((items) => items.map((item) => (item.id === id ? { ...item, ...patch } : item)));
      };

      await runWithConcurrency(uploadItems, UPLOAD_CONCURRENCY, async (item) => {
        try {
          updateItem(item.id, { status: '压缩中', progress: 5 });
          const [compressed, thumbnail] = await Promise.all([
            resizeImage(item.file, 2200, 0.82, item.file.type !== 'image/png'),
            resizeImage(item.file, 500, 0.72, true),
          ]);
          updateItem(item.id, { status: '上传中', progress: 15 });
          const result = await uploadWithProgress(targetAlbumId!, compressed, thumbnail, (progress) => updateItem(item.id, { progress: Math.max(15, progress) }));
          const failure = result.failures?.[0];
          if (failure) throw new Error(failure.error || '上传失败');
          successCount += 1;
          updateItem(item.id, { status: '成功', progress: 100 });
        } catch (err: any) {
          failureCount += 1;
          updateItem(item.id, { status: '失败', error: err?.message || '上传失败', progress: 100 });
        }
      });

      queryClient.invalidateQueries({ queryKey: ['albums'] });
      queryClient.invalidateQueries({ queryKey: ['album-photos', targetAlbumId] });
      if (successCount && failureCount) toast.warning(`部分上传成功：成功 ${successCount} 张，失败 ${failureCount} 张`);
      else if (successCount) toast.success(`成功上传 ${successCount} 张照片`);
      else toast.error('没有照片上传成功');
      if (successCount && !failureCount) setUploadDialogOpen(false);
    } finally {
      setIsUploading(false);
    }
  };

  const navigatePhoto = (direction: -1 | 1) => {
    if (currentPhotoIndex === -1 || photos.length === 0) return;
    const nextIndex = (currentPhotoIndex + direction + photos.length) % photos.length;
    setViewPhoto(photos[nextIndex]);
  };

  const toggleSelectPhoto = (photoId: number) => {
    setSelectedPhotoIds((ids) => (ids.includes(photoId) ? ids.filter((id) => id !== photoId) : [...ids, photoId]));
  };

  const renderUploadDropzone = () => (
    <div
      className="rounded-3xl border-2 border-dashed border-border bg-muted/30 p-8 text-center transition-colors hover:border-primary/60"
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        addFiles(Array.from(event.dataTransfer.files));
      }}
    >
      <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple className="hidden" onChange={(event) => addFiles(Array.from(event.target.files || []))} />
      <UploadCloud className="mx-auto mb-3 h-10 w-10 text-primary" />
      <p className="font-semibold">拖拽图片到这里，或点击选择多张图片</p>
      <p className="mt-1 text-xs text-muted-foreground">支持 jpg / jpeg / png / webp / gif，单张不超过 10MB，单次最多 50 张；上传前会自动压缩并生成缩略图。</p>
      <Button type="button" variant="secondary" className="mt-4 rounded-full" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>选择图片</Button>
    </div>
  );

  if (selectedAlbumId) {
    return (
      <div className="mx-auto w-full max-w-7xl p-6 pb-20 md:p-8">
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <Button variant="ghost" className="mb-3 gap-2 rounded-full" onClick={() => { setSelectedAlbumId(null); setSelectedPhotoIds([]); }}>
              <ArrowLeft className="h-4 w-4" /> 返回相册首页
            </Button>
            <h1 className="text-3xl font-bold tracking-tight">{selectedAlbum?.name || photosQuery.data?.album?.name || '相册详情'}</h1>
            <p className="mt-1 text-sm text-muted-foreground">默认展示缩略图，点击照片时才按需加载原图。</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {selectedPhotoIds.length > 0 && (
              <Button variant="destructive" className="rounded-full" onClick={() => confirm(`确认删除选中的 ${selectedPhotoIds.length} 张照片吗？`) && bulkDeleteMutation.mutate(selectedPhotoIds)}>
                <Trash2 className="h-4 w-4" /> 批量删除（{selectedPhotoIds.length}）
              </Button>
            )}
            <Button className="rounded-full gap-2" onClick={() => openUploadDialog(selectedAlbumId)}>
              <UploadCloud className="h-4 w-4" /> 批量上传
            </Button>
          </div>
        </div>

        {photosQuery.isLoading ? (
          <div className="py-24 text-center text-muted-foreground"><Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin" />照片加载中...</div>
        ) : photos.length === 0 ? (
          <div className="rounded-[2rem] border border-border bg-card py-24 text-center text-muted-foreground">
            <ImageIcon className="mx-auto mb-4 h-16 w-16 opacity-20" />
            <p className="font-medium">这个相册还没有照片，请批量上传图片。</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
              {photos.map((photo) => (
                <div key={photo.id} className="group relative overflow-hidden rounded-3xl border border-border bg-muted shadow-sm">
                  <button
                    type="button"
                    className="absolute left-3 top-3 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-white/90 shadow"
                    onClick={() => toggleSelectPhoto(photo.id)}
                    aria-label="选择照片"
                  >
                    <span className={`h-3 w-3 rounded-full ${selectedPhotoIds.includes(photo.id) ? 'bg-primary' : 'bg-transparent ring-1 ring-muted-foreground'}`} />
                  </button>
                  <button type="button" className="block aspect-square w-full cursor-zoom-in" onClick={() => setViewPhoto(photo)}>
                    <img src={photo.thumbnail_url || photo.image_url} alt={photo.title || '照片'} loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                  </button>
                  <div className="absolute bottom-0 left-0 right-0 flex items-end justify-between bg-gradient-to-t from-black/65 to-transparent p-3 text-white opacity-0 transition-opacity group-hover:opacity-100">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold">{photo.title || '未命名照片'}</p>
                      <p className="text-[10px] text-white/80">{fileSizeText(photo.file_size)}</p>
                    </div>
                    <Button size="icon-xs" variant="destructive" className="bg-red-500/90 text-white" onClick={() => confirm('确认删除这张照片吗？') && deletePhotoMutation.mutate(photo.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            {photosQuery.data?.total_pages > 1 && (
              <div className="mt-8 flex justify-center gap-2">
                <Button variant="outline" disabled={photoPage <= 1} onClick={() => setPhotoPage((page) => page - 1)}>上一页</Button>
                <span className="flex items-center text-sm text-muted-foreground">第 {photoPage} / {photosQuery.data.total_pages} 页</span>
                <Button variant="outline" disabled={photoPage >= photosQuery.data.total_pages} onClick={() => setPhotoPage((page) => page + 1)}>下一页</Button>
              </div>
            )}
          </>
        )}

        <Dialog open={!!viewPhoto} onOpenChange={(open) => { if (!open) setViewPhoto(null); }}>
          <DialogContent className="h-screen w-screen max-w-none overflow-hidden rounded-none border-0 p-0 md:h-[90vh] md:w-[94vw] md:max-w-7xl md:rounded-2xl md:border">
            {viewPhoto && (
              <div className="grid h-full grid-rows-[1fr_auto] md:grid-cols-5 md:grid-rows-1">
                <div className="relative flex min-h-0 items-center justify-center overflow-auto bg-black/90 p-4 md:col-span-3 md:p-6">
                  {photos.length > 1 && (
                    <>
                      <Button type="button" variant="secondary" size="icon" className="absolute left-4 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/85 text-black shadow-lg" onClick={() => navigatePhoto(-1)}><ChevronLeft className="h-5 w-5" /></Button>
                      <Button type="button" variant="secondary" size="icon" className="absolute right-4 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/85 text-black shadow-lg" onClick={() => navigatePhoto(1)}><ChevronRight className="h-5 w-5" /></Button>
                    </>
                  )}
                  <img src={viewPhoto.image_url} alt={viewPhoto.title || '照片大图'} className="max-h-[86vh] rounded-2xl object-contain" />
                </div>
                <div className="overflow-y-auto bg-gradient-to-b from-background to-muted/30 p-4 md:col-span-2 md:p-8">
                  <h3 className="text-2xl font-bold">{viewPhoto.title || '未命名照片'}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{formatDate(viewPhoto.taken_date || viewPhoto.created_at)}</p>
                  <p className="mt-2 text-xs text-muted-foreground">大图预览按需加载原图，不会预加载整个相册。</p>
                  <Button variant="destructive" className="mt-4 rounded-full" onClick={() => confirm('确认删除这张照片吗？') && deletePhotoMutation.mutate(viewPhoto.id)}><Trash2 className="h-4 w-4" /> 删除照片</Button>
                  <Comments targetType="photo" targetId={viewPhoto.id} />
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {renderUploadDialog()}
      </div>
    );
  }

  function renderUploadDialog() {
    return (
      <Dialog open={uploadDialogOpen} onOpenChange={(open) => { if (!isUploading) setUploadDialogOpen(open); }}>
        <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader><DialogTitle>批量上传照片</DialogTitle></DialogHeader>
          <div className="space-y-5">
            {!selectedAlbumId && (
              <div className="space-y-2">
                <Label>上传到相册</Label>
                <select className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm" value={uploadAlbumId} onChange={(event) => setUploadAlbumId(event.target.value === 'new' ? 'new' : event.target.value ? Number(event.target.value) : '')} disabled={isUploading}>
                  <option value="">自动新建相册</option>
                  <option value="new">新建指定名称相册</option>
                  {albums.map((album) => <option key={album.id} value={album.id}>{album.name}</option>)}
                </select>
                {uploadAlbumId === 'new' && <Input value={newUploadAlbumName} onChange={(event) => setNewUploadAlbumName(event.target.value)} maxLength={50} placeholder="输入新相册名称（1-50 个字符）" />}
              </div>
            )}
            {renderUploadDropzone()}
            {uploadItems.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm"><span className="font-medium">上传队列（并发 {UPLOAD_CONCURRENCY} 张）</span><span className="text-muted-foreground">{uploadItems.length} / {MAX_FILES}</span></div>
                <div className="max-h-64 space-y-2 overflow-y-auto rounded-2xl border border-border p-3">
                  {uploadItems.map((item) => (
                    <div key={item.id} className="rounded-xl bg-muted/50 p-3">
                      <div className="flex items-center justify-between gap-3 text-xs">
                        <span className="min-w-0 truncate font-medium">{item.file.name}</span>
                        <span className={item.status === '失败' ? 'text-destructive' : 'text-muted-foreground'}>{item.status}</span>
                      </div>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-background"><div className="h-full bg-primary transition-all" style={{ width: `${item.progress}%` }} /></div>
                      {item.error && <p className="mt-1 text-xs text-destructive">{item.error}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" disabled={isUploading} onClick={() => setUploadDialogOpen(false)}>取消</Button>
              <Button type="button" disabled={isUploading || uploadItems.length === 0} onClick={startUpload}>{isUploading && <Loader2 className="h-4 w-4 animate-spin" />} 开始上传</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl p-6 pb-20 md:p-8">
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">相册</h1>
          <p className="mt-1 text-muted-foreground">以文件夹管理照片，缩略图优先加载，适合大量和大体积图片。</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" className="rounded-full gap-2" onClick={() => openUploadDialog()}><UploadCloud className="h-4 w-4" /> 批量上传</Button>
          <Button className="rounded-full gap-2" onClick={() => { setEditingAlbum(null); setAlbumDialogOpen(true); }}><Plus className="h-4 w-4" /> 新建相册</Button>
        </div>
      </div>

      {albumsQuery.isLoading ? (
        <div className="py-24 text-center text-muted-foreground"><Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin" />相册加载中...</div>
      ) : albums.length === 0 ? (
        <div className="rounded-[2rem] border border-dashed border-border bg-card py-24 text-center text-muted-foreground">
          <Folder className="mx-auto mb-4 h-16 w-16 opacity-20" />
          <p className="font-medium">暂无相册，请新建相册</p>
          <Button className="mt-4 rounded-full" onClick={() => setAlbumDialogOpen(true)}>新建相册</Button>
        </div>
      ) : (
        <>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {albums.map((album) => (
              <Card key={album.id} className="overflow-hidden rounded-[2rem] border-border bg-card/80 p-0 shadow-sm">
                <div className="aspect-[4/3] bg-muted">
                  {album.cover_thumbnail_url || album.cover_image_url ? (
                    <img src={album.cover_thumbnail_url || album.cover_image_url} alt={album.name} loading="lazy" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-muted-foreground"><Folder className="h-12 w-12 opacity-30" /></div>
                  )}
                </div>
                <div className="space-y-4 p-4">
                  <div>
                    <h2 className="truncate text-lg font-bold">{album.name}</h2>
                    {album.description && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{album.description}</p>}
                  </div>
                  <div className="grid gap-1 text-xs text-muted-foreground">
                    <span><ImageIcon className="mr-1 inline h-3 w-3" />{album.photo_count || 0} 张图片</span>
                    <span><Calendar className="mr-1 inline h-3 w-3" />创建：{formatDate(album.created_at)}</span>
                    <span>更新：{formatDate(album.last_photo_updated_at || album.updated_at)}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <Button className="col-span-3 rounded-full" onClick={() => { setSelectedAlbumId(album.id); setPhotoPage(1); }}>进入相册</Button>
                    <Button variant="outline" size="sm" onClick={() => { setEditingAlbum(album); setAlbumDialogOpen(true); }}><Edit2 className="h-3 w-3" />改名</Button>
                    <Button variant="outline" size="sm" onClick={() => openUploadDialog(album.id)}><UploadCloud className="h-3 w-3" />上传</Button>
                    <Button variant="destructive" size="sm" onClick={() => confirm(`确认删除相册「${album.name}」及其所有照片吗？`) && deleteAlbumMutation.mutate(album.id)}><Trash2 className="h-3 w-3" />删除</Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
          {albumsQuery.data?.total_pages > 1 && (
            <div className="mt-8 flex justify-center gap-2">
              <Button variant="outline" disabled={albumPage <= 1} onClick={() => setAlbumPage((page) => page - 1)}>上一页</Button>
              <span className="flex items-center text-sm text-muted-foreground">第 {albumPage} / {albumsQuery.data.total_pages} 页</span>
              <Button variant="outline" disabled={albumPage >= albumsQuery.data.total_pages} onClick={() => setAlbumPage((page) => page + 1)}>下一页</Button>
            </div>
          )}
        </>
      )}

      <Dialog open={albumDialogOpen} onOpenChange={(open) => { setAlbumDialogOpen(open); if (!open) setEditingAlbum(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingAlbum ? '修改相册名称' : '新建相册文件夹'}</DialogTitle></DialogHeader>
          <form className="space-y-4" onSubmit={handleAlbumSubmit}>
            <div className="space-y-2"><Label>相册名称 *</Label><Input name="name" maxLength={50} required defaultValue={editingAlbum?.name || ''} placeholder="例如：春日旅行" /></div>
            <div className="space-y-2"><Label>相册描述（可选）</Label><Textarea name="description" defaultValue={editingAlbum?.description || ''} placeholder="记录这个相册的故事..." /></div>
            <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setAlbumDialogOpen(false)}>取消</Button><Button type="submit" disabled={createAlbumMutation.isPending || updateAlbumMutation.isPending}>{editingAlbum ? '保存修改' : '创建相册'}</Button></div>
          </form>
        </DialogContent>
      </Dialog>

      {renderUploadDialog()}
    </div>
  );
}
