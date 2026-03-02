import { Link } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import {
  Search, Shield, Coins, Calendar, ArrowRight,
  Building2, Users, CheckCircle2, MessageSquare
} from 'lucide-react';

export function Home() {
  const { isAuthenticated } = useAuth();

  const features = [
    { icon: Shield, title: 'Verified Properties', description: 'All listings are reviewed and approved by our admin team for quality assurance.' },
    { icon: Coins, title: 'Token System', description: 'Buy tokens to unlock owner contacts. ₦1,000 per token, simple and transparent.' },
    { icon: Calendar, title: 'Request Inspections', description: 'Schedule property visits with our verified agents for just ₦2,000.' },
    { icon: Users, title: 'Trusted Agents', description: 'Our agents are ID-verified and accountable for the properties they list.' },
  ];

  const stats = [
    { value: '500+', label: 'Properties Listed' },
    { value: '1,000+', label: 'Happy Students' },
    { value: '50+', label: 'Verified Agents' },
    { value: '24/7', label: 'Support Available' },
  ];

  return (
    <div className="min-h-screen" data-testid="home-page">

      {/* ── Hero ─────────────────────────────────────── */}
      <section className="relative h-[580px] md:h-[640px] flex items-center overflow-hidden">
        {/* Background image */}
        <img
          src="https://images.pexels.com/photos/3754595/pexels-photo-3754595.jpeg"
          alt=""
          className="absolute inset-0 w-full h-full object-cover object-center"
        />
        {/* Solid dark overlay — no fade to white */}
        <div className="absolute inset-0 bg-slate-900/70" />

        {/* Bottom hard edge so stats section starts cleanly */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-900/70" />

        <div className="relative z-10 container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center space-y-6">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 border border-white/20 text-sm font-medium backdrop-blur-sm">
              <Building2 className="w-4 h-4 text-primary" />
              <span className="text-white/90">Student Housing Made Easy</span>
            </div>

            {/* Headline */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-white drop-shadow-lg">
              Find Your Perfect
              <span className="text-primary block mt-2">Student Accommodation</span>
            </h1>

            {/* Subheadline */}
            <p className="text-lg md:text-xl text-white/75 max-w-2xl mx-auto">
              Verified hostels and apartments near LAUTECH, Ogbomosho.
              Browse, unlock contacts, and schedule inspections — all in one place.
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
              <Link to="/browse">
                <Button size="lg" className="gap-2 px-8 shadow-lg active:scale-95 transition-transform" data-testid="browse-btn">
                  <Search className="w-5 h-5" />
                  Browse Properties
                </Button>
              </Link>
              {!isAuthenticated && (
                <Link to="/register">
                  <Button size="lg" variant="outline" className="gap-2 px-8 bg-white/10 border-white/30 text-white hover:bg-white/20 active:scale-95 transition-transform backdrop-blur-sm" data-testid="get-started-btn">
                    Get Started
                    <ArrowRight className="w-5 h-5" />
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats ────────────────────────────────────── */}
      <section className="py-14 bg-white border-b border-border/60 shadow-sm">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {stats.map((stat, index) => (
              <div key={stat.label} className="text-center" style={{ animationDelay: `${index * 100}ms` }}>
                <p className="text-3xl md:text-4xl font-bold text-primary">{stat.value}</p>
                <p className="text-sm font-medium text-foreground/60 mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ─────────────────────────────────── */}
      <section className="py-16 md:py-24 bg-background">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">
              Why Choose Rentora?
            </h2>
            <p className="text-foreground/60 mt-3 max-w-2xl mx-auto text-base">
              We've built a platform designed specifically for students near LAUTECH,
              with features that make finding accommodation safe and easy.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, index) => (
              <Card
                key={feature.title}
                className="p-6 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 border border-border/60 bg-white"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                  <feature.icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-semibold text-lg mb-2 text-foreground">{feature.title}</h3>
                <p className="text-sm text-foreground/60 leading-relaxed">{feature.description}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ── How It Works ─────────────────────────────── */}
      <section className="py-16 md:py-24 bg-slate-50 border-y border-border/40">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">
              How It Works
            </h2>
            <p className="text-foreground/60 mt-3 text-base">
              Finding your perfect accommodation in 3 simple steps
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {[
              { step: '01', title: 'Browse', desc: 'Explore verified properties with filters for price and type' },
              { step: '02', title: 'Unlock', desc: 'Buy tokens and unlock owner contacts for properties you like' },
              { step: '03', title: 'Inspect', desc: 'Schedule a physical inspection with our verified agents' },
            ].map((item, index) => (
              <div key={item.step} className="relative text-center group">
                <div className="w-20 h-20 rounded-2xl bg-primary flex items-center justify-center mx-auto mb-5 shadow-md group-hover:scale-105 transition-transform">
                  <span className="text-2xl font-bold text-white">{item.step}</span>
                </div>
                <h3 className="text-xl font-semibold mb-2 text-foreground">{item.title}</h3>
                <p className="text-sm text-foreground/60 leading-relaxed">{item.desc}</p>
                {index < 2 && (
                  <div className="hidden md:block absolute top-10 -right-4 text-primary/40 text-2xl">→</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────── */}
      <section className="py-16 md:py-24 bg-background">
        <div className="container mx-auto px-4">
          <Card className="relative overflow-hidden bg-primary text-white p-8 md:p-12 border-0 shadow-xl">
            <div className="relative z-10 max-w-2xl">
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white">
                Ready to Find Your New Home?
              </h2>
              <p className="mt-4 text-white/80 text-base leading-relaxed">
                Join thousands of students who have found their perfect accommodation through our platform.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 mt-8">
                <Link to="/browse">
                  <Button size="lg" className="gap-2 bg-white text-primary hover:bg-white/90 font-semibold shadow active:scale-95 transition-transform" data-testid="cta-browse">
                    <Search className="w-5 h-5" />
                    Start Browsing
                  </Button>
                </Link>
                {!isAuthenticated && (
                  <Link to="/register">
                    <Button size="lg" variant="outline" className="gap-2 bg-transparent border-white/40 text-white hover:bg-white/10 active:scale-95 transition-transform" data-testid="cta-register">
                      Create Account
                    </Button>
                  </Link>
                )}
              </div>
            </div>
            {/* Decorative circles */}
            <div className="absolute top-0 right-0 w-72 h-72 bg-white/5 rounded-full -translate-y-1/3 translate-x-1/3" />
            <div className="absolute bottom-0 right-1/4 w-40 h-40 bg-white/5 rounded-full translate-y-1/2" />
            <div className="absolute top-1/2 right-8 w-20 h-20 bg-white/5 rounded-full -translate-y-1/2" />
          </Card>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────── */}
      <footer className="py-8 border-t bg-slate-50">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                <Building2 className="w-5 h-5 text-white" />
              </div>
              <span className="font-bold text-foreground">Rentora</span>
            </div>
            <div className="flex items-center gap-6 text-sm text-foreground/50">
              <Link to="/contact" className="hover:text-foreground transition-colors">Contact Us</Link>
              <Link to="/browse" className="hover:text-foreground transition-colors">Browse</Link>
              {!isAuthenticated && <Link to="/register" className="hover:text-foreground transition-colors">Register</Link>}
            </div>
            <p className="text-sm text-foreground/50">
              © {new Date().getFullYear()} Rentora. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default Home;
