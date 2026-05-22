import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Eye, Heart, Lock, Mail, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

const themeDots = [
  'bg-pink-500',
  'bg-orange-300',
  'bg-purple-300',
  'bg-sky-400',
  'bg-emerald-300',
];

export function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
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
      if (rememberMe) {
        localStorage.setItem('rememberedUsername', username);
      }
      toast.success('欢迎回来！');
      navigate('/');
    } catch (err: any) {
      toast.error(err.message || '登录失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-rose-100 via-pink-50 to-white text-neutral-700">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,126,161,0.22),transparent_35%),radial-gradient(circle_at_85%_15%,rgba(255,175,189,0.2),transparent_35%),radial-gradient(circle_at_80%_80%,rgba(255,190,210,0.24),transparent_42%)]" />

      <div className="relative z-10 flex min-h-screen flex-col lg:grid lg:grid-cols-[1.2fr_0.95fr]">
        <section className="hidden px-14 py-12 lg:flex lg:flex-col">
          <div className="mb-16 flex items-center gap-4">
            <div className="rounded-2xl bg-white/60 p-2 shadow-sm backdrop-blur-sm">
              <Heart className="h-8 w-8 fill-pink-400 text-pink-400" />
            </div>
            <div>
              <p className="text-4xl font-semibold text-neutral-800">Couple Memory</p>
              <p className="mt-2 text-lg text-neutral-600">记录我们的专属时光</p>
            </div>
          </div>

          <div className="mt-8 max-w-xl space-y-8">
            <h1 className="text-7xl font-semibold leading-tight tracking-wide text-rose-950/80">
              珍藏点滴<br />爱意长存
            </h1>
            <p className="text-3xl leading-relaxed text-rose-950/75">
              属于两个人的私密空间，<br />记录我们的每一个美好瞬间
            </p>
          </div>
        </section>

        <section className="flex items-center justify-center p-4 sm:p-6 lg:p-10">
          <Card className="w-full max-w-[620px] rounded-[2rem] border border-white/80 bg-white/70 shadow-2xl backdrop-blur-md">
            <CardContent className="space-y-8 p-6 sm:p-10 lg:p-12">
              <div className="hidden items-center justify-end gap-3 text-sm text-neutral-500 lg:flex">
                <span>主题</span>
                {themeDots.map((dot, idx) => (
                  <span
                    key={dot}
                    className={`h-5 w-5 rounded-full ${dot} ${idx === 0 ? 'ring-2 ring-pink-400 ring-offset-2 ring-offset-white/40' : ''}`}
                  />
                ))}
              </div>

              <div className="space-y-4 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-pink-100/80">
                  <Heart className="h-8 w-8 fill-pink-400 text-pink-400" />
                </div>
                <h2 className="text-4xl font-semibold text-neutral-800">Couple Memory</h2>
                <p className="text-lg text-neutral-500">💕 记录我们的专属时光 💕</p>
                <h3 className="pt-2 text-5xl font-bold text-neutral-800">欢迎回来</h3>
                <p className="text-2xl text-neutral-500">登录后继续你们的美好回忆</p>
              </div>

              <form onSubmit={handleLogin} className="space-y-6">
                <div className="space-y-3">
                  <Label htmlFor="username" className="text-lg font-semibold text-neutral-800">用户名</Label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-neutral-400" />
                    <Input
                      id="username"
                      placeholder="请输入用户名"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="h-14 rounded-2xl border-neutral-200 bg-white/65 pl-12 text-lg"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <Label htmlFor="password" className="text-lg font-semibold text-neutral-800">密码</Label>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-neutral-400" />
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="请输入密码"
                      className="h-14 rounded-2xl border-neutral-200 bg-white/65 pl-12 pr-12 text-lg"
                      required
                    />
                    <Eye className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-neutral-400" />
                  </div>
                </div>

                <div className="flex items-center justify-between text-base sm:text-lg">
                  <label className="flex items-center gap-3 text-neutral-700">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="h-5 w-5 accent-pink-500"
                    />
                    记住我
                  </label>
                  <button type="button" className="text-pink-500 transition hover:text-pink-600">忘记密码？</button>
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="h-14 w-full rounded-2xl bg-gradient-to-r from-rose-400 via-pink-500 to-fuchsia-500 text-2xl font-semibold shadow-lg shadow-pink-200 hover:opacity-95"
                >
                  {loading ? '进入中...' : '立即登录'}
                </Button>
              </form>

              <div className="space-y-5 pt-2 text-center lg:hidden">
                <div className="flex items-center justify-center gap-8">
                  {themeDots.map((dot, idx) => (
                    <span
                      key={`m-${dot}`}
                      className={`h-8 w-8 rounded-full ${dot} ${idx === 0 ? 'flex items-center justify-center ring-2 ring-pink-400 ring-offset-2 ring-offset-white/60' : ''}`}
                    >
                      {idx === 0 && <Sparkles className="h-4 w-4 text-white" />}
                    </span>
                  ))}
                </div>
                <p className="text-2xl text-neutral-500">@2026</p>
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}
