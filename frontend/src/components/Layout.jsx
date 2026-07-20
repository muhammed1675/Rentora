import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { 
  Home, 
  Search, 
  User, 
  Coins, 
  LayoutDashboard, 
  Shield, 
  LogOut,
  Menu,
  X,
  Building2,
  ChevronDown,
  Settings,
  Users,
  FileCheck,
  Receipt,
  Calendar,
  Plus,
  BadgeCheck,
  MessageSquare,
  Mail
} from 'lucide-react';
import { Button } from './ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { Avatar, AvatarFallback } from './ui/avatar';
import { Badge } from './ui/badge';
import { useState } from 'react';
import { ConsentBanner } from './ConsentBanner';

export function Layout({ children }) {
  const { user, logout, isAuthenticated, isAdmin, isAgent } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const isActive = (path) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  const getInitials = (name) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop Header */}
      <header className="hidden md:block sticky top-0 z-50 glass border-b">
        <div className="container mx-auto px-6">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2">
              <img src="/rentora-logo.png" alt="Rentora" className="h-9 w-auto" />
            </Link>

            {/* Desktop Nav */}
            <nav className="flex items-center gap-1">
              {/* Public Links */}
              <Link to="/">
                <Button
                  variant={isActive('/') && location.pathname === '/' ? 'default' : 'ghost'}
                  size="sm"
                  className="gap-2"
                  data-testid="nav-home"
                >
                  <Home className="w-4 h-4" />
                  Home
                </Button>
              </Link>
              
              <Link to="/browse">
                <Button
                  variant={isActive('/browse') ? 'default' : 'ghost'}
                  size="sm"
                  className="gap-2"
                  data-testid="nav-browse"
                >
                  <Search className="w-4 h-4" />
                  Browse
                </Button>
              </Link>

              {isAuthenticated && (
                <>
                  <Link to="/profile">
                    <Button
                      variant={isActive('/profile') ? 'default' : 'ghost'}
                      size="sm"
                      className="gap-2"
                      data-testid="nav-profile"
                    >
                      <User className="w-4 h-4" />
                      Profile
                    </Button>
                  </Link>
                  
                  <Link to="/buy-tokens">
                    <Button
                      variant={isActive('/buy-tokens') ? 'default' : 'ghost'}
                      size="sm"
                      className="gap-2"
                      data-testid="nav-tokens"
                    >
                      <Coins className="w-4 h-4" />
                      Tokens
                    </Button>
                  </Link>
                </>
              )}

              {/* Agent Dropdown */}
              {isAgent && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant={isActive('/agent') ? 'default' : 'ghost'}
                      size="sm"
                      className="gap-2"
                      data-testid="nav-agent"
                    >
                      <Building2 className="w-4 h-4" />
                      Agent
                      <ChevronDown className="w-3 h-3 ml-1" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel className="flex items-center gap-2">
                      <BadgeCheck className="w-4 h-4 text-secondary" />
                      Agent Panel
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => navigate('/agent')} className="cursor-pointer">
                      <LayoutDashboard className="w-4 h-4 mr-2" />
                      Dashboard
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate('/agent')} className="cursor-pointer">
                      <Building2 className="w-4 h-4 mr-2" />
                      My Properties
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate('/agent')} className="cursor-pointer">
                      <Calendar className="w-4 h-4 mr-2" />
                      Inspections
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => navigate('/agent')} className="cursor-pointer text-primary">
                      <Plus className="w-4 h-4 mr-2" />
                      Add New Property
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

              {/* Admin Dropdown */}
              {isAdmin && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant={isActive('/admin') ? 'default' : 'ghost'}
                      size="sm"
                      className="gap-2"
                      data-testid="nav-admin"
                    >
                      <Shield className="w-4 h-4" />
                      Admin
                      <ChevronDown className="w-3 h-3 ml-1" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-destructive" />
                      Admin Panel
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => navigate('/admin')} className="cursor-pointer">
                      <LayoutDashboard className="w-4 h-4 mr-2" />
                      Overview
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate('/admin?tab=users')} className="cursor-pointer">
                      <Users className="w-4 h-4 mr-2" />
                      User Management
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate('/admin?tab=verification')} className="cursor-pointer">
                      <FileCheck className="w-4 h-4 mr-2" />
                      Agent Verification
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate('/admin?tab=properties')} className="cursor-pointer">
                      <Building2 className="w-4 h-4 mr-2" />
                      Properties
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate('/admin?tab=inspections')} className="cursor-pointer">
                      <Calendar className="w-4 h-4 mr-2" />
                      Inspections
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate('/admin?tab=transactions')} className="cursor-pointer">
                      <Receipt className="w-4 h-4 mr-2" />
                      Transactions
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              
              {/* User Menu / Auth Buttons */}
              {isAuthenticated ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="gap-2 ml-2" data-testid="user-menu">
                      <Avatar className="w-7 h-7">
                        <AvatarFallback className="bg-primary/10 text-primary text-xs">
                          {getInitials(user?.full_name)}
                        </AvatarFallback>
                      </Avatar>
                      <ChevronDown className="w-3 h-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel>
                      <div className="flex flex-col">
                        <span className="font-medium">{user?.full_name}</span>
                        <span className="text-xs text-muted-foreground">{user?.email}</span>
                        <Badge variant="outline" className="w-fit mt-1 capitalize text-xs">
                          {user?.role}
                        </Badge>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => navigate('/profile')} className="cursor-pointer">
                      <User className="w-4 h-4 mr-2" />
                      My Profile
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate('/buy-tokens')} className="cursor-pointer">
                      <Coins className="w-4 h-4 mr-2" />
                      Buy Tokens
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-destructive">
                      <LogOut className="w-4 h-4 mr-2" />
                      Logout
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <div className="flex items-center gap-2 ml-2">
                  <Link to="/login">
                    <Button variant="ghost" size="sm" data-testid="nav-login">
                      Login
                    </Button>
                  </Link>
                  <Link to="/register">
                    <Button size="sm" data-testid="nav-register">
                      Register
                    </Button>
                  </Link>
                </div>
              )}
            </nav>
          </div>
        </div>
      </header>

      {/* Mobile Header */}
      <header className="md:hidden sticky top-0 z-50 glass border-b">
        <div className="flex items-center justify-between h-14 px-4">
          <Link to="/" className="flex items-center gap-2">
            <img src="/rentora-logo.png" alt="Rentora" className="h-8 w-auto" />
          </Link>

          <div className="flex items-center gap-2">
            {isAuthenticated && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" data-testid="mobile-user-menu">
                    <Avatar className="w-8 h-8">
                      <AvatarFallback className="bg-primary/10 text-primary text-xs">
                        {getInitials(user?.full_name)}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  <DropdownMenuLabel>
                    <div className="flex flex-col">
                      <span className="font-medium">{user?.full_name}</span>
                      <span className="text-xs text-muted-foreground">{user?.email}</span>
                      <Badge variant="outline" className="w-fit mt-1 capitalize text-xs">
                        {user?.role}
                      </Badge>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  
                  {isAdmin && (
                    <>
                      <DropdownMenuLabel className="text-xs text-muted-foreground flex items-center gap-2">
                        <Shield className="w-3 h-3" />
                        Admin Panel
                      </DropdownMenuLabel>
                      <DropdownMenuItem onClick={() => navigate('/admin')} className="cursor-pointer">
                        <LayoutDashboard className="w-4 h-4 mr-2" />
                        Admin Dashboard
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate('/admin?tab=users')} className="cursor-pointer">
                        <Users className="w-4 h-4 mr-2" />
                        Manage Users
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                    </>
                  )}
                  
                  {isAgent && (
                    <>
                      <DropdownMenuLabel className="text-xs text-muted-foreground flex items-center gap-2">
                        <BadgeCheck className="w-3 h-3" />
                        Agent Panel
                      </DropdownMenuLabel>
                      <DropdownMenuItem onClick={() => navigate('/agent')} className="cursor-pointer">
                        <LayoutDashboard className="w-4 h-4 mr-2" />
                        Agent Dashboard
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate('/agent')} className="cursor-pointer">
                        <Plus className="w-4 h-4 mr-2" />
                        Add Property
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                    </>
                  )}
                  
                  <DropdownMenuItem onClick={() => navigate('/profile')} className="cursor-pointer">
                    <User className="w-4 h-4 mr-2" />
                    My Profile
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate('/buy-tokens')} className="cursor-pointer">
                    <Coins className="w-4 h-4 mr-2" />
                    Buy Tokens
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-destructive">
                    <LogOut className="w-4 h-4 mr-2" />
                    Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            
            {!isAuthenticated && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                data-testid="mobile-menu-toggle"
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </Button>
            )}
          </div>
        </div>

        {/* Mobile Menu Dropdown for non-authenticated */}
        {!isAuthenticated && mobileMenuOpen && (
          <div className="absolute top-14 left-0 right-0 glass border-b p-4 animate-fade-in">
            <div className="flex flex-col gap-2">
              <div className="flex gap-2">
                <Link to="/login" className="flex-1" onClick={() => setMobileMenuOpen(false)}>
                  <Button variant="outline" className="w-full" data-testid="mobile-login">
                    Login
                  </Button>
                </Link>
                <Link to="/register" className="flex-1" onClick={() => setMobileMenuOpen(false)}>
                  <Button className="w-full" data-testid="mobile-register">
                    Register
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="pb-28 md:pb-8">
        {children}
      </main>

      {/* Mobile Bottom Nav — Glass Pill */}
      <nav className="md:hidden fixed bottom-5 left-0 right-0 z-50 flex justify-center px-6">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '2px',
            padding: '6px',
            borderRadius: '9999px',
            background: 'rgba(255,255,255,0.82)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(255,255,255,0.6)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.13)',
          }}
        >
          <Link to="/" data-testid="mobile-nav-home" style={{ textDecoration: 'none' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: location.pathname === '/' ? '6px' : '0',
              padding: location.pathname === '/' ? '8px 14px' : '9px 11px',
              borderRadius: '9999px',
              background: location.pathname === '/' ? 'hsl(var(--primary))' : 'transparent',
              color: location.pathname === '/' ? 'white' : 'rgba(0,0,0,0.38)',
              transition: 'all 0.28s cubic-bezier(0.34,1.56,0.64,1)',
            }}>
              <Home style={{ width: '18px', height: '18px', flexShrink: 0 }} />
              {location.pathname === '/' && <span style={{ fontSize: '13px', fontWeight: 600, whiteSpace: 'nowrap' }}>Home</span>}
            </div>
          </Link>

          <Link to="/browse" data-testid="mobile-nav-browse" style={{ textDecoration: 'none' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: isActive('/browse') ? '6px' : '0',
              padding: isActive('/browse') ? '8px 14px' : '9px 11px',
              borderRadius: '9999px',
              background: isActive('/browse') ? 'hsl(var(--primary))' : 'transparent',
              color: isActive('/browse') ? 'white' : 'rgba(0,0,0,0.38)',
              transition: 'all 0.28s cubic-bezier(0.34,1.56,0.64,1)',
            }}>
              <Search style={{ width: '18px', height: '18px', flexShrink: 0 }} />
              {isActive('/browse') && <span style={{ fontSize: '13px', fontWeight: 600, whiteSpace: 'nowrap' }}>Browse</span>}
            </div>
          </Link>

          <Link to="/contact" data-testid="mobile-nav-contact" style={{ textDecoration: 'none' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: isActive('/contact') ? '6px' : '0',
              padding: isActive('/contact') ? '8px 14px' : '9px 11px',
              borderRadius: '9999px',
              background: isActive('/contact') ? 'hsl(var(--primary))' : 'transparent',
              color: isActive('/contact') ? 'white' : 'rgba(0,0,0,0.38)',
              transition: 'all 0.28s cubic-bezier(0.34,1.56,0.64,1)',
            }}>
              <MessageSquare style={{ width: '18px', height: '18px', flexShrink: 0 }} />
              {isActive('/contact') && <span style={{ fontSize: '13px', fontWeight: 600, whiteSpace: 'nowrap' }}>Contact</span>}
            </div>
          </Link>

          {isAuthenticated ? (
            <>
              <Link to="/profile" data-testid="mobile-nav-profile" style={{ textDecoration: 'none' }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: isActive('/profile') ? '6px' : '0',
                  padding: isActive('/profile') ? '8px 14px' : '9px 11px',
                  borderRadius: '9999px',
                  background: isActive('/profile') ? 'hsl(var(--primary))' : 'transparent',
                  color: isActive('/profile') ? 'white' : 'rgba(0,0,0,0.38)',
                  transition: 'all 0.28s cubic-bezier(0.34,1.56,0.64,1)',
                }}>
                  <User style={{ width: '18px', height: '18px', flexShrink: 0 }} />
                  {isActive('/profile') && <span style={{ fontSize: '13px', fontWeight: 600, whiteSpace: 'nowrap' }}>Profile</span>}
                </div>
              </Link>

              {isAgent && (
                <Link to="/agent" data-testid="mobile-nav-agent" style={{ textDecoration: 'none' }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: isActive('/agent') ? '6px' : '0',
                    padding: isActive('/agent') ? '8px 14px' : '9px 11px',
                    borderRadius: '9999px',
                    background: isActive('/agent') ? 'hsl(var(--primary))' : 'transparent',
                    color: isActive('/agent') ? 'white' : 'rgba(0,0,0,0.38)',
                    transition: 'all 0.28s cubic-bezier(0.34,1.56,0.64,1)',
                  }}>
                    <Building2 style={{ width: '18px', height: '18px', flexShrink: 0 }} />
                    {isActive('/agent') && <span style={{ fontSize: '13px', fontWeight: 600, whiteSpace: 'nowrap' }}>Agent</span>}
                  </div>
                </Link>
              )}

              {isAdmin && (
                <Link to="/admin" data-testid="mobile-nav-admin" style={{ textDecoration: 'none' }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: isActive('/admin') ? '6px' : '0',
                    padding: isActive('/admin') ? '8px 14px' : '9px 11px',
                    borderRadius: '9999px',
                    background: isActive('/admin') ? 'hsl(var(--primary))' : 'transparent',
                    color: isActive('/admin') ? 'white' : 'rgba(0,0,0,0.38)',
                    transition: 'all 0.28s cubic-bezier(0.34,1.56,0.64,1)',
                  }}>
                    <Shield style={{ width: '18px', height: '18px', flexShrink: 0 }} />
                    {isActive('/admin') && <span style={{ fontSize: '13px', fontWeight: 600, whiteSpace: 'nowrap' }}>Admin</span>}
                  </div>
                </Link>
              )}

              <Link to="/buy-tokens" data-testid="mobile-nav-tokens" style={{ textDecoration: 'none' }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: isActive('/buy-tokens') ? '6px' : '0',
                  padding: isActive('/buy-tokens') ? '8px 14px' : '9px 11px',
                  borderRadius: '9999px',
                  background: isActive('/buy-tokens') ? 'hsl(var(--primary))' : 'transparent',
                  color: isActive('/buy-tokens') ? 'white' : 'rgba(0,0,0,0.38)',
                  transition: 'all 0.28s cubic-bezier(0.34,1.56,0.64,1)',
                }}>
                  <Coins style={{ width: '18px', height: '18px', flexShrink: 0 }} />
                  {isActive('/buy-tokens') && <span style={{ fontSize: '13px', fontWeight: 600, whiteSpace: 'nowrap' }}>Tokens</span>}
                </div>
              </Link>
            </>
          ) : (
            <>
              <Link to="/login" data-testid="mobile-nav-login" style={{ textDecoration: 'none' }}>
                <div style={{
                  display: 'flex', alignItems: 'center',
                  padding: '9px 11px', borderRadius: '9999px',
                  color: 'rgba(0,0,0,0.38)',
                  transition: 'all 0.28s cubic-bezier(0.34,1.56,0.64,1)',
                }}>
                  <User style={{ width: '18px', height: '18px' }} />
                </div>
              </Link>
              <Link to="/register" data-testid="mobile-nav-register" style={{ textDecoration: 'none' }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '8px 14px', borderRadius: '9999px',
                  background: 'hsl(var(--primary))', color: 'white',
                  transition: 'all 0.28s cubic-bezier(0.34,1.56,0.64,1)',
                }}>
                  <Plus style={{ width: '18px', height: '18px' }} />
                  <span style={{ fontSize: '13px', fontWeight: 600, whiteSpace: 'nowrap' }}>Sign Up</span>
                </div>
              </Link>
            </>
          )}
        </div>
      </nav>

      {/* Desktop footer */}
      <footer className="hidden md:block border-t bg-muted/30 mt-auto">
        <div className="container mx-auto px-6 py-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <img src="/rentora-logo.png" alt="Rentora" className="h-8 w-auto" />
              <div>
                <p className="font-bold text-sm">Rentora</p>
                <p className="text-xs text-muted-foreground">Student Housing Platform, Ogbomosho</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-xs text-muted-foreground">
              <Link to="/terms" className="hover:text-primary transition-colors">Terms & Conditions</Link>
              <Link to="/terms" className="hover:text-primary transition-colors">Privacy Policy</Link>
              <Link to="/terms" className="hover:text-primary transition-colors">Refund Policy</Link>
              <Link to="/contact" className="hover:text-primary transition-colors">Contact Us</Link>
            </div>
            <p className="text-xs text-muted-foreground">
              © {new Date().getFullYear()} Rentora. All rights reserved.
            </p>
          </div>
        </div>
      </footer>

      {/* Mobile footer — above bottom nav (pb-28 gives space for the pill nav) */}
      <footer className="md:hidden border-t bg-muted/30 pb-28">
        <div className="px-6 py-5">
          {/* Brand */}
          <div className="flex items-center gap-2 mb-4">
            <img src="/rentora-logo.png" alt="Rentora" className="h-7 w-auto" />
            <div>
              <p className="font-bold text-xs">Rentora</p>
              <p className="text-[10px] text-muted-foreground">Student Housing, Ogbomosho</p>
            </div>
          </div>

          {/* Links grid */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 mb-4">
            <Link to="/terms" className="text-xs text-muted-foreground hover:text-primary transition-colors">
              Terms & Conditions
            </Link>
            <Link to="/terms" className="text-xs text-muted-foreground hover:text-primary transition-colors">
              Privacy Policy
            </Link>
            <Link to="/terms" className="text-xs text-muted-foreground hover:text-primary transition-colors">
              Refund Policy
            </Link>
            <Link to="/contact" className="text-xs text-muted-foreground hover:text-primary transition-colors">
              Contact Us
            </Link>
          </div>

          <p className="text-[10px] text-muted-foreground">
            © {new Date().getFullYear()} Rentora. All rights reserved.
          </p>
        </div>
      </footer>

      {/* Consent Banner */}
      <ConsentBanner />
    </div>
  );
}

export default Layout;
