import { Link } from 'react-router-dom';
import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';
import { SplitText } from 'gsap/SplitText';
import { ArrowRight, BadgeCheck, KeyRound, HandCoins, ShieldCheck, Lock, CheckCircle2, Zap, Star, Users, Home as HomeIcon } from 'lucide-react';
import { AppBanner } from '../components/AppBanner';
import { AdSlot } from '../components/AdSlot';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../components/ui/dialog';

gsap.registerPlugin(SplitText);

const heroImg = 'https://images.pexels.com/photos/1571460/pexels-photo-1571460.jpeg?auto=compress&cs=tinysrgb&w=1200';
const hostelImg = 'https://images.pexels.com/photos/1571468/pexels-photo-1571468.jpeg?auto=compress&cs=tinysrgb&w=800';
const apartmentImg = 'https://images.pexels.com/photos/1643383/pexels-photo-1643383.jpeg?auto=compress&cs=tinysrgb&w=800';
const interiorImg = 'https://images.pexels.com/photos/1571453/pexels-photo-1571453.jpeg?auto=compress&cs=tinysrgb&w=800';

const steps = [
  { icon: BadgeCheck, title: 'Browse verified homes', copy: 'Explore real listings around LAUTECH at no cost.' },
  { icon: KeyRound, title: 'Book an viewing', copy: 'Contact the agent directly or book a paid viewing.' },
  { icon: HandCoins, title: 'Pay securely', copy: 'See every fee upfront before making your rent payment.' },
  { icon: ShieldCheck, title: 'Protected by escrow', copy: 'Rent is held until you confirm you have moved in.' },
];

