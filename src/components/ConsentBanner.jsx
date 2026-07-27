import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { Button } from './ui/button';

export function ConsentBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (localStorage.getItem('rentora_consent')) return;

    const onboardingSeen = localStorage.getItem('rentora_onboarding_seen');

    if (onboardingSeen) {
      // Already seen onboarding before — also set done so everything stays in sync
      localStorage.setItem('rentora_onboarding_done', 'true');
      const t = setTimeout(() => setVisible(true), 800);
      return () => clearTimeout(t);
    }

    // New visitor — wait for onboarding to finish
    const interval = setInterval(() => {
      if (localStorage.getItem('rentora_onboarding_done')) {
        clearInterval(interval);
        setTimeout(() => setVisible(true), 500);
      }
    }, 300);

    return () => clearInterval(interval);
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
    <>
      <div className="fixed inset-0 bg-black/50 z-[9998]" style={{ backdropFilter: 'blur(2px)' }} />
      <div className="fixed inset-0 z-[9999] flex items-end sm:items-end sm:justify-start sm:p-6 p-4"
        style={{ animation: 'slideUp 0.35s ease-out' }}>
        <style>{`
          @keyframes slideUp {
            from { transform: translateY(40px); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
          }
        `}</style>
        <div className="bg-white rounded-2xl shadow-2xl p-5 w-full sm:max-w-sm">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-4 h-4 text-primary" />
            </div>
            <p className="font-semibold text-sm">We value your privacy</p>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed mb-4">
            By using Rentora, you agree to our{' '}
            <Link to="/terms" className="text-primary hover:underline font-medium" onClick={accept}>Terms & Conditions</Link>{' '}and{' '}
            <Link to="/terms" className="text-primary hover:underline font-medium" onClick={accept}>Privacy Policy</Link>.
            We store your login session and preferences in your browser's local storage to keep you signed in. No tracking or advertising data is collected.
          </p>
          <div className="flex gap-2">
            <Button onClick={accept} size="sm" className="flex-1 h-9 text-xs">Accept All</Button>
            <Button onClick={decline} variant="outline" size="sm" className="flex-1 h-9 text-xs">Decline</Button>
          </div>
        </div>
      </div>
    </>
  );
}

export default ConsentBanner;
