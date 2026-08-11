import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card } from '../components/ui/card';
import { Label } from '../components/ui/label';
import { Mail, KeyRound, ArrowLeft } from 'lucide-react';
import { GoogleButton } from '../components/GoogleButton';
import { toast } from 'sonner';

export function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { requestOtpCode, verifyOtpCode, loginWithGoogle } = useAuth();

  const nextPath = new URLSearchParams(location.search).get('next') || '/browse';

  // step: 'email' → enter address, 'code' → enter the 6-digit code
  const [step, setStep] = useState('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sendLoading, setSendLoading] = useState(false);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const codeInputRef = useRef(null);

  useEffect(() => {
    if (step === 'code') codeInputRef.current?.focus();
  }, [step]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setInterval(() => setResendCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [resendCooldown]);

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    try {
      // Google's redirect loses our query string, so stash where to
      // return to and let AuthCallback.jsx pick it back up.
      if (nextPath && nextPath !== '/browse') {
        sessionStorage.setItem('rentora_post_login_next', nextPath);
      }
      await loginWithGoogle();
      // Browser redirects to Google here; no further code runs.
    } catch (error) {
      toast.error(error.message || 'Could not start Google sign-in');
      setGoogleLoading(false);
    }
  };

  const sendCode = async () => {
    if (!email.trim()) { toast.error('Enter your email address'); return; }
    setSendLoading(true);
    try {
      await requestOtpCode(email.trim(), { isNewAccount: false });
      setStep('code');
      setCode('');
      setResendCooldown(30);
      toast.success('Code sent — check your email');
    } catch (error) {
      toast.error(error.message || 'Could not send code');
    } finally {
      setSendLoading(false);
    }
  };

  const handleSendCode = async (e) => {
    e.preventDefault();
    await sendCode();
  };

  const handleVerifyCode = async (e) => {
    e.preventDefault();
    if (!code.trim() || code.trim().length !== 6) { toast.error('Enter the 6-digit code'); return; }
    setVerifyLoading(true);
    try {
      await verifyOtpCode(email.trim(), code.trim());
      toast.success('Welcome back!');
      navigate(nextPath);
    } catch (error) {
      toast.error(error.message || 'Invalid or expired code');
    } finally {
      setVerifyLoading(false);
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
          <p className="text-muted-foreground mt-2">
            {step === 'email' ? 'Sign in with a code sent to your email' : `Enter the code sent to ${email}`}
          </p>
        </div>

        {step === 'email' ? (
          <form onSubmit={handleSendCode} className="space-y-4">
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
                  autoFocus
                  data-testid="login-email"
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={sendLoading}
              className="w-full h-12 active:scale-[0.98] transition-transform"
              data-testid="login-send-code"
            >
              {sendLoading ? 'Sending code...' : 'Send Code'}
            </Button>
          </form>
        ) : (
          <form onSubmit={handleVerifyCode} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="code">6-digit code</Label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  id="code"
                  ref={codeInputRef}
                  inputMode="numeric"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="123456"
                  className="pl-10 h-12 tracking-widest text-center text-lg"
                  autoComplete="one-time-code"
                  data-testid="login-code"
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={verifyLoading}
              className="w-full h-12 active:scale-[0.98] transition-transform"
              data-testid="login-verify-code"
            >
              {verifyLoading ? 'Verifying...' : 'Verify & Sign In'}
            </Button>

            <div className="flex items-center justify-between text-sm">
              <button
                type="button"
                onClick={() => setStep('email')}
                className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Change email
              </button>
              <button
                type="button"
                onClick={sendCode}
                disabled={resendCooldown > 0 || sendLoading}
                className="text-primary hover:underline disabled:text-muted-foreground disabled:no-underline"
              >
                {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend code'}
              </button>
            </div>
          </form>
        )}

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
    </div>
  );
}

export default Login;
