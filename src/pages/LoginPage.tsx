import { Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { useAppStore } from '../store/useAppStore';

export function LoginPage() {
  const currentUser = useAppStore((s) => s.currentUser);
  const login = useAppStore((s) => s.login);
  const addToast = useAppStore((s) => s.addToast);
  const navigate = useNavigate();
  const [email, setEmail] = useState('yash@shreenathji.com');
  const [password, setPassword] = useState('admin123');
  const [remember, setRemember] = useState(true);
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  if (currentUser) return <Navigate to="/dashboard" replace />;

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      const ok = login(email, password);
      if (ok) {
        navigate('/dashboard');
      } else {
        addToast('Invalid email or password', 'error');
      }
      setLoading(false);
    }, 500);
  };

  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex lg:w-1/2 bg-charcoal items-center justify-center p-12">
        <div className="max-w-md text-white">
          <div className="w-16 h-16 rounded-2xl bg-brand flex items-center justify-center mb-8">
            <span className="text-2xl font-bold">SE</span>
          </div>
          <h1 className="text-3xl font-bold mb-4">Shreenathji Enterprise</h1>
          <p className="text-gray-400 text-lg leading-relaxed">
            Job Work Management Portal for textile manufacturing — elastic, name tags, woven labels & more.
          </p>
          <div className="mt-8 grid grid-cols-2 gap-4">
            {['Job Work Tracking', 'Vendor Management', 'Inventory Control', 'Payment Billing'].map((f) => (
              <div key={f} className="flex items-center gap-2 text-sm text-gray-300">
                <span className="w-1.5 h-1.5 rounded-full bg-brand" />
                {f}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-8 bg-white">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-lg bg-brand flex items-center justify-center">
              <span className="text-white font-bold">SE</span>
            </div>
            <div>
              <p className="font-bold text-charcoal">Shreenathji Enterprise</p>
              <p className="text-xs text-muted">Job Work Portal</p>
            </div>
          </div>

          <h2 className="text-2xl font-bold text-charcoal mb-1">Welcome back</h2>
          <p className="text-sm text-muted mb-8">Sign in to your account to continue</p>

          <form onSubmit={handleLogin} className="space-y-5">
            <Input
              label="Email / User ID"
              type="text"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@shreenathji.com or u1"
              required
            />
            <div className="relative">
              <Input
                label="Password"
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                required
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                className="absolute right-3 top-8 text-muted"
              >
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm text-muted cursor-pointer">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="rounded border-border text-brand focus:ring-brand"
                />
                Remember Me
              </label>
              <button type="button" className="text-sm text-brand hover:underline">
                Forgot Password?
              </button>
            </div>

            <Button type="submit" className="w-full" size="lg" disabled={loading}>
              {loading ? 'Signing in...' : 'Login'}
            </Button>
          </form>

          <div className="mt-8 p-4 bg-surface rounded-lg border border-border">
            <p className="text-xs font-medium text-muted mb-2">Demo Accounts</p>
            <div className="grid grid-cols-1 gap-1 text-xs text-muted">
              <span>Admin: u1 or yash@shreenathji.com / admin123</span>
              <span>Manager: u2 or raj@shreenathji.com / manager123</span>
              <span>Store: u3 or store@shreenathji.com / store123</span>
              <span>Accounts: u4 or accounts@shreenathji.com / accounts123</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
