import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Dialog, DialogContent } from '../components/ui/dialog';
import {
  Search, Shield, Coins, Calendar, ArrowRight,
  Building2, Users, CheckCircle2, MessageSquare,
  ChevronRight as ChevronRightIcon
} from 'lucide-react';

import { AppBanner } from '../components/AppBanner';

import { AppBanner } from '../components/AppBanner';

export function Home() {
  const { isAuthenticated } = useAuth();
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
      desc: 'Pay ₦3,000 to schedule a physical visit. Our verified agent will accompany you to inspect the property in person.',
      color: 'bg-green-500',
    },
    {
      icon: Shield,
      title: "You're Protected",
      desc: "Every agent on Rentora is ID-verified. If anything goes wrong, our support team is available 24/7.",
      color: 'bg-primary',
    },
  ];

  const features = [
    { icon: Shield, title: 'Verified Properties', description: 'All listings are reviewed and approved by our admin team for quality assurance.' },
    { icon: Coins, title: 'Token System', description: 'Buy tokens to unlock owner contacts. ₦1,000 per token, simple and transparent.' },
    { icon: Calendar, title: 'Request Inspections', description: 'Schedule property visits with our verified agents for just ₦3,000.' },
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
        {/* Background image */}
        <img
          src="https://images.pexels.com/photos/3754595/pexels-photo-3754595.jpeg"
          alt="Student accommodation near LAUTECH Ogbomosho"
          className="absolute inset-0 w-full h-full object-cover object-center"
        />
        {/* Solid dark overlay */}
        <div className="absolute inset-0 bg-slate-900/70" />

        {/* Bottom hard edge */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-900/70" />

        <div className="relative z-10 container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center space-y-6">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 border border-white/20 text-sm font-medium backdrop-blur-sm">
              <Building2 className="w-4 h-4 text-primary" />
              <span className="text-white/90">Student Housing Made Easy</span>
            </div>

            {/* H1 — primary keywords */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-white drop-shadow-lg">
              Verified Hostels &amp; Rooms
              <span className="text-primary block mt-2">Near LAUTECH, Ogbomosho</span>
            </h1>

            {/* Subheadline — secondary keywords */}
            <p className="text-lg md:text-xl text-white/75 max-w-2xl mx-auto">
              Ogbomosho's #1 student housing platform. Find cheap hostels, self-contains, bedsitters and mini flats near LAUTECH — unlock agent contacts &amp; book inspections online.
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

      {/* ── CTA ──────────────────────────────────────── */}
      <section className="py-16 md:py-24 bg-background">
        <div className="container mx-auto px-4">
          <Card className="relative overflow-hidden bg-primary text-white p-8 md:p-12 border-0 shadow-xl">
            <div className="relative z-10 max-w-2xl">
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white">
                Ready to Find Student Housing in Ogbomosho?
              </h2>
              <p className="mt-4 text-white/80 text-base leading-relaxed">
                Join LAUTECH students who found their hostel, self-contain or apartment on Rentora — verified listings, trusted agents, easy inspections.
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

      {/* ── Onboarding Modal ─────────────────────────── */}
      <Dialog open={showOnboarding} onOpenChange={() => {}}>
        <DialogContent className="w-[calc(100vw-32px)] max-w-sm mx-auto rounded-2xl p-0 overflow-hidden gap-0 [&>button]:hidden">
          {/* Progress dots */}
          <div className="flex gap-1.5 justify-center pt-5 pb-1">
            {onboardingSteps.map((_, i) => (
              <div key={i} className={`h-1.5 rounded-full transition-all duration-300 ${i === onboardingStep ? 'w-6 bg-primary' : 'w-1.5 bg-muted-foreground/20'}`} />
            ))}
          </div>

          {/* Step content */}
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

          {/* Actions */}
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

      {/* ── Download App Section ────────────────────── */}
      <section className="py-12 bg-slate-50 border-y border-border/40">
        <div className="container mx-auto px-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6 max-w-3xl mx-auto">
            <div className="flex items-center gap-4">
              <img src="/launchericon-192x192.png" alt="Rentora App" className="w-16 h-16 rounded-2xl shadow-md" />
              <div>
                <h3 className="font-bold text-lg">Download the Rentora App</h3>
                <p className="text-sm text-foreground/60 mt-0.5">Fast, easy access to student housing near LAUTECH</p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 shrink-0">
              <a href="/rentora.apk" download="Rentora.apk"
                className="flex items-center gap-2.5 bg-black text-white px-4 py-2.5 rounded-xl hover:bg-black/80 transition-colors">
                <svg viewBox="0 0 24 24" className="w-6 h-6 fill-white shrink-0"><path d="M3.18 23.76c.3.17.64.24.99.2l12.6-11.96L13.5 8.74 3.18 23.76zm16.7-10.8L16.7 11.1l-3.5 3.33 3.5 3.32 3.2-1.88c.9-.53.9-1.4-.02-1.91zM2.3.32C2.1.55 2 .9 2 1.34v21.3c0 .44.1.78.31 1.01l.06.06 11.93-11.93v-.28L2.36.26 2.3.32zm10.8 11.07L2.3.32l-.01-.06L13.5 8.74l-.4 2.65z"/></svg>
                <div><p className="text-[10px] text-white/70 leading-none">Download for</p><p className="text-sm font-semibold leading-tight">Android (APK)</p></div>
              </a>
              <div className="flex items-center gap-2.5 bg-black/50 text-white px-4 py-2.5 rounded-xl cursor-not-allowed opacity-60">
                <svg viewBox="0 0 24 24" className="w-6 h-6 fill-white shrink-0"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>
                <div><p className="text-[10px] text-white/70 leading-none">Coming soon on</p><p className="text-sm font-semibold leading-tight">App Store</p></div>
              </div>
            </div>
          </div>
        </div>
      </section>

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
                  Earn <strong>₦2,100</strong> per completed inspection. Work flexible hours, help students find housing, and grow your income — all verified through our platform.
                </p>
                <ul className="mt-4 space-y-1.5">
                  {['₦2,100 paid per inspection you complete','Flexible — work at your own pace','ID-verified badge builds trust with renters','Withdraw earnings directly to your bank account'].map(item => (
                    <li key={item} className="flex items-center gap-2 text-sm text-white/80">
                      <CheckCircle2 className="w-4 h-4 text-white shrink-0" />{item}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="shrink-0 flex flex-col gap-3">
                <Link to="/become-agent">
                  <Button size="lg" className="gap-2 bg-white text-primary hover:bg-white/90 font-semibold shadow active:scale-95 transition-transform">
                    Apply to Become an Agent <ArrowRight className="w-5 h-5" />
                  </Button>
                </Link>
                <p className="text-xs text-white/50 text-center">Free to join · No monthly fees</p>
              </div>
            </div>
            <div className="absolute top-0 right-0 w-72 h-72 bg-white/5 rounded-full -translate-y-1/3 translate-x-1/3" />
            <div className="absolute bottom-0 right-1/4 w-40 h-40 bg-white/5 rounded-full translate-y-1/2" />
            <div className="absolute top-1/2 right-8 w-20 h-20 bg-white/5 rounded-full -translate-y-1/2" />
          </Card>
        </div>
      </section>

      {/* App install banner — shows on mobile */}
      <AppBanner />
    </div>
  );
}

export default Home;
