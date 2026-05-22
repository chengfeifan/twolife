import { useQuery } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import { api } from '@/lib/api';
import Markdown from 'react-markdown';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Comments } from '@/components/Comments';

export function BlogPostDetail() {
  const { id } = useParams();
  const { data: post } = useQuery({ queryKey: ['post', id], queryFn: () => api.request(`/posts/${id}`), enabled: !!id });
  if (!post) return null;
  return (
    <div className="p-8 max-w-4xl mx-auto pb-20">
      <Button asChild variant="outline" className="mb-4"><Link to="/blog">返回日记列表</Link></Button>
      <h1 className="text-3xl font-bold mb-2">{post.title}</h1>
      <p className="text-muted-foreground mb-6">{format(new Date(post.created_at), 'yyyy年MM月dd日')}</p>
      {post.cover_image_url && <img src={post.cover_image_url} className="w-full rounded-2xl mb-6" />}
      <div className="prose max-w-none"><Markdown>{post.content_markdown}</Markdown></div>
      <Comments targetType="post" targetId={post.id} />
    </div>
  );
}
