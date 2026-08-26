import { Link } from 'react-router-dom';
import { Megaphone, LogOut } from 'lucide-react';
import { useAuth } from '../lib/auth';

// Dedicated navbar for the advertising surface (advertise.rentora.com.ng
// and /advertise). Deliberately separate from components/Layout.jsx's main
// nav — no Browse/Compare/Contact links, nothing property-related. "Back to
// Rentora" is a plain <a>, not a router <Link>, because on the
// advertise.rentora.com.ng subdomain there is no in-app route for the main
// homepage — it lives on a different hostname (see App.js). /login,
// /register, and /profile stay as router Links so the session on whichever
// hostname the visitor is on is preserved.
export function AdvertiseNavbar() {
  const { user, isAuthenticated, logout } = useAuth();

  return (
    <header className="sticky top-0 z-40 w-full border-b border-black/5 bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-20 max-w-6xl items-center justify-between px-5 sm:px-8">
        <a
          href="https://rentora.com.ng"
          className="flex items-center gap-2 font-heading text-xl font-semibold tracking-tight text-primary"
          aria-label="Rentora home"
        >
          <img src="/rentora-logo.svg" alt="Rentora Logo" className="h-8 w-auto object-contain bg-transparent" loading="eager" decoding="async" width="64" height="64" />
          <span className="flex items-center gap-1.5">
            Rentora <span className="hidden text-muted-foreground sm:inline">· Advertising</span>
          </span>
        </a>

        <div className="flex items-center gap-3">
          <a href="https://rentora.com.ng" className="hidden text-sm font-medium text-muted-foreground transition-colors hover:text-primary sm:inline">
            Back to Rentora
          </a>
          {!isAuthenticated ? (
            <>
              <Link to="/login" className="rounded-full px-4 py-2 text-sm font-medium text-primary hover:bg-white">Log in</Link>
              <Link to="/register" className="hidden rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:opacity-90 sm:inline-block">Create account</Link>
            </>
          ) : (
            <>
              <Link to="/profile" className="hidden text-sm font-medium text-muted-foreground transition-colors hover:text-primary sm:inline">
                {user?.full_name || 'Profile'}
              </Link>
              <button onClick={logout} className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium text-primary hover:bg-white">
                <LogOut size={15} /> Log out
              </button>
            </>
          )}
        </div>
      </div>
      <div className="border-t border-black/5 bg-primary/5">
        <div className="mx-auto flex h-10 max-w-6xl items-center gap-2 px-5 text-xs font-medium text-primary sm:px-8">
          <Megaphone size={14} /> Advertise your property to renters across Rentora
        </div>
      </div>
    </header>
  );
}
