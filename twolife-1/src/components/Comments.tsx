import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { format } from 'date-fns';

export function Comments({ targetType, targetId }: { targetType: string; targetId: string | number }) {
  const queryClient = useQueryClient();
  const [content, setContent] = useState('');
  const [replyingTo, setReplyingTo] = useState<number | null>(null);

  const key = ['comments', targetType, targetId];
  const { data: comments = [] } = useQuery({
    queryKey: key,
    queryFn: () => api.request(`/comments?target_type=${targetType}&target_id=${targetId}`),
  });

  const createMutation = useMutation({
    mutationFn: (payload: any) => api.request('/comments', { method: 'POST', body: JSON.stringify(payload) }),
    onSuccess: () => {
      setContent('');
      setReplyingTo(null);
      queryClient.invalidateQueries({ queryKey: key });
    },
  });

  const rootComments = comments.filter((c: any) => !c.parent_id);
  const repliesMap = comments.reduce((acc: any, c: any) => {
    if (c.parent_id) acc[c.parent_id] = [...(acc[c.parent_id] || []), c];
    return acc;
  }, {});

  const submit = () => {
    if (!content.trim()) return;
    createMutation.mutate({ target_type: targetType, target_id: targetId, parent_id: replyingTo, content });
  };

  return (
    <div className="space-y-4 mt-8">
      <h3 className="text-lg font-bold">评论</h3>
      <div className="space-y-2">
        {replyingTo && <p className="text-xs text-muted-foreground">正在回复 #{replyingTo}</p>}
        <Textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="写下你的评论..." />
        <div className="flex gap-2">
          <Button onClick={submit} disabled={createMutation.isPending}>发送</Button>
          {replyingTo && <Button variant="outline" onClick={() => setReplyingTo(null)}>取消回复</Button>}
        </div>
      </div>

      <div className="space-y-4">
        {rootComments.map((comment: any) => (
          <div key={comment.id} className="rounded-2xl border border-border p-4">
            <div className="flex justify-between text-xs text-muted-foreground mb-2">
              <span>{comment.author_nickname || '匿名'}</span>
              <span>{format(new Date(comment.created_at), 'yyyy-MM-dd HH:mm')}</span>
            </div>
            <p className="text-sm whitespace-pre-wrap">{comment.content}</p>
            <Button variant="ghost" size="sm" className="mt-2" onClick={() => setReplyingTo(comment.id)}>回复</Button>
            {(repliesMap[comment.id] || []).map((reply: any) => (
              <div key={reply.id} className="mt-2 ml-4 rounded-xl bg-muted/40 p-3">
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>{reply.author_nickname || '匿名'}</span>
                  <span>{format(new Date(reply.created_at), 'yyyy-MM-dd HH:mm')}</span>
                </div>
                <p className="text-sm whitespace-pre-wrap">{reply.content}</p>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
