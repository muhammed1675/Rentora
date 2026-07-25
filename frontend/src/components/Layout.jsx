import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../lib/auth';
import { Menu, X, ChevronDown, User as UserIcon, LogOut, LayoutDashboard, Shield } from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { ConsentBanner } from './ConsentBanner';
import { MobileBottomNav } from './MobileBottomNav';

const publicNav = [
  { label: 'Browse', to: '/browse' },
  { label: 'Compare', to: '/compare' },
  { label: 'Contact', to: '/contact' },
];

export function Layout({ children }) {
  const { user, logout, isAuthenticated, isAdmin, isAgent } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const handleLogout = () => { logout(); navigate('/'); };
  const initials = (user?.full_name || user?.email || 'U')
    .split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  return (
    <div className="min-h-screen w-full bg-background text-foreground flex flex-col">
      <header className="sticky top-0 z-40 w-full border-b border-black/5 bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 sm:px-8">
          <Link to="/" className="flex items-center gap-2 font-heading text-xl font-semibold tracking-tight text-primary" aria-label="Rentora home">
            {/* Direct reference to public folder logo */}
            <img 
              src="/rentora-logo.svg" 
              alt="Rentora Logo" 
              className="h-8 w-auto object-contain bg-transparent" 
            />
            Rentora
          </Link>

          <nav className="hidden items-center gap-8 md:flex" aria-label="Main navigation">
            {publicNav.map(item => {
              const active = location.pathname === item.to || (item.to !== '/' && location.pathname.startsWith(item.to));
              return (
                <Link key={item.to} to={item.to}
                  className={`text-sm font-medium transition-colors hover:text-primary ${active ? 'text-primary' : 'text-muted-foreground'}`}>
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="hidden items-center gap-3 md:flex">
            {!isAuthenticated ? (
              <>
                <Link to="/login" className="rounded-full px-4 py-2 text-sm font-medium text-primary hover:bg-white">Log in</Link>
                <Link to="/register" className="rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:opacity-90">Create account</Link>
              </>
            ) : (
              <DropdownMenu>
                <DropdownMenuTrigger className="flex items-center gap-2 rounded-full bg-white px-3 py-2 text-sm font-medium text-primary shadow-sm hover:bg-white/90">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">{initials}</span>
                  <span className="max-w-[120px] truncate">{user?.full_name || 'Account'}</span>
                  <ChevronDown className="h-4 w-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="truncate">{user?.email}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate('/profile')}><UserIcon className="mr-2 h-4 w-4" />Profile</DropdownMenuItem>
                  {isAgent && <DropdownMenuItem onClick={() => navigate('/agent')}><LayoutDashboard className="mr-2 h-4 w-4" />Agent dashboard</DropdownMenuItem>}
                  {isAdmin && <DropdownMenuItem onClick={() => navigate('/admin')}><Shield className="mr-2 h-4 w-4" />Admin</DropdownMenuItem>}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout} className="text-destructive"><LogOut className="mr-2 h-4 w-4" />Log out</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          <button onClick={() => setOpen(!open)}
            className="rounded-full p-2 text-primary md:hidden"
            aria-label={open ? 'Close navigation' : 'Open navigation'}
            aria-expanded={open}>
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {open && (
          <nav className="border-t border-black/5 bg-background px-5 py-5 md:hidden">
            <div className="flex flex-col gap-1">
              {publicNav.map(item => (
                <Link key={item.to} to={item.to} onClick={() => setOpen(false)}
                  className="rounded-xl px-3 py-3 text-sm font-medium hover:bg-white">{item.label}</Link>
              ))}
              {isAuthenticated && (
                <>
                  <Link to="/profile" onClick={() => setOpen(false)} className="rounded-xl px-3 py-3 text-sm font-medium hover:bg-white">Profile</Link>
                  {isAgent && <Link to="/agent" onClick={() => setOpen(false)} className="rounded-xl px-3 py-3 text-sm font-medium hover:bg-white">Agent dashboard</Link>}
                  {isAdmin && <Link to="/admin" onClick={() => setOpen(false)} className="rounded-xl px-3 py-3 text-sm font-medium hover:bg-white">Admin</Link>}
                </>
              )}
              <div className="mt-3 grid grid-cols-2 gap-2">
                {!isAuthenticated ? (
                  <>
                    <Link to="/login" onClick={() => setOpen(false)} className="rounded-full border border-primary/20 px-4 py-2.5 text-center text-sm font-medium">Log in</Link>
                    <Link to="/register" onClick={() => setOpen(false)} className="rounded-full bg-primary px-4 py-2.5 text-center text-sm font-medium text-primary-foreground">Join Rentora</Link>
                  </>
                ) : (
                  <button onClick={() => { setOpen(false); handleLogout(); }} className="col-span-2 rounded-full bg-primary px-4 py-2.5 text-center text-sm font-medium text-primary-foreground">Log out</button>
                )}
              </div>
            </div>
          </nav>
        )}
      </header>

      <main className="flex-1 pb-20 md:pb-0">{children}</main>
      <MobileBottomNav />

<footer className="w-full border-t border-slate-200 bg-white py-20 md:py-28 text-slate-900">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 sm:px-8 md:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <div className="mb-4 flex items-center gap-2 text-xl font-semibold">
              {/* Footer logo reference */}
              <img 
                src="/rentora-logo.svg" 
                alt="Rentora Logo" 
                className="h-8 w-auto object-contain bg-transparent" 
              />
              Rentora
            </div>
            <p className="max-w-sm text-sm leading-6 text-slate-600">
              Verified student housing, secure payments, and a clearer path home for LAUTECH students.
            </p>
          </div>
          <div>
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Explore</p>
            <div className="flex flex-col gap-3 text-sm text-slate-700">
              <Link to="/browse" className="transition-colors hover:text-primary">Browse homes</Link>
              <Link to="/compare" className="transition-colors hover:text-primary">Compare</Link>
            </div>
          </div>
          <div>
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Support</p>
            <div className="flex flex-col gap-3 text-sm text-slate-700">
              <Link to="/contact" className="transition-colors hover:text-primary">Contact us</Link>
              <Link to="/terms" className="transition-colors hover:text-primary">Terms &amp; policies</Link>
              <Link to="/profile" className="transition-colors hover:text-primary">My profile</Link>
            </div>
          </div>
        </div>
        <div className="mx-auto mt-16 flex max-w-7xl flex-col gap-2 border-t border-slate-200 pt-8 px-5 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <span>© {new Date().getFullYear()} Rentora. Built for Ogbomosho.</span>
          <span>Rent confidently. Move securely.</span>
        </div>
      </footer>

      <ConsentBanner />
    </div>
  );
}

export default Layout;
