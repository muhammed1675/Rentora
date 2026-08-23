import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { Phone, X } from 'lucide-react';

const DISMISS_KEY = 'rentora_phone_banner_dismissed';

// Reminder for accounts with no phone number on file — this mostly hits
// Google sign-ups, since Google never hands us one. Not a hard block:
// dismissible per session (sessionStorage), so it comes back on the next
// visit/session as a gentle nudge rather than nagging forever once closed.
export function AddPhoneBanner() {
  const { needsPhone } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [dismissed, setDismissed] = useState(() => sessionStorage.getItem(DISMISS_KEY) === '1');

  // Never show while already on the profile page settings tab — that's
  // exactly where "Add now" sends them, so it'd be redundant there.
  if (!needsPhone || (location.pathname === '/profile' && location.search.includes('tab=settings'))) return null;
  if (dismissed) return null;

  const handleDismiss = () => {
    sessionStorage.setItem(DISMISS_KEY, '1');
    setDismissed(true);
  };

  const handleGo = () => {
    navigate('/profile?tab=settings#phone-number-field');
  };

  return (
    <div className="w-full bg-blue-50 border-b border-blue-200 text-blue-900">
      <div className="container mx-auto flex items-center gap-3 px-4 py-2 text-sm">
        <Phone className="h-4 w-4 shrink-0" />
        <span className="min-w-0 flex-1 truncate">
          Add your phone number so agents and support can reach you.
        </span>
        <button onClick={handleGo} className="shrink-0 font-medium underline underline-offset-2 hover:no-underline">
          Add now
        </button>
        <button onClick={handleDismiss} className="shrink-0 rounded p-0.5 hover:bg-blue-100" aria-label="Dismiss">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export default AddPhoneBanner;