import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Plus, Trash2, Edit2 } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import Markdown from 'react-markdown';

export function Blog() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [selectedPost, setSelectedPost] = useState<any>(null);
  const [editItem, setEditItem] = useState<any>(null);
  const navigate = useNavigate();

  const { data: posts = [], isLoading } = useQuery({ queryKey: ['posts'], queryFn: () => api.request('/posts') });

  const createMutation = useMutation({
    mutationFn: (newPost: any) => api.request('/posts', { method: 'POST', body: JSON.stringify(newPost) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      setOpen(false);
      toast.success('发布成功！');
    }
  });

  const updateMutation = useMutation({
    mutationFn: (data: { id: string, payload: any }) => api.request(`/posts/${data.id}`, { method: 'PUT', body: JSON.stringify(data.payload) }),
    onSuccess: (updatedPost) => {
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      setOpen(false);
      if (selectedPost?.id === updatedPost.id) {
         setSelectedPost(updatedPost);
      }
      setEditItem(null);
      toast.success('更新成功！');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.request(`/posts/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      setSelectedPost(null);
      toast.success('删除成功。');
    }
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const payload = {
      title: formData.get('title'),
      summary: formData.get('summary'),
      content_markdown: formData.get('content_markdown'),
      cover_image_url: formData.get('cover_image_url'),
      status: 'published'
    };
    if (editItem) {
       updateMutation.mutate({ id: editItem.id, payload });
    } else {
       createMutation.mutate(payload);
    }
  };

  useEffect(() => {
    if (!selectedPost && posts.length > 0) {
      setSelectedPost(posts[0]);
    }
  }, [posts, selectedPost]);

  return (
    <div className="p-8 max-w-5xl mx-auto flex flex-col md:flex-row gap-8 pb-20">
      <div className="flex-1">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">我们的日记</h1>
            <p className="text-muted-foreground mt-1">记录生活里的点点滴滴。</p>
          </div>
          
          <Dialog open={open} onOpenChange={(val) => { setOpen(val); if (!val) setEditItem(null); }}>
            <DialogTrigger render={
              <Button onClick={() => setEditItem(null)} className="rounded-full gap-2 px-6 shadow-sm">
                <Plus className="w-4 h-4" /> 写点什么
              </Button>
            } />
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>{editItem ? '编辑日记' : '新日记'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>标题</Label>
                  <Input name="title" defaultValue={editItem?.title} required placeholder="美好的一天..." />
                </div>
                <div className="space-y-2">
                  <Label>内容简介</Label>
                  <Input name="summary" defaultValue={editItem?.summary} placeholder="简短的介绍..." />
                </div>
                <div className="space-y-2">
                  <Label>封面图片 URL（可选）</Label>
                  <Input name="cover_image_url" defaultValue={editItem?.cover_image_url} placeholder="/uploads/xxx.jpg" />
                </div>
                <div className="space-y-2">
                  <Label>正文（支持 Markdown）</Label>
                  <Textarea name="content_markdown" defaultValue={editItem?.content_markdown} className="min-h-[300px] font-mono text-sm" placeholder="# Heading&#10;&#10;写点什么..." required />
                </div>
                <Button type="submit" className="w-full" disabled={createMutation.isPending || updateMutation.isPending}>
                  发布日记
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="space-y-6">
          {isLoading && (
            <div className="rounded-[2rem] border border-dashed border-border bg-muted/20 p-8 text-center text-muted-foreground">
              日记加载中...
            </div>
          )}

          {!isLoading && posts.length === 0 && (
            <div className="rounded-[2rem] border border-dashed border-border bg-muted/20 p-8 text-center text-muted-foreground">
              还没有日记，点击右上角“写点什么”开始记录吧。
            </div>
          )}

          {posts.map((post: any) => (
            <Card 
               key={post.id} 
               className={`cursor-pointer transition-all border-border hover:border-primary/50 rounded-[2rem] ${selectedPost?.id === post.id ? 'ring-2 ring-primary ring-opacity-50' : ''}`}
               onClick={() => setSelectedPost(post)}
               onDoubleClick={() => navigate(`/blog/${post.id}`)}
            >
              <CardContent className="p-8">
                 <h2 className="text-xl font-bold text-foreground font-serif">{post.title}</h2>
                 <p className="text-muted-foreground mt-2 line-clamp-2">{post.summary}</p>
                 <time className="text-[10px] font-bold uppercase tracking-widest text-[#B4A096] mt-4 block">
                   {format(new Date(post.created_at), 'yyyy年MM月dd日')}
                 </time>
                 <div className="mt-6" onClick={(e) => e.stopPropagation()}>
                   <Comments targetType="post" targetId={post.id} />
                 </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Reader Pane */}
      {selectedPost ? (
         <div className="w-full md:w-[500px] lg:w-[600px] bg-card border border-border rounded-[2rem] p-8 shadow-sm h-fit sticky top-8">
            <div className="flex justify-between items-start mb-6">
               <time className="text-[10px] font-bold uppercase tracking-widest text-primary block">
                 {format(new Date(selectedPost.created_at), 'yyyy年MM月dd日')}
               </time>
               <div className="flex gap-1">
                 <Button 
                   variant="ghost" 
                   size="icon" 
                   onClick={() => {
                       setEditItem(selectedPost);
                       setOpen(true);
                   }}
                   className="hover:bg-muted rounded-full"
                 >
                   <Edit2 className="w-4 h-4" />
                 </Button>
                 <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => {
                          if (confirm('确定要删除这篇日记吗？')) {
                              deleteMutation.mutate(selectedPost.id);
                          }
                      }}
                      className="hover:bg-destructive/10 hover:text-destructive rounded-full"
                    >
                      <Trash2 className="w-4 h-4" />
                 </Button>
               </div>
            </div>
            <h2 className="text-3xl font-bold tracking-tight text-foreground font-serif mb-8">{selectedPost.title}</h2>
            {selectedPost.cover_image_url && <img src={selectedPost.cover_image_url} className="w-full rounded-2xl mb-6" />}
            <div className="prose prose-neutral prose-p:text-muted-foreground max-w-none">
              <div className="markdown-body">
                <Markdown>{selectedPost.content_markdown}</Markdown>
              </div>
            </div>
         </div>
      ) : (
        <div className="hidden md:flex w-[500px] lg:w-[600px] items-center justify-center border border-dashed border-border rounded-[2rem] bg-muted/20 text-muted-foreground font-medium">
           选择一篇日记来阅读。
        </div>
      )}
    </div>
  );
}
