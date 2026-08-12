import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { Button } from './ui/button';

export function ConsentBanner() {
  const [render, setRender] = useState(false);
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    if (localStorage.getItem('rentora_consent')) return;
    const t = setTimeout(() => setRender(true), 800);
    return () => clearTimeout(t);
  }, []);

  // Mount first, then flip to "entered" on the next frame so the
  // transition actually runs instead of snapping straight to its end state.
  useEffect(() => {
    if (!render) return;
    const raf = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(raf);
  }, [render]);

  const dismiss = (consentValue) => {
    localStorage.setItem('rentora_consent', consentValue);

    if (window.gtag) {
      window.gtag('consent', 'update', {
        analytics_storage: consentValue === 'true' ? 'granted' : 'denied',
      });
    }

    if (consentValue === 'true' && window.__initPostHogAnalytics) {
      window.__initPostHogAnalytics();
    }

    setEntered(false); // reverse the entrance transition
    setTimeout(() => setRender(false), 300); // unmount once it's finished
  };

  const accept = () => dismiss('true');
  const decline = () => dismiss('declined');

  if (!render) return null;

  return (
    <>
      <div
        className={`fixed inset-0 bg-black/50 z-[9998] transition-opacity duration-300 [transition-timing-function:var(--ease-out)] ${entered ? 'opacity-100' : 'opacity-0'}`}
        style={{ backdropFilter: 'blur(2px)' }}
      />
      <div className="fixed inset-0 z-[9999] flex items-end sm:items-end sm:justify-start sm:p-6 p-4">
        <div
          className={`bg-white rounded-2xl shadow-2xl p-5 w-full sm:max-w-sm transition-[transform,opacity] duration-300 [transition-timing-function:var(--ease-out)] ${
            entered ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'
          }`}
        >
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
