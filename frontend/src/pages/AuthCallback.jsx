import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

export function AuthCallback() {
  const navigate = useNavigate();
  const { completeOAuthSignIn } = useAuth();
  const [error, setError] = useState('');
  const ran = useRef(false);

  useEffect(() => {
    // Guard against React StrictMode / re-render double-invoking this,
    // since the auth code can only be exchanged once.
    if (ran.current) return;
    ran.current = true;

    (async () => {
      try {
        const profile = await completeOAuthSignIn();
        toast.success('Welcome!');

        const storedNext = sessionStorage.getItem('rentora_post_login_next');
        sessionStorage.removeItem('rentora_post_login_next');

        // Only a genuinely brand-new sign-up gets steered to verification —
        // an existing user completing Google sign-in just goes back to
        // wherever they were headed. On the advertising subdomain that's
        // the advertiser dashboard; everywhere else it's /browse.
        // Verification is enforced at the action, not by blocking the site.
        const isAdvertiseHost = window.location.hostname === 'advertise.rentora.com.ng';
        const destination = profile?._isNewUser
          ? '/verify-account'
          : (storedNext || (isAdvertiseHost ? '/advertise/dashboard' : '/browse'));
        navigate(destination, { replace: true });
      } catch (err) {
        setError(err.message || 'Failed to sign in with Google.');
      }
    })();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4">
        <Card className="w-full max-w-md p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-10 h-10 text-red-600" />
          </div>
          <h1 className="text-xl font-bold mb-2">Sign-in failed</h1>
          <p className="text-muted-foreground mb-6">{error}</p>
          <Button className="w-full h-12" onClick={() => navigate('/login')}>
            Back to Login
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8 text-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-muted-foreground">Completing sign-in...</p>
      </Card>
    </div>
  );
}

export default AuthCallback;