export function Home() {
  const [welcomeOpen, setWelcomeOpen] = useState(false);
  const headingRef = useRef(null);
  const subtextRef = useRef(null);
  const ctaRef = useRef(null);

  // Apple-style staggered reveal: heading words, then subtext lines, then CTA.
  useLayoutEffect(() => {
    if (typeof window === 'undefined') return;
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let ctx;
    let splits = [];

    const run = () => {
      ctx = gsap.context(() => {
        if (prefersReduced) {
          gsap.set([headingRef.current, subtextRef.current, ctaRef.current], { opacity: 1, y: 0 });
          return;
        }

        const headingSplit = new SplitText(headingRef.current, { type: 'words', wordsClass: 'hero-word' });
        const subtextSplit = new SplitText(subtextRef.current, { type: 'lines', linesClass: 'hero-line' });
        splits = [headingSplit, subtextSplit];

        gsap.set([headingRef.current, subtextRef.current, ctaRef.current], { opacity: 1 });

        const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
        tl.from(headingSplit.words, { y: 30, opacity: 0, duration: 0.9, stagger: 0.055 })
          .from(subtextSplit.lines, { y: 24, opacity: 0, duration: 0.8, stagger: 0.09 }, '-=0.55')
          .from(ctaRef.current, { y: 20, opacity: 0, duration: 0.7 }, '-=0.5');
      });
    };

    // Wait for fonts so line/word splitting measures correctly.
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(run).catch(run);
    } else {
      run();
    }

    return () => {
      splits.forEach(split => split.revert());
      splits = [];
      if (ctx) ctx.revert();
    };
  }, []);

  useEffect(() => {
    if (localStorage.getItem('rentora_welcome_seen')) return;

    // If the visitor already answered the consent banner (e.g. on a
    // previous visit), show the welcome tour on its normal timer.
    if (localStorage.getItem('rentora_consent')) {
      const t = setTimeout(() => setWelcomeOpen(true), 600);
      return () => clearTimeout(t);
    }

    // Otherwise the consent banner hasn't been answered yet — wait for it
    // to be dismissed (Accept or Decline) before showing the welcome tour,
    // so the two never overlap on screen.
    const handleConsentDecided = () => {
      setTimeout(() => setWelcomeOpen(true), 400);
    };
    window.addEventListener('rentora:consent-decided', handleConsentDecided);
    return () => window.removeEventListener('rentora:consent-decided', handleConsentDecided);
  }, []);

  const closeWelcome = () => {
    localStorage.setItem('rentora_welcome_seen', 'true');
    setWelcomeOpen(false);
  };

  return (
    <div data-testid="home-page">
      <AppBanner />

      {/* Ad slot — header billboard */}
      <div className="mx-auto max-w-7xl px-5 pt-4 sm:px-8">
        <AdSlot slotType="header_billboard" />
      </div>

      {/* Hero */}
      <section data-no-motion className="mx-auto max-w-7xl px-5 pb-16 pt-8 sm:px-8 md:pb-24 md:pt-12">
        <div className="relative min-h-[560px] overflow-hidden rounded-[28px] bg-[hsl(60_8%_90%)] md:min-h-[680px]">
          <img src={heroImg} alt="Modern student residence in Ogbomosho"
               className="absolute inset-0 h-full w-full object-cover object-center"
               fetchpriority="high" decoding="async" width="1200" height="800" />
          <div className="absolute inset-0 bg-[hsl(210_53%_13%)]/15" />
          <div className="relative z-10 flex min-h-[560px] max-w-xl flex-col justify-between p-6 sm:p-10 md:min-h-[680px] md:p-14">
            <div className="w-fit rounded-full bg-white/90 px-4 py-2 text-xs font-semibold text-primary backdrop-blur">
              Verified homes for LAUTECH students
            </div>
            <div className="rounded-[24px] bg-background/95 p-6 shadow-2xl shadow-black/10 backdrop-blur sm:p-8">
              <h1 ref={headingRef} style={{ opacity: 0 }} className="font-heading text-4xl font-semibold leading-[1.02] tracking-[-0.045em] text-foreground sm:text-5xl md:text-6xl">
                A better way to find your place.
              </h1>
              <p ref={subtextRef} style={{ opacity: 0 }} className="mt-5 max-w-md text-base leading-7 text-muted-foreground">
                Browse verified student homes, meet trusted agents, and pay rent with protection built in.
              </p>
              <div ref={ctaRef} style={{ opacity: 0 }} className="mt-7">
                <Link to="/browse"
                  className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3.5 text-sm font-semibold text-primary-foreground transition-colors hover:opacity-90">
                  Browse listings <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>
        <div className="mt-8 flex flex-wrap gap-x-12 gap-y-5 px-2">
          {[['500+', 'verified homes'], ['1,000+', 'happy students'], ['100%', 'escrow protected']].map(([value, label]) => (
            <div key={label}>
              <p className="text-xl font-semibold text-foreground">{value}</p>
              <p className="mt-1 text-xs text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Browse by type */}
      <section className="mx-auto max-w-7xl px-5 py-16 sm:px-8 md:py-24">
        <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Find your fit</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-foreground sm:text-4xl">Browse by property type</h2>
          </div>
          <Link to="/browse" className="text-sm font-semibold text-primary hover:underline">View all homes</Link>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          {[
            { label: 'Hostels', image: hostelImg, query: 'hostel', copy: 'Simple, social and close to campus.' },
            { label: 'Apartments', image: apartmentImg, query: 'apartment', copy: 'More room for you or your flatmates.' },
            { label: 'All listings', image: interiorImg, query: '', copy: 'Explore every verified option.' },
          ].map(type => (
            <Link key={type.label}
                  to={`/browse${type.query ? `?property_type=${type.query}` : ''}`}
                  className="group relative aspect-[4/5] overflow-hidden rounded-2xl bg-[hsl(60_8%_88%)]">
              <img src={type.image} alt="" className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]" loading="lazy" decoding="async" width="800" height="600" />
              <div className="absolute inset-0 bg-black/25" />
              <div className="absolute inset-x-0 bottom-0 p-6 text-white">
                <h3 className="text-2xl font-semibold">{type.label}</h3>
                <p className="mt-1 text-sm text-white/80">{type.copy}</p>
                <span className="mt-5 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white text-primary">
                  <ArrowRight className="h-4 w-4" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Ad slot — in-feed banner */}
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <AdSlot slotType="in_feed_banner" />
      </div>

      {/* Testimonials & Social Proof */}
      <section className="bg-muted/30 py-20 md:py-28">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="mb-12 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Loved by Students</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">What our students say</h2>
            <p className="mt-3 text-muted-foreground">Thousands of LAUTECH students have found their home on Rentora</p>
          </div>

          <div className="grid gap-6 md:grid-cols-3 mb-12">
            {[
              { name: 'Chioma O.', testimonial: 'Found my perfect hostel in just 2 days! The verification process gives me peace of mind knowing the place is legit.', rating: 5 },
              { name: 'Tunde A.', testimonial: 'Best platform for student housing. The escrow protection means I don\'t have to worry about losing my money to dubious agents.', rating: 5 },
              { name: 'Zainab M.', testimonial: 'Smooth booking experience from start to finish. The support team is responsive and helpful throughout the process.', rating: 5 },
            ].map((testimonial, i) => (
              <div key={i} className="rounded-2xl bg-white p-6 border border-border/60">
                <div className="flex gap-1 mb-4">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <p className="text-foreground/70 leading-relaxed mb-4">"{testimonial.testimonial}"</p>
                <p className="font-semibold text-foreground">{testimonial.name}</p>
                <p className="text-xs text-foreground/50">LAUTECH Student</p>
              </div>
            ))}
          </div>

          {/* Trust Badges */}
          <div className="grid gap-6 sm:grid-cols-3">
            <div className="rounded-2xl bg-white p-8 text-center border border-border/60">
              <Users className="h-8 w-8 text-primary mx-auto mb-3" />
              <p className="text-3xl font-bold text-foreground">1,200+</p>
              <p className="text-sm text-foreground/60 mt-1">Students Served</p>
            </div>
            <div className="rounded-2xl bg-white p-8 text-center border border-border/60">
              <HomeIcon className="h-8 w-8 text-primary mx-auto mb-3" />
              <p className="text-3xl font-bold text-foreground">500+</p>
              <p className="text-sm text-foreground/60 mt-1">Verified Properties</p>
            </div>
            <div className="rounded-2xl bg-white p-8 text-center border border-border/60">
              <CheckCircle2 className="h-8 w-8 text-primary mx-auto mb-3" />
              <p className="text-3xl font-bold text-foreground">98%</p>
              <p className="text-sm text-foreground/60 mt-1">Satisfaction Rate</p>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="bg-white py-20 md:py-28">
        <div className="mx-auto grid max-w-7xl gap-12 px-5 sm:px-8 lg:grid-cols-[1.05fr_.95fr] lg:items-center">
          <img src={interiorImg} alt="Bright student apartment interior" className="aspect-[4/3] w-full rounded-[24px] object-cover" loading="lazy" decoding="async" width="800" height="600" />
          <div className="lg:pl-10">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Rent with clarity</p>
            <h2 className="mt-3 max-w-lg text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">Protection from search to move-in.</h2>
            <div className="mt-9 divide-y divide-black/10 border-y border-black/10">
              {steps.slice(0, 3).map((step, i) => (
                <div key={step.title} className="grid grid-cols-[36px_1fr] gap-4 py-5">
                  <span className="text-sm font-semibold text-primary">0{i + 1}</span>
                  <div>
                    <h3 className="font-semibold">{step.title}</h3>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">{step.copy}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Safety & Protection */}
      <section className="mx-auto max-w-7xl px-5 py-20 sm:px-8 md:py-24">
        <div className="overflow-hidden rounded-[28px] bg-gradient-to-br from-blue-600 to-blue-800 p-7 text-white sm:p-12 md:p-16">
          <div className="grid gap-10 lg:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-100">Peace of mind</p>
              <h2 className="mt-4 max-w-2xl text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">
                Every transaction protected.
              </h2>
              <p className="mt-5 max-w-xl text-base leading-7 text-blue-50">
                Rentora holds your rent in secure escrow until you confirm you&apos;ve moved in. Only verified agents. Transparent fees. Your security, our priority.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl bg-white/10 p-5 backdrop-blur-sm">
                <Lock className="h-6 w-6 text-blue-200" />
                <h3 className="mt-3 font-semibold">Escrow Protected</h3>
                <p className="mt-1 text-sm text-blue-50">Rent held securely until move-in confirmed</p>
              </div>
              <div className="rounded-xl bg-white/10 p-5 backdrop-blur-sm">
                <BadgeCheck className="h-6 w-6 text-blue-200" />
                <h3 className="mt-3 font-semibold">Verified Agents</h3>
                <p className="mt-1 text-sm text-blue-50">All agents vetted for reliability</p>
              </div>
              <div className="rounded-xl bg-white/10 p-5 backdrop-blur-sm">
                <Zap className="h-6 w-6 text-blue-200" />
                <h3 className="mt-3 font-semibold">Transparent Pricing</h3>
                <p className="mt-1 text-sm text-blue-50">See all fees upfront, no surprises</p>
              </div>
              <div className="rounded-xl bg-white/10 p-5 backdrop-blur-sm">
                <CheckCircle2 className="h-6 w-6 text-blue-200" />
                <h3 className="mt-3 font-semibold">Buyer Protection</h3>
                <p className="mt-1 text-sm text-blue-50">Dispute resolution & support team</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Dialog open={welcomeOpen} onOpenChange={(o) => { if (!o) closeWelcome(); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl">Your safer way home</DialogTitle>
            <DialogDescription>Four simple steps from browsing to moving in.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-3 sm:grid-cols-2">
            {steps.map((s, i) => (
              <div key={s.title} className="rounded-2xl bg-[hsl(60_8%_95%)] p-5">
                <div className="flex items-center justify-between">
                  <s.icon className="h-5 w-5 text-primary" />
                  <span className="text-xs font-semibold text-muted-foreground">0{i + 1}</span>
                </div>
                <h3 className="mt-6 font-semibold">{s.title}</h3>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">{s.copy}</p>
              </div>
            ))}
          </div>
          <button onClick={closeWelcome} className="w-full rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground">
            Start browsing
          </button>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default Home;
