import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Dialog, DialogContent } from '../components/ui/dialog';
import {
  Search, Shield, Coins, Calendar, ArrowRight, Lock,
  Building2, Users, CheckCircle2, MessageSquare, Home as HomeIcon, Building,
  ChevronRight as ChevronRightIcon, ShoppingBag, Sparkles
} from 'lucide-react';

import { AppBanner } from '../components/AppBanner';

export function Home() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(0);

  useEffect(() => {
    const seen = localStorage.getItem('rentora_onboarding_seen');
    if (!seen) {
      const t = setTimeout(() => setShowOnboarding(true), 800);
      return () => clearTimeout(t);
    }
  }, []);

  const dismissOnboarding = () => {
    localStorage.setItem('rentora_onboarding_seen', 'true');
    localStorage.setItem('rentora_onboarding_done', 'true');
    setShowOnboarding(false);
    setOnboardingStep(0);
  };

  const onboardingSteps = [
    {
      icon: Search,
      title: 'Browse Verified Properties',
      desc: 'All listings on Rentora are reviewed and approved. Filter by price, type, and location to find your perfect match.',
      color: 'bg-blue-500',
    },
    {
      icon: Coins,
      title: 'Unlock Owner Contacts',
      desc: 'Buy tokens (₦1,000 each) to unlock the phone number of any property owner. One token, one contact — no hidden fees.',
      color: 'bg-yellow-500',
    },
    {
      icon: Calendar,
      title: 'Book an Inspection',
      desc: 'Pay a small inspection fee (from ₦1,000, set by the agent) to schedule a physical visit. Our verified agent will accompany you to inspect the property in person.',
      color: 'bg-green-500',
    },
    {
      icon: Shield,
      title: "You're Protected",
      desc: "Every agent on Rentora is ID-verified, and your rent stays held in escrow until you confirm you've moved in — never paid to the agent upfront. Support is available if anything goes wrong.",
      color: 'bg-primary',
    },
  ];

  const features = [
    { icon: Shield, title: 'Verified Properties', description: 'All listings are reviewed and approved by our admin team for quality assurance.' },
    { icon: Lock, title: 'Rent Held in Escrow', description: 'Your rent stays safely held with Rentora until you confirm you\'ve moved in — never paid to the agent upfront.' },
    { icon: Calendar, title: 'Request Inspections', description: 'Schedule property visits with our verified agents from just ₦1,000, set per listing.' },
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
      <section className="relative h-[580px] md:h-[640px] flex items-center overflow-hidden" aria-label="Find student hostels and accommodation near LAUTECH Ogbomosho">
        <img
          src="https://images.pexels.com/photos/3754595/pexels-photo-3754595.jpeg"
          alt="Student accommodation near LAUTECH Ogbomosho"
          className="absolute inset-0 w-full h-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-slate-900/70" />
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-900/70" />

        <div className="relative z-10 container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center space-y-6">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 border border-white/20 text-sm font-medium backdrop-blur-sm">
              <Building2 className="w-4 h-4 text-primary" />
              <span className="text-white/90">Student Housing Made Easy</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-white drop-shadow-lg">
              Verified Hostels &amp; Rooms
              <span className="text-primary block mt-2">Near LAUTECH, Ogbomosho</span>
            </h1>

            <p className="text-lg md:text-xl text-white/75 max-w-2xl mx-auto">
              Ogbomosho's #1 student housing platform. Find cheap hostels, self-contains, bedsitters and mini flats near LAUTECH — unlock agent contacts &amp; book inspections online.
            </p>

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

      {/* ── Browse by Property Type ──────────────────── */}
      <section className="py-14 bg-background border-b border-border/40" aria-label="Browse student housing by property type">
        <div className="container mx-auto px-4">
          <div className="text-center mb-8">
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Browse by Property Type</h2>
            <p className="text-muted-foreground mt-2">Pick what you're looking for to jump straight to it</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl mx-auto">
            <button
              onClick={() => navigate('/browse?property_type=hostel')}
              className="group flex items-center gap-4 p-5 rounded-xl border border-border/60 bg-card hover:border-primary hover:shadow-md transition-all text-left"
            >
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                <HomeIcon className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="font-semibold">Hostels</p>
                <p className="text-xs text-muted-foreground">Shared student housing</p>
              </div>
            </button>
            <button
              onClick={() => navigate('/browse?property_type=apartment')}
              className="group flex items-center gap-4 p-5 rounded-xl border border-border/60 bg-card hover:border-primary hover:shadow-md transition-all text-left"
            >
              <div className="w-12 h-12 rounded-full bg-secondary/10 flex items-center justify-center shrink-0 group-hover:bg-secondary/20 transition-colors">
                <Building className="w-6 h-6 text-secondary" />
              </div>
              <div>
                <p className="font-semibold">Apartments</p>
                <p className="text-xs text-muted-foreground">Self-contained units</p>
              </div>
            </button>
            <button
              onClick={() => navigate('/browse')}
              className="group flex items-center gap-4 p-5 rounded-xl border border-border/60 bg-card hover:border-primary hover:shadow-md transition-all text-left"
            >
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center shrink-0 group-hover:bg-muted/70 transition-colors">
                <Search className="w-6 h-6 text-foreground/70" />
              </div>
              <div>
                <p className="font-semibold">All Listings</p>
                <p className="text-xs text-muted-foreground">See everything available</p>
              </div>
            </button>
          </div>
        </div>
      </section>

      {/* ── Features ─────────────────────────────────── */}
      <section className="py-16 md:py-24 bg-background" aria-label="Why choose Rentora for student accommodation Ogbomosho">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">
              Why LAUTECH Students Choose Rentora
            </h2>
            <p className="text-foreground/60 mt-3 max-w-2xl mx-auto text-base">
              Built for students in Ogbomosho — find affordable, verified student accommodation near LAUTECH quickly and safely.
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
      <section className="py-16 md:py-24 bg-slate-50 border-y border-border/40" aria-label="How to rent student accommodation near LAUTECH">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">
              How to Rent a Hostel Near LAUTECH
            </h2>
            <p className="text-foreground/60 mt-3 text-base">
              Find student housing in Ogbomosho in 3 simple steps
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {[
              { step: '01', title: 'Browse', desc: 'Explore verified hostels and apartments near LAUTECH with filters for price and type' },
              { step: '02', title: 'Unlock', desc: 'Buy tokens and unlock the agent\'s contact for any hostel or room you like' },
              { step: '03', title: 'Inspect', desc: 'Schedule a physical inspection with our verified Ogbomosho agents' },
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

      {/* ── Onboarding Modal ─────────────────────────── */}
      <Dialog open={showOnboarding} onOpenChange={() => {}}>
        <DialogContent className="w-[calc(100vw-32px)] max-w-sm mx-auto rounded-2xl p-0 overflow-hidden gap-0 [&>button]:hidden z-[99999]">
          <div className="flex gap-1.5 justify-center pt-5 pb-1">
            {onboardingSteps.map((_, i) => (
              <div key={i} className={`h-1.5 rounded-full transition-all duration-300 ${i === onboardingStep ? 'w-6 bg-primary' : 'w-1.5 bg-muted-foreground/20'}`} />
            ))}
          </div>

          <div className="px-6 py-5 text-center min-h-[200px] flex flex-col items-center justify-center">
            {(() => {
              const step = onboardingSteps[onboardingStep];
              const Icon = step.icon;
              return (
                <>
                  <div className={`w-16 h-16 rounded-2xl ${step.color} flex items-center justify-center mb-4 shadow-lg`}>
                    <Icon className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-lg font-bold mb-2">{step.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{step.desc}</p>
                </>
              );
            })()}
          </div>

          <div className="flex gap-2 px-6 pb-6">
            <button
              onClick={dismissOnboarding}
              className="flex-1 text-sm text-muted-foreground hover:text-foreground transition-colors py-2"
            >
              {onboardingStep === onboardingSteps.length - 1 ? 'Done' : 'Skip'}
            </button>
            {onboardingStep < onboardingSteps.length - 1 ? (
              <Button className="flex-1 gap-1" onClick={() => setOnboardingStep(s => s + 1)}>
                Next <ChevronRightIcon className="w-4 h-4" />
              </Button>
            ) : (
              <Button className="flex-1" onClick={dismissOnboarding}>
                Get Started 🎉
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Become an Agent CTA ──────────────────────── */}
      <section className="py-16 md:py-24 bg-background">
        <div className="container mx-auto px-4">
          <Card className="relative overflow-hidden bg-primary text-white p-8 md:p-12 border-0 shadow-xl">
            <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
              <div className="max-w-xl">
                <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white">
                  Want to Become a Rentora Agent?
                </h2>
                <p className="mt-4 text-white/80 text-base leading-relaxed">
                  Keep <strong>100% of every inspection fee</strong> you set, plus your full rent commission when a tenant moves in. Work flexible hours and grow your income.
                </p>
                <ul className="mt-4 space-y-1.5">
                  {['Keep 100% of your inspection fee', 'Earn your full rent + agent fee via secure escrow', 'Flexible hours', 'ID-verified badge', 'Direct bank withdrawals'].map(item => (
                    <li key={item} className="flex items-center gap-2 text-sm text-white/80">
                      <CheckCircle2 className="w-4 h-4 text-white shrink-0" />{item}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="shrink-0">
                <Link to="/become-agent">
                  <Button size="lg" className="bg-white text-primary hover:bg-white/90 font-semibold shadow active:scale-95 transition-transform">
                    Apply Now <ArrowRight className="w-5 h-5" />
                  </Button>
                </Link>
              </div>
            </div>
          </Card>
        </div>
      </section>

            {/* ── Updated: Ogbomosho Marketplace Promo Banner ──── */}
      <section className="py-12 bg-background">
        <div className="container mx-auto px-4">
          <div 
            className="relative overflow-hidden rounded-[2.5rem] p-8 md:p-16 shadow-2xl group border border-white/10"
            style={{
              backgroundImage: `linear-gradient(135deg, rgba(26, 32, 25, 0.85) 0%, rgba(45, 90, 39, 0.7) 50%, rgba(26, 32, 25, 0.6) 100%), url('https://images.unsplash.com/photo-1585540083814-ea6ee8af9e4f?w=1600&h=900&fit=crop')`,
              backgroundSize: 'cover',
              backgroundPosition: 'center'
            }}
          >
            <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
              <div className="flex flex-col md:flex-row items-center gap-8 text-center md:text-left">
                <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-3xl bg-white/10 backdrop-blur-xl border border-white/20 shadow-2xl transition-transform group-hover:scale-110 duration-500">
                  <ShoppingBag className="h-10 w-10 text-white" />
                </div>
                <div>
                  <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-yellow-400 text-black text-[11px] font-black uppercase tracking-[0.1em] mb-4 shadow-lg animate-bounce">
                    <Sparkles className="w-3.5 h-3.5" />
                    Coming Soon
                  </div>
                  <h2 className="text-3xl md:text-5xl font-black text-white leading-tight tracking-tight">
                    The Ogbomosho Student <br className="hidden md:block" /> Marketplace
                  </h2>
                  <p className="mt-4 text-white/90 text-lg md:text-xl max-w-2xl font-medium leading-relaxed">
                    Buy and sell anything within the LAUTECH community. From used textbooks to electronics—safe, local, and student-only.
                  </p>
                </div>
              </div>

              <div className="shrink-0 w-full md:w-auto">
                <Link   to="https://ogbomoshomarket.vercel.app/" target="_blank" rel="noopener noreferrer">
                  <Button size="lg" className="w-full md:w-auto bg-white text-emerald-900 hover:bg-slate-50 font-black px-12 h-16 rounded-2xl shadow-2xl hover:scale-105 transition-all group border-0 text-lg">
                    Explore Marketplace
                    <ArrowRight className="ml-2 w-6 h-6 group-hover:translate-x-2 transition-transform" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <AppBanner />
    </div>
  );
}

export default Home;