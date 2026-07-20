import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { login } from '@/lib/api';
import { MessageSquare } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async () => {
    if (!email.trim()) return;
    setLoading(true);
    try {
      const result = await login(email.trim());
      localStorage.setItem('token', result.token);
      localStorage.setItem('userName', result.user.name || email);
      navigate('/');
    } catch (err: any) {
      alert('登录失败：' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-3">
            <MessageSquare className="w-10 h-10 text-primary" />
          </div>
          <CardTitle className="text-2xl">面试助手</CardTitle>
          <p className="text-sm text-gray-500 mt-1">AI 面试教练，帮你拿下心仪 Offer</p>
        </CardHeader>
        <CardContent>
          <Input
            type="email"
            placeholder="输入邮箱开始使用"
            value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            className="h-12"
          />
        </CardContent>
        <CardFooter>
          <Button className="w-full h-11" onClick={handleLogin} disabled={loading}>
            {loading ? '登录中...' : '开始使用'}
          </Button>
        </CardFooter>
        <p className="text-center text-xs text-gray-400 pb-6">
          MVP 阶段仅需邮箱，无需密码
        </p>
      </Card>
    </div>
  );
}
