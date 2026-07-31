import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card } from '../components/ui/card';
import { Label } from '../components/ui/label';
import { Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../components/ui/dialog';
import { GoogleButton } from '../components/GoogleButton';
import { toast } from 'sonner';

export function Login() {
  const navigate = useNavigate();
  const { login, requestPasswordReset, loginWithGoogle, confirmPasswordResetWithCode } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [codeSubmitLoading, setCodeSubmitLoading] = useState(false);

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    try {
      await loginWithGoogle();
      // Browser redirects to Google here; no further code runs.
    } catch (error) {
      toast.error(error.message || 'Could not start Google sign-in');
      setGoogleLoading(false);
    }
  };

  const openForgotPassword = () => {
    setResetEmail(email);
    setResetSent(false);
    setResetCode('');
    setNewPassword('');
    setConfirmNewPassword('');
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

  const handleResetWithCode = async () => {
    if (!resetCode.trim()) { toast.error('Enter the code from your email'); return; }
    if (!newPassword || newPassword.length < 6) { toast.error('Password must be at least 6 characters'); return; }
    if (newPassword !== confirmNewPassword) { toast.error('Passwords do not match'); return; }

    setCodeSubmitLoading(true);
    try {
      await confirmPasswordResetWithCode(resetEmail, resetCode.trim(), newPassword);
      toast.success('Password updated! You are now signed in.');
      setShowForgotPassword(false);
      navigate('/browse');
    } catch (err) {
      toast.error(err.message || 'Invalid or expired code');
    } finally {
      setCodeSubmitLoading(false);
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
            className="h-10 w-auto object-contain bg-transparent" loading="eager" decoding="async" width="64" height="64" />
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

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
          </div>
        </div>

        <GoogleButton onClick={handleGoogleLogin} loading={googleLoading} data-testid="google-login" />

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
                ? "Click the link in your email, or enter the 6-digit code below."
                : "Enter your email and we'll send you a reset link and a code."}
            </DialogDescription>
          </DialogHeader>
          {resetSent ? (
            <div className="py-2 space-y-4">
              <p className="text-sm text-muted-foreground">
                We've sent a reset link and a 6-digit code to <span className="font-medium text-foreground">{resetEmail}</span>. It may take a minute to arrive — check your spam folder if you don't see it.
              </p>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">Have the code?</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="reset-code">6-digit code</Label>
                <Input
                  id="reset-code"
                  inputMode="numeric"
                  maxLength={6}
                  value={resetCode}
                  onChange={(e) => setResetCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="123456"
                  className="h-12 tracking-widest text-center text-lg"
                  data-testid="reset-code"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reset-new-password">New password</Label>
                <Input
                  id="reset-new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className="h-12"
                  autoComplete="new-password"
                  data-testid="reset-new-password"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reset-confirm-password">Confirm new password</Label>
                <Input
                  id="reset-confirm-password"
                  type="password"
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  className="h-12"
                  autoComplete="new-password"
                  data-testid="reset-confirm-password"
                />
              </div>
              <Button
                onClick={handleResetWithCode}
                disabled={codeSubmitLoading}
                className="w-full h-12"
                data-testid="reset-with-code-submit"
              >
                {codeSubmitLoading ? 'Updating password...' : 'Reset Password'}
              </Button>
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
              <Button variant="outline" onClick={() => setShowForgotPassword(false)} className="w-full">Cancel</Button>
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