import { Link, useLocation } from 'react-router-dom';
import { Home, Search, Heart, User } from 'lucide-react';
import { useAuth } from '../lib/auth';

export function MobileBottomNav() {
  const location = useLocation();
  const { isAuthenticated } = useAuth();

  const navItems = [
    { icon: Home, label: 'Home', to: '/' },
    { icon: Search, label: 'Browse', to: '/browse' },
    { icon: Heart, label: 'Saved', to: isAuthenticated ? '/profile' : '/login' },
    { icon: User, label: 'Account', to: isAuthenticated ? '/profile' : '/login' },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-black/5 backdrop-blur-lg bg-white/95">
      <div className="grid grid-cols-4 h-16">
        {navItems.map((item) => {
          const isActive = location.pathname === item.to;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`flex flex-col items-center justify-center gap-1 transition-colors ${
                isActive ? 'text-primary' : 'text-foreground/60'
              }`}
              style={{ minHeight: '64px', minWidth: '64px' }}
            >
              <item.icon className="h-5 w-5" strokeWidth={isActive ? 2.5 : 2} />
              <span className="text-xs font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export default MobileBottomNav;
