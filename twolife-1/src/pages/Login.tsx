import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Heart } from 'lucide-react';
import { toast } from 'sonner';

export function Login() {
  const [username, setUsername] = useState('gaoyisai');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.request('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password })
      });
      localStorage.setItem('token', res.token);
      localStorage.setItem('user', JSON.stringify(res.user));
      toast.success('欢迎回来！');
      navigate('/');
    } catch (err: any) {
      toast.error(err.message || '登录失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>
      <Card className="w-full max-w-md relative z-10 shadow-xl border-neutral-200/60 bg-white/80 backdrop-blur-xl">
        <CardHeader className="text-center pb-2">
          <div className="w-12 h-12 bg-pink-100 text-pink-500 rounded-2xl flex items-center justify-center mx-auto mb-4 rotate-12 shadow-sm">
            <Heart className="w-6 h-6 fill-current" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight text-neutral-800">TwoLife 双人宇宙</CardTitle>
          <CardDescription>我们的专属数字空间</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">用户名</Label>
              <Input 
                id="username" 
                placeholder="名称或邮箱" 
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">密码</Label>
              </div>
              <Input 
                id="password" 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full font-medium" disabled={loading}>
              {loading ? '进入中...' : '进入空间'}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="justify-center pt-2 pb-6 text-sm text-neutral-500">
        </CardFooter>
      </Card>
    </div>
  );
}
