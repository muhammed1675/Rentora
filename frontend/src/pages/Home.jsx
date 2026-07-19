import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Dialog, DialogContent } from '../components/ui/dialog';
import {
  Search, Shield, Coins, Calendar, ArrowRight, ArrowUpRight, Lock,
  Building2, Users, CheckCircle2, Home as HomeIcon, Building, MapPin,
  ChevronRight as ChevronRightIcon, ShoppingBag, Sparkles, Phone, KeyRound, HandshakeIcon
} from 'lucide-react';

import { AppBanner } from '../components/AppBanner';

/* ────────────────────────────────────────────────────────────
   Rentora — hand-crafted redesign inspired by a logistics
   landing page (numbered rows, marquee ribbon, big blue CTA,
   dotted "How We Work", testimonial photo cards on blue).
   Content = Rentora (verified student housing near LAUTECH).
────────────────────────────────────────────────────────────── */

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
    { icon: Search,   title: 'Browse Verified Properties', desc: 'All listings on Rentora are reviewed and approved. Filter by price, type, and location to find your perfect match.', color: 'bg-blue-500' },
    { icon: Coins,    title: 'Unlock Owner Contacts',      desc: 'Buy tokens (₦1,000 each) to unlock the phone number of any property owner. One token, one contact — no hidden fees.', color: 'bg-yellow-500' },
    { icon: Calendar, title: 'Book an Inspection',         desc: 'Pay a small inspection fee (from ₦1,000, set by the agent) to schedule a physical visit with a verified agent.', color: 'bg-green-500' },
    { icon: Shield,   title: "You're Protected",           desc: 'Agents are ID-verified and your rent is held in escrow until you confirm you have moved in.', color: 'bg-primary' },
  ];

  const propertyKinds = [
    { n: '01', title: 'Hostels',      blurb: 'Shared student rooms right at LAUTECH gates.',  q: 'hostel' },
    { n: '02', title: 'Self-Contains', blurb: 'Private single rooms with your own bathroom.',  q: 'self-contain' },
    { n: '03', title: 'Mini Flats',    blurb: 'One or two-bedroom flats for couples and pros.', q: 'apartment' },
  ];

  const workflow = [
    { n: '01', title: 'Search a Listing', desc: 'Filter by budget, area and property type. Every listing is admin-reviewed.' },
    { n: '02', title: 'Unlock the Agent', desc: 'One ₦1,000 token unlocks the verified agent contact for that property.' },
    { n: '03', title: 'Book Inspection',  desc: 'Pick a slot, pay the small inspection fee, and meet the agent on site.' },
    { n: '04', title: 'Rent in Escrow',   desc: 'Your rent is held by Rentora — the agent never gets it upfront.' },
    { n: '05', title: 'Move In Safely',   desc: 'Confirm move-in, funds release. Support has your back if anything is off.' },
  ];

  const news = [
    { date: 'Published on 05 Nov 2026', title: 'How Rentora is cleaning up the LAUTECH housing market', img: 'https://images.pexels.com/photos/1571460/pexels-photo-1571460.jpeg?auto=compress&cs=tinysrgb&w=800' },
    { date: 'Published on 18 Oct 2026', title: 'A student’s guide to renting your first self-contain in Ogbomosho', img: 'https://images.pexels.com/photos/2029670/pexels-photo-2029670.jpeg?auto=compress&cs=tinysrgb&w=800' },
    { date: 'Published on 02 Oct 2026', title: 'Why escrow rent is the safest way to move in this session', img: 'https://images.pexels.com/photos/439391/pexels-photo-439391.jpeg?auto=compress&cs=tinysrgb&w=800' },
  ];

  const people = [
    { name: 'Aisha O.',   role: 'LAUTECH student, 300L', img: 'https://images.pexels.com/photos/1181690/pexels-photo-1181690.jpeg?auto=compress&cs=tinysrgb&w=600' },
    { name: 'Tunde A.',   role: 'Verified Rentora agent', img: 'https://images.pexels.com/photos/2379004/pexels-photo-2379004.jpeg?auto=compress&cs=tinysrgb&w=600' },
    { name: 'Chiamaka E.', role: 'Fresher, moved in 2026', img: 'https://images.pexels.com/photos/1181519/pexels-photo-1181519.jpeg?auto=compress&cs=tinysrgb&w=600' },
  ];

  const ribbonWords = ['Rentora', 'Verified', 'Escrow', 'LAUTECH', 'Inspection', 'Hostels', 'Self-Contain', 'Mini Flat'];

  return (
    <div className="min-h-screen bg-background" data-testid="home-page">

      {/* ═══ HERO ═════════════════════════════════════════════ */}
      <section className="pt-6 md:pt-8 px-4">
        <div className="container mx-auto">
          <div className="hero-rounded relative h-[520px] md:h-[620px]">
            <img
              src="https://images.pexels.com/photos/1571460/pexels-photo-1571460.jpeg?auto=compress&cs=tinysrgb&w=1600"
              alt="Student accommodation near LAUTECH Ogbomosho"
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-slate-900/85 via-slate-900/45 to-transparent" />

            <div className="relative z-10 h-full flex items-end md:items-center">
              <div className="p-6 md:p-14 max-w-xl">
                <span className="chip bg-white/15 text-white border border-white/25 backdrop-blur-md">
                  <Building2 className="w-3.5 h-3.5" /> Student Housing, Ogbomosho
                </span>

                <h1 className="mt-5 text-white font-display font-black text-5xl md:text-7xl leading-[0.95]">
                  RENTORA
                </h1>
                <p className="mt-2 text-white/90 text-lg md:text-xl font-medium">
                  Verified Rooms. Escrowed Rent. Zero Wahala.
                </p>
                <p className="mt-4 text-white/70 text-sm md:text-base max-w-md leading-relaxed">
                  Ogbomosho’s #1 student housing platform. Unlock agent contacts,
                  book inspections and pay through secure escrow — all in one place.
                </p>

                {/* Booking widget — mirrors "Track My Shipment" */}
                <div className="mt-7 bg-white rounded-2xl p-3 shadow-2xl flex items-center gap-2 max-w-md">
                  <div className="pl-3 pr-1 text-muted-foreground">
                    <Search className="w-5 h-5" />
                  </div>
                  <input
                    type="text"
                    placeholder="Area, budget or property type…"
                    className="flex-1 bg-transparent outline-none text-sm text-foreground placeholder:text-muted-foreground py-2"
                    onKeyDown={(e) => e.key === 'Enter' && navigate('/browse')}
                  />
                  <Button size="sm" className="rounded-xl px-4 h-11 gap-1" onClick={() => navigate('/browse')}>
                    Find Room <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ NUMBERED PROPERTY TYPES + SIDE COPY ══════════════ */}
      <section className="py-16 md:py-24 px-4">
        <div className="container mx-auto grid md:grid-cols-2 gap-12 md:gap-16 items-start">
          <div className="bg-white rounded-3xl border border-border/60 overflow-hidden">
            {propertyKinds.map((k) => (
              <button
                key={k.n}
                onClick={() => navigate(`/browse?property_type=${k.q}`)}
                className="numbered-row w-full text-left"
              >
                <span className="num">{k.n}</span>
                <span>
                  <span className="title block">By {k.title}</span>
                  <span className="text-sm text-muted-foreground">{k.blurb}</span>
                </span>
                <span className="arrow"><ArrowUpRight className="w-5 h-5" /></span>
              </button>
            ))}
          </div>

          <div className="md:pt-8">
            <h2 className="font-display font-bold text-3xl md:text-4xl leading-tight">
              Housing Solutions <br /> For Students Who Are <br /> Tired Of Getting Scammed
            </h2>
            <p className="mt-5 text-muted-foreground leading-relaxed">
              Renting near LAUTECH used to mean chasing WhatsApp numbers, paying
              strangers upfront and hoping for the best. Rentora fixes that —
              every property is verified, every agent is ID-checked, and every
              naira you pay stays in escrow until you confirm you’ve moved in.
            </p>
            <Link to="/browse" className="inline-block mt-6">
              <Button className="rounded-full gap-2 h-12 px-6">
                More Info <ArrowUpRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ═══ STATS + MAP ═════════════════════════════════════ */}
      <section className="py-14 px-4">
        <div className="container mx-auto grid md:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="font-display font-bold text-3xl md:text-4xl leading-tight">
              Let’s See Our Progress
            </h2>
            <p className="mt-4 text-muted-foreground leading-relaxed max-w-md">
              Charting our course: reviewing every listing, verifying every agent,
              and holding every naira in escrow so students can move in without fear.
            </p>
            <Link to="/browse" className="inline-block mt-6">
              <Button className="rounded-full gap-2 h-11 px-5">
                More Info <ArrowUpRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>

          <div className="relative rounded-3xl bg-accent/60 p-8 md:p-10 min-h-[280px] overflow-hidden">
            <svg viewBox="0 0 400 200" className="absolute inset-0 w-full h-full opacity-25">
              <path d="M20 100 Q100 40 200 100 T380 100" stroke="hsl(var(--primary))" fill="none" strokeWidth="2" strokeDasharray="3 4"/>
              <circle cx="80" cy="90" r="3" fill="hsl(var(--primary))"/>
              <circle cx="200" cy="100" r="4" fill="hsl(var(--primary))"/>
              <circle cx="320" cy="95" r="3" fill="hsl(var(--primary))"/>
            </svg>
            <div className="relative grid grid-cols-2 gap-6">
              {[
                { v: '500+', l: 'Properties Listed' },
                { v: '1,000+', l: 'Happy Students' },
                { v: '50+', l: 'Verified Agents' },
                { v: '24/7', l: 'Support Available' },
              ].map((s) => (
                <div key={s.l}>
                  <p className="font-display font-black text-4xl md:text-5xl text-foreground">{s.v}</p>
                  <p className="text-sm text-muted-foreground mt-1">{s.l}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══ DIAGONAL MARQUEE RIBBONS ═══════════════════════ */}
      <section className="ribbon-wrap my-4">
        <div className="ribbon down">
          <div className="ribbon-track">
            {[...ribbonWords, ...ribbonWords, ...ribbonWords].map((w, i) => (
              <span key={i}>{w}<span className="dot ml-10" /></span>
            ))}
          </div>
        </div>
        <div className="ribbon up">
          <div className="ribbon-track" style={{ animationDirection: 'reverse' }}>
            {[...ribbonWords, ...ribbonWords, ...ribbonWords].map((w, i) => (
              <span key={i}>{w}<span className="dot ml-10" /></span>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ HOW WE WORK ════════════════════════════════════ */}
      <section className="py-20 md:py-28 px-4">
        <div className="container mx-auto">
          <div className="max-w-xl">
            <h2 className="font-display font-bold text-3xl md:text-4xl leading-tight">
              How Rentora Works
            </h2>
            <p className="mt-3 text-muted-foreground">
              Five simple steps between you and the keys to a verified room near campus.
            </p>
          </div>

          <div className="relative mt-14 grid md:grid-cols-5 gap-8">
            {/* dotted connector line */}
            <svg className="hidden md:block absolute top-6 left-8 right-8 w-[calc(100%-4rem)] h-4 pointer-events-none" preserveAspectRatio="none" viewBox="0 0 800 20">
              <path d="M0 10 Q200 0 400 10 T800 10" stroke="hsl(var(--primary))" strokeDasharray="4 6" strokeWidth="1.5" fill="none"/>
            </svg>
            {workflow.map((w) => (
              <div key={w.n} className="relative">
                <div className="w-12 h-12 rounded-full bg-white border-2 border-primary text-primary font-display font-bold flex items-center justify-center relative z-10 shadow">
                  {w.n}
                </div>
                <h3 className="mt-5 font-display font-bold text-lg">{w.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{w.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ BIG BLUE CTA BANNER (App download style) ═══════ */}
      <section className="py-10 px-4">
        <div className="container mx-auto">
          <div className="cta-banner p-8 md:p-14 flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="relative z-10 max-w-xl">
              <h2 className="font-display font-black text-3xl md:text-5xl text-white leading-tight">
                Move in without <br /> the middleman drama.
              </h2>
              <p className="mt-4 text-white/85 text-base md:text-lg">
                Sign up free. Unlock verified agents with one token. Book an inspection.
                Move in when everything checks out — we hold the rent till then.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link to="/register">
                  <Button size="lg" className="rounded-full bg-white text-primary hover:bg-white/90 font-semibold">
                    Create Free Account
                  </Button>
                </Link>
                <Link to="/browse">
                  <Button size="lg" variant="outline" className="rounded-full bg-transparent border-white/50 text-white hover:bg-white/10">
                    Browse Rooms <ArrowRight className="w-4 h-4 ml-1" />
                  </Button>
                </Link>
              </div>
            </div>
            <div className="relative z-10 shrink-0">
              <div className="w-56 h-56 md:w-72 md:h-72 rounded-3xl bg-white/10 border border-white/25 backdrop-blur-md flex items-center justify-center shadow-2xl">
                <KeyRound className="w-24 h-24 md:w-32 md:h-32 text-white/90" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ LATEST NEWS ════════════════════════════════════ */}
      <section className="py-20 px-4">
        <div className="container mx-auto">
          <div className="text-center max-w-2xl mx-auto">
            <h2 className="font-display font-bold text-3xl md:text-4xl">Latest From Rentora</h2>
            <p className="mt-3 text-muted-foreground">
              Guides, safety tips and stories from students moving into
              LAUTECH’s off-campus housing every session.
            </p>
          </div>

          <div className="mt-12 grid md:grid-cols-3 gap-6">
            {news.map((n) => (
              <article key={n.title} className="bg-white rounded-3xl overflow-hidden border border-border/60 hover:shadow-xl transition-shadow">
                <div className="h-48 overflow-hidden">
                  <img src={n.img} alt={n.title} className="w-full h-full object-cover hover:scale-105 transition-transform duration-500" />
                </div>
                <div className="p-6">
                  <p className="text-xs font-semibold text-primary tracking-wide">{n.date}</p>
                  <h3 className="mt-3 font-display font-bold text-lg leading-snug">{n.title}</h3>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ PEOPLE / TRUST STRIP ═══════════════════════════ */}
      <section className="py-16 px-4">
        <div className="container mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <h2 className="font-display font-bold text-3xl md:text-4xl">Over 1,000+ Students Trust Us</h2>
            <p className="mt-3 text-muted-foreground">
              Real students, real agents — a growing community moving in
              through Rentora each semester in Ogbomosho.
            </p>
          </div>

          <div className="relative rounded-[2.5rem] bg-primary p-6 md:p-10">
            <div className="grid md:grid-cols-3 gap-5">
              {people.map((p) => (
                <div key={p.name} className="relative rounded-2xl overflow-hidden aspect-[4/5] bg-white/10">
                  <img src={p.img} alt={p.name} className="absolute inset-0 w-full h-full object-cover" />
                  <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/70 to-transparent">
                    <p className="text-white font-display font-bold">{p.name}</p>
                    <p className="text-white/80 text-xs">{p.role}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-center mt-8">
              <Link to="/browse">
                <Button className="rounded-full bg-white text-primary hover:bg-white/90 font-semibold gap-2">
                  See All Listings <ArrowUpRight className="w-4 h-4" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ BECOME AN AGENT ═══════════════════════════════ */}
      <section className="py-16 px-4">
        <div className="container mx-auto">
          <Card className="relative overflow-hidden bg-foreground text-white p-8 md:p-12 border-0 rounded-3xl shadow-xl">
            <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
              <div className="max-w-xl">
                <span className="chip bg-white/10 text-white border border-white/20">
                  <HandshakeIcon className="w-3.5 h-3.5" /> For Agents
                </span>
                <h2 className="mt-4 font-display font-bold text-3xl md:text-4xl text-white">
                  Want to Become a Rentora Agent?
                </h2>
                <p className="mt-4 text-white/70 leading-relaxed">
                  Keep <strong className="text-white">100% of every inspection fee</strong> you set,
                  plus your full rent commission when a tenant moves in.
                </p>
                <ul className="mt-4 space-y-1.5">
                  {['Keep 100% of your inspection fee', 'Full rent + agent fee via escrow', 'Flexible hours', 'ID-verified badge', 'Direct bank withdrawals'].map(item => (
                    <li key={item} className="flex items-center gap-2 text-sm text-white/80">
                      <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />{item}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="shrink-0">
                <Link to="/become-agent">
                  <Button size="lg" className="rounded-full bg-primary hover:bg-primary/90 text-white font-semibold">
                    Apply Now <ArrowRight className="w-5 h-5" />
                  </Button>
                </Link>
              </div>
            </div>
          </Card>
        </div>
      </section>

      {/* ═══ MARKETPLACE PROMO ══════════════════════════════ */}
      <section className="pb-20 px-4">
        <div className="container mx-auto">
          <div className="relative overflow-hidden rounded-3xl p-8 md:p-14 shadow-xl border border-border/60 bg-accent">
            <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
              <div className="flex items-start md:items-center gap-6">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                  <ShoppingBag className="w-8 h-8 text-primary" />
                </div>
                <div>
                  <span className="chip bg-primary text-primary-foreground">
                    <Sparkles className="w-3.5 h-3.5" /> Coming Soon
                  </span>
                  <h2 className="mt-3 font-display font-bold text-2xl md:text-4xl leading-tight">
                    The Ogbomosho Student Marketplace
                  </h2>
                  <p className="mt-3 text-muted-foreground max-w-xl">
                    Buy and sell within the LAUTECH community. Textbooks, electronics,
                    hostel gear — safe, local, and student-only.
                  </p>
                </div>
              </div>
              <Link to="https://ogbomoshomarket.vercel.app/" target="_blank" rel="noopener noreferrer" className="shrink-0">
                <Button size="lg" className="rounded-full gap-2 h-14 px-8">
                  Explore Marketplace <ArrowRight className="w-5 h-5" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ ONBOARDING MODAL (unchanged behavior) ═════════ */}
      <Dialog open={showOnboarding} onOpenChange={() => {}}>
        <DialogContent className="w-[calc(100vw-32px)] max-w-sm mx-auto rounded-3xl p-0 overflow-hidden gap-0 [&>button]:hidden z-[99999]">
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
            <button onClick={dismissOnboarding} className="flex-1 text-sm text-muted-foreground hover:text-foreground transition-colors py-2">
              {onboardingStep === onboardingSteps.length - 1 ? 'Done' : 'Skip'}
            </button>
            {onboardingStep < onboardingSteps.length - 1 ? (
              <Button className="flex-1 gap-1 rounded-full" onClick={() => setOnboardingStep(s => s + 1)}>
                Next <ChevronRightIcon className="w-4 h-4" />
              </Button>
            ) : (
              <Button className="flex-1 rounded-full" onClick={dismissOnboarding}>
                Get Started 🎉
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AppBanner />
    </div>
  );
}

export default Home;
