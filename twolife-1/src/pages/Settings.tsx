import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { CalendarHeart, Check, Plus, Key, UserPlus } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { toast } from 'sonner';

const THEMES = [
  { id: 'pink', name: '浪漫粉', color: 'bg-[#f472b6]' },
  { id: 'ocean', name: '深海蓝', color: 'bg-[#0ea5e9]' },
  { id: 'lavender', name: '熏衣紫', color: 'bg-[#c084fc]' },
  { id: 'fresh', name: '清新绿', color: 'bg-[#16a34a]' },
  { id: 'warm', name: '暖阳橙', color: 'bg-[#f97316]' },
] as const;

export function Settings() {
  const queryClient = useQueryClient();
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [pwdModalOpen, setPwdModalOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const { data: user } = useQuery({
    queryKey: ['me'],
    queryFn: () => api.request('/auth/me')
  });

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: () => api.request('/settings')
  });

  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.request('/users'),
    enabled: user?.role === 'owner' || user?.role === 'admin'
  });

  const themeMutation = useMutation({
    mutationFn: (themeId: string) => api.request('/settings', {
      method: 'PUT',
      body: JSON.stringify({ theme_color: themeId })
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      toast.success('主题已更新');
    }
  });

  const addUserMutation = useMutation({
    mutationFn: (data: any) => api.request('/users', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('用户已添加');
      setUserModalOpen(false);
    }
  });

  const changePwdMutation = useMutation({
    mutationFn: ({ id, password }: any) => api.request(`/users/${id}/password`, {
      method: 'PUT',
      body: JSON.stringify({ password })
    }),
    onSuccess: () => {
      toast.success('密码已修改');
      setPwdModalOpen(false);
    }
  });

  const handleAddUser = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    addUserMutation.mutate(Object.fromEntries(formData));
  };

  const handleChangePwd = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const password = formData.get('password') as string;
    if (selectedUserId) {
      changePwdMutation.mutate({ id: selectedUserId, password });
    }
  };

  const isAdmin = user?.role === 'owner' || user?.role === 'admin';

  return (
    <div className="p-8 max-w-4xl mx-auto pb-20">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-foreground font-serif">设置</h1>
        <p className="text-muted-foreground mt-1">你的专属空间。</p>
      </div>

      <div className="space-y-12">
        {isAdmin && (
          <>
            <section>
              <h2 className="text-xl font-bold text-foreground mb-4 font-serif">外观设置</h2>
              <Card className="border-border rounded-[2rem] overflow-hidden shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg">主题色</CardTitle>
                  <CardDescription>选择一个属于你们的专属颜色</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-4">
                    {THEMES.map((theme) => {
                      const isActive = settings?.theme_color === theme.id;
                      return (
                        <button
                          key={theme.id}
                          onClick={() => themeMutation.mutate(theme.id)}
                          className={`relative w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-200 hover:scale-105 ${theme.color} shadow-sm border-4 ${isActive ? 'border-primary ring-4 ring-primary/20 scale-110 z-10' : 'border-transparent opacity-80 hover:opacity-100'}`}
                          title={theme.name}
                        >
                          {isActive && <Check className="w-6 h-6 text-white" />}
                        </button>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </section>

            <section>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-foreground font-serif">用户管理</h2>
                <Dialog open={userModalOpen} onOpenChange={setUserModalOpen}>
                  <DialogTrigger render={
                    <Button variant="outline" className="rounded-full gap-2">
                      <UserPlus className="w-4 h-4" /> 添加用户
                    </Button>
                  } />
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>添加新用户</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleAddUser} className="space-y-4">
                      <div className="space-y-2">
                        <Label>登录名</Label>
                        <Input name="username" required placeholder="建议使用拼音或英文" />
                      </div>
                      <div className="space-y-2">
                        <Label>昵称</Label>
                        <Input name="nickname" required placeholder="显示名称" />
                      </div>
                      <div className="space-y-2">
                        <Label>初始密码</Label>
                        <Input name="password" required />
                      </div>
                      <Button type="submit" className="w-full" disabled={addUserMutation.isPending}>确认添加</Button>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {users?.map((u: any) => (
                  <Card key={u.id} className="border-border rounded-3xl p-6 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                    <div>
                      <div className="font-bold text-foreground font-serif">{u.nickname}</div>
                      <div className="text-xs text-muted-foreground mt-1">账号：{u.username} • {u.role === 'owner' ? '所有者' : u.role === 'admin' ? '管理员' : '普通成员'}</div>
                    </div>
                    <Button 
                      variant="secondary" 
                      size="sm" 
                      className="rounded-full gap-2"
                      onClick={() => {
                        setSelectedUserId(u.id);
                        setPwdModalOpen(true);
                      }}
                    >
                      <Key className="w-4 h-4" /> 修改密码
                    </Button>
                  </Card>
                ))}
              </div>

              <Dialog open={pwdModalOpen} onOpenChange={setPwdModalOpen}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>修改密码</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleChangePwd} className="space-y-4">
                    <div className="space-y-2">
                      <Label>新密码</Label>
                      <Input name="password" type="password" required />
                    </div>
                    <Button type="submit" className="w-full" disabled={changePwdMutation.isPending}>确认修改</Button>
                  </form>
                </DialogContent>
              </Dialog>
            </section>
          </>
        )}

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
