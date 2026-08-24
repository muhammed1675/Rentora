import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { ShieldAlert, X } from 'lucide-react';

const DISMISS_KEY = 'rentora_verify_banner_dismissed';

// Persistent reminder for unverified signed-in students. Collapsible per
// session (sessionStorage, so it comes back in a new tab/session) but
// otherwise shown on every page until the account is approved.
export function VerificationBanner() {
  const { needsVerification, verificationStatus } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [dismissed, setDismissed] = useState(() => sessionStorage.getItem(DISMISS_KEY) === '1');

  // Never show on the verification page itself.
  if (!needsVerification || location.pathname.startsWith('/verify-account')) return null;
  if (dismissed) return null;

  const handleDismiss = () => {
    sessionStorage.setItem(DISMISS_KEY, '1');
    setDismissed(true);
  };

  const handleGo = () => {
    const next = encodeURIComponent(location.pathname + location.search);
    navigate(`/verify-account?next=${next}`);
  };

  const message = verificationStatus === 'pending'
    ? 'Your verification is under review — payments unlock once approved.'
    : verificationStatus === 'rejected'
      ? 'Your last verification submission was not approved. Resubmit to unlock bookings and payments.'
      : 'Verify your student status to unlock bookings and payments.';

  return (
    <div className="w-full bg-amber-50 border-b border-amber-200 text-amber-900">
      <div className="container mx-auto flex items-center gap-3 px-4 py-2 text-sm">
        <ShieldAlert className="h-4 w-4 shrink-0" />
        <span className="min-w-0 flex-1 truncate">{message}</span>
        {verificationStatus !== 'pending' && (
          <button onClick={handleGo} className="shrink-0 font-medium underline underline-offset-2 hover:no-underline">
            Verify now
          </button>
        )}
        <button onClick={handleDismiss} className="shrink-0 rounded p-0.5 hover:bg-amber-100" aria-label="Dismiss">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export default VerificationBanner;
