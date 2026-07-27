import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card } from '../components/ui/card';
import { Label } from '../components/ui/label';
import { Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../components/ui/dialog';
import { toast } from 'sonner';

export function Login() {
  const navigate = useNavigate();
  const { login, requestPasswordReset } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const openForgotPassword = () => {
    setResetEmail(email);
    setResetSent(false);
    setShowForgotPassword(true);
  };

  const handleForgotPassword = async () => {
    if (!resetEmail) { toast.error('Enter your email address'); return; }
    setResetLoading(true);
    try {
      await requestPasswordReset(resetEmail);
      setResetSent(true);
    } catch (err) {
      toast.error(err.message || 'Failed to send reset link');
    } finally {
      setResetLoading(false);
    }
  };

  // Rate limiting — max 5 attempts per 15 minutes
  const getRateLimitKey = () => `rentora_login_attempts_${email.toLowerCase().trim()}`;
  const isRateLimited = () => {
    try {
      const key = getRateLimitKey();
      const data = JSON.parse(localStorage.getItem(key) || '{"count":0,"reset":0}');
      if (Date.now() > data.reset) return false; // window expired
      return data.count >= 5;
    } catch { return false; }
  };
  const recordAttempt = (success) => {
    try {
      const key = getRateLimitKey();
      if (success) { localStorage.removeItem(key); return; }
      const data = JSON.parse(localStorage.getItem(key) || '{"count":0,"reset":0}');
      const reset = Date.now() > data.reset ? Date.now() + 15 * 60 * 1000 : data.reset;
      localStorage.setItem(key, JSON.stringify({ count: (data.count || 0) + 1, reset }));
    } catch {}
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!email || !password) {
      toast.error('Please fill in all fields');
      return;
    }

    if (isRateLimited()) {
      toast.error('Too many failed attempts. Please wait 15 minutes before trying again.');
      return;
    }

    setLoading(true);
    try {
      await login(email, password);
      recordAttempt(true);
      toast.success('Welcome back!');
      navigate('/browse');
    } catch (error) {
      recordAttempt(false);
      toast.error(error.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4" data-testid="login-page">
      <Card className="w-full max-w-md p-8">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <img 
            src="/rentora-logo.svg" 
            alt="Rentora Logo" 
            className="h-10 w-auto object-contain bg-transparent" 
          />
        </div>

        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold tracking-tight">Welcome Back</h1>
          <p className="text-muted-foreground mt-2">Sign in to your account</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="pl-10 h-12"
                autoComplete="email"
                data-testid="login-email"
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <button
                type="button"
                onClick={openForgotPassword}
                className="text-xs text-primary hover:underline"
                data-testid="login-forgot-password"
              >
                Forgot password?
              </button>
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="pl-10 pr-10 h-12"
                autoComplete="current-password"
                data-testid="login-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full h-12 active:scale-[0.98] transition-transform"
            data-testid="login-submit"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground mt-6">
          Don't have an account?{' '}
          <Link to="/register" className="text-primary font-medium hover:underline">
            Create account
          </Link>
        </p>
      </Card>

      <Dialog open={showForgotPassword} onOpenChange={setShowForgotPassword}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset your password</DialogTitle>
            <DialogDescription>
              {resetSent
                ? "Check your inbox for a reset link."
                : "Enter your email and we'll send you a link to reset your password."}
            </DialogDescription>
          </DialogHeader>
          {resetSent ? (
            <div className="py-2">
              <p className="text-sm text-muted-foreground">
                We've sent a password reset link to <span className="font-medium text-foreground">{resetEmail}</span>. It may take a minute to arrive — check your spam folder if you don't see it.
              </p>
            </div>
          ) : (
            <div className="space-y-2 py-2">
              <Label htmlFor="reset-email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  id="reset-email"
                  type="email"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="pl-10 h-12"
                  autoComplete="email"
                  data-testid="reset-email"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            {resetSent ? (
              <Button onClick={() => setShowForgotPassword(false)} className="w-full">Done</Button>
            ) : (
              <>
                <Button variant="outline" onClick={() => setShowForgotPassword(false)}>Cancel</Button>
                <Button onClick={handleForgotPassword} disabled={resetLoading} data-testid="send-reset-link">
                  {resetLoading ? 'Sending...' : 'Send Reset Link'}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default Login;