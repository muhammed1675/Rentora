import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card } from '../components/ui/card';
import { Label } from '../components/ui/label';
import { Mail, User, Phone, KeyRound, ArrowLeft } from 'lucide-react';
import { GoogleButton } from '../components/GoogleButton';
import { toast } from 'sonner';

export function Register() {
  const navigate = useNavigate();
  const { requestOtpCode, verifyOtpCode, loginWithGoogle } = useAuth();

  // step: 'details' → name/phone/email/terms, 'code' → enter the 6-digit code
  const [step, setStep] = useState('details');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
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

  const handleGoogleSignUp = async () => {
    setGoogleLoading(true);
    try {
      await loginWithGoogle();
      // Browser redirects to Google here; no further code runs.
    } catch (error) {
      toast.error(error.message || 'Could not start Google sign-up');
      setGoogleLoading(false);
    }
  };

  const sendCode = async () => {
    setSendLoading(true);
    try {
      await requestOtpCode(email.trim(), {
        isNewAccount: true,
        fullName: fullName.trim(),
        phone: phone.trim(),
      });
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

    if (!fullName || !email || !phone) {
      toast.error('Please fill in all fields');
      return;
    }
    if (!/^[+]?[0-9]{10,15}$/.test(phone.replace(/\s/g, ''))) {
      toast.error('Please enter a valid phone number');
      return;
    }
    if (!agreedToTerms) {
      toast.error('Please agree to the Terms & Conditions to continue');
      return;
    }

    await sendCode();
  };

  const handleVerifyCode = async (e) => {
    e.preventDefault();
    if (!code.trim() || code.trim().length !== 6) { toast.error('Enter the 6-digit code'); return; }
    setVerifyLoading(true);
    try {
      await verifyOtpCode(email.trim(), code.trim());
      toast.success('Account created! Next: verify you are a LAUTECH student.');
      navigate('/verify-account');
    } catch (error) {
      toast.error(error.message || 'Invalid or expired code');
    } finally {
      setVerifyLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4" data-testid="register-page">
      <Card className="w-full max-w-md p-8">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <img
            src="/rentora-logo.svg"
            alt="Rentora Logo"
            className="h-10 w-auto object-contain bg-transparent" loading="eager" decoding="async" width="64" height="64" />
        </div>

        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold tracking-tight">Create Account</h1>
          <p className="text-muted-foreground mt-2">
            {step === 'details' ? 'Join Rentora today' : `Enter the code sent to ${email}`}
          </p>
        </div>

        {step === 'details' ? (
          <form onSubmit={handleSendCode} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  id="fullName"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="John Doe"
                  className="pl-10 h-12"
                  data-testid="register-name"
                />
              </div>
            </div>

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
                  data-testid="register-email"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. 08012345678"
                  className="pl-10 h-12"
                  data-testid="register-phone"
                />
              </div>
            </div>

            {/* Terms agreement */}
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/40 border border-border">
              <input
                type="checkbox"
                id="agree-terms"
                checked={agreedToTerms}
                onChange={(e) => setAgreedToTerms(e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-primary cursor-pointer shrink-0"
              />
              <label htmlFor="agree-terms" className="text-xs text-muted-foreground leading-relaxed cursor-pointer">
                I agree to Rentora's{' '}
                <a href="/terms" target="_blank" className="text-primary hover:underline font-medium">
                  Terms & Conditions
                </a>
                ,{' '}
                <a href="/terms" target="_blank" className="text-primary hover:underline font-medium">
                  Privacy Policy
                </a>
                {' '}and{' '}
                <a href="/terms" target="_blank" className="text-primary hover:underline font-medium">
                  Refund Policy
                </a>
              </label>
            </div>

            <Button
              type="submit"
              disabled={sendLoading || !agreedToTerms}
              className="w-full h-12 active:scale-[0.98] transition-transform"
              data-testid="register-submit"
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
                  data-testid="register-code"
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={verifyLoading}
              className="w-full h-12 active:scale-[0.98] transition-transform"
              data-testid="register-verify-code"
            >
              {verifyLoading ? 'Verifying...' : 'Verify & Create Account'}
            </Button>

            <div className="flex items-center justify-between text-sm">
              <button
                type="button"
                onClick={() => setStep('details')}
                className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Edit details
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

        <GoogleButton
          onClick={handleGoogleSignUp}
          loading={googleLoading}
          label="Sign up with Google"
          data-testid="google-signup"
        />

        <p className="text-center text-sm text-muted-foreground mt-6">
          Already have an account?{' '}
          <Link to="/login" className="text-primary font-medium hover:underline">
            Sign in
          </Link>
        </p>
      </Card>
    </div>
  );
}

export default Register;
