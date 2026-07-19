import { useState, useEffect } from 'react';
import { X, Smartphone } from 'lucide-react';

export function AppBanner() {
  const [visible, setVisible] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Don't show if already dismissed or installed
    const dismissed = localStorage.getItem('rentora_app_banner_dismissed');
    if (dismissed) return;

    // Check if already installed as PWA
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
      return;
    }

    // Detect iOS
    const ios = /iphone|ipad|ipod/.test(navigator.userAgent.toLowerCase());
    setIsIOS(ios);

    if (ios) {
      // iOS — show manual install instructions
      setTimeout(() => setVisible(true), 3000);
    } else {
      // Android/Chrome — listen for install prompt
      window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        setDeferredPrompt(e);
        setTimeout(() => setVisible(true), 3000);
      });
    }
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setVisible(false);
        setIsInstalled(true);
      }
      setDeferredPrompt(null);
    }
  };

  const dismiss = () => {
    localStorage.setItem('rentora_app_banner_dismissed', 'true');
    setVisible(false);
  };

  if (!visible || isInstalled) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[9990] p-3 sm:p-4"
      style={{ animation: 'slideUp 0.3s ease-out' }}>
      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>

      <div className="bg-white border border-border rounded-2xl shadow-2xl p-4 flex items-center gap-3 max-w-md mx-auto">
        {/* App icon */}
        <img
          src="/launchericon-72x72.png"
          alt="Rentora"
          className="w-12 h-12 rounded-xl shrink-0 shadow-sm"
        />

        {/* Text */}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm">Get the Rentora App</p>
          {isIOS ? (
            <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
              Tap <strong>Share</strong> then <strong>"Add to Home Screen"</strong>
            </p>
          ) : (
            <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
              Install for faster access — works offline too
            </p>
          )}
        </div>

        {/* Action */}
        {!isIOS && (
          deferredPrompt ? (
            <button
              onClick={handleInstall}
              className="shrink-0 bg-primary text-white text-xs font-semibold px-3 py-2 rounded-lg hover:bg-primary/90 active:scale-95 transition-all"
            >
              Install
            </button>
          ) : (
            <a
              href="/rentora.apk"
              download="Rentora.apk"
              className="shrink-0 bg-primary text-white text-xs font-semibold px-3 py-2 rounded-lg hover:bg-primary/90 active:scale-95 transition-all"
            >
              Download
            </a>
          )
        )}

        {/* Dismiss */}
        <button onClick={dismiss} className="shrink-0 text-muted-foreground hover:text-foreground p-1">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export default AppBanner;
