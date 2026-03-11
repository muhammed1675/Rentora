import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { X, ShieldCheck } from 'lucide-react';
import { Button } from './ui/button';

export function ConsentBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const accepted = localStorage.getItem('rentora_consent');
    if (!accepted) {
      // Small delay so it doesn't flash immediately on load
      const t = setTimeout(() => setVisible(true), 1200);
      return () => clearTimeout(t);
    }
  }, []);

  const accept = () => {
    localStorage.setItem('rentora_consent', 'true');
    setVisible(false);
  };

  const decline = () => {
    localStorage.setItem('rentora_consent', 'declined');
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-[100] p-4 md:bottom-6 md:left-6 md:right-auto"
      style={{ animation: 'slideUp 0.4s ease-out' }}
    >
      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>

      <div className="bg-white border border-border rounded-2xl shadow-2xl p-5 max-w-sm w-full">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-4 h-4 text-primary" />
            </div>
            <p className="font-semibold text-sm">We value your privacy</p>
          </div>
          <button onClick={decline} className="text-muted-foreground hover:text-foreground shrink-0 mt-0.5">
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-muted-foreground leading-relaxed mb-4">
          By using Rentora, you agree to our{' '}
          <Link to="/terms" className="text-primary hover:underline font-medium" onClick={accept}>
            Terms & Conditions
          </Link>
          {' '}and{' '}
          <Link to="/terms" className="text-primary hover:underline font-medium" onClick={accept}>
            Privacy Policy
          </Link>
          . We store your login session and preferences in your browser's local storage to keep you signed in. No tracking or advertising data is collected.
        </p>

        <div className="flex gap-2">
          <Button onClick={accept} size="sm" className="flex-1 h-9 text-xs">
            Accept All
          </Button>
          <Button onClick={decline} variant="outline" size="sm" className="flex-1 h-9 text-xs">
            Decline
          </Button>
        </div>
      </div>
    </div>
  );
}

export default ConsentBanner;
