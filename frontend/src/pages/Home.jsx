import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { ArrowRight, BadgeCheck, KeyRound, HandCoins, ShieldCheck } from 'lucide-react';
import { AppBanner } from '../components/AppBanner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../components/ui/dialog';

const heroImg = 'https://images.pexels.com/photos/1571460/pexels-photo-1571460.jpeg';
const hostelImg = 'https://images.pexels.com/photos/1571468/pexels-photo-1571468.jpeg';
const apartmentImg = 'https://images.pexels.com/photos/1643383/pexels-photo-1643383.jpeg';
const interiorImg = 'https://images.pexels.com/photos/1571453/pexels-photo-1571453.jpeg';

const steps = [
  { icon: BadgeCheck, title: 'Browse verified homes', copy: 'Explore real listings around LAUTECH at no cost.' },
  { icon: KeyRound, title: 'Unlock or inspect', copy: 'Use tokens for contacts or book a paid inspection.' },
  { icon: HandCoins, title: 'Pay securely', copy: 'See every fee upfront before making your rent payment.' },
  { icon: ShieldCheck, title: 'Protected by escrow', copy: 'Rent is held until you confirm you have moved in.' },
];

export function Home() {
  const [welcomeOpen, setWelcomeOpen] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem('rentora_welcome_seen')) {
      const t = setTimeout(() => setWelcomeOpen(true), 600);
      return () => clearTimeout(t);
    }
  }, []);

  const closeWelcome = () => {
    localStorage.setItem('rentora_welcome_seen', 'true');
    setWelcomeOpen(false);
  };

  return (
    <div data-testid="home-page">
      <AppBanner />

      {/* Hero */}
      <section className="mx-auto max-w-7xl px-5 pb-16 pt-8 sm:px-8 md:pb-24 md:pt-12">
        <div className="relative min-h-[560px] overflow-hidden rounded-[28px] bg-[hsl(60_8%_90%)] md:min-h-[680px]">
          <img src={heroImg} alt="Modern student residence in Ogbomosho"
               className="absolute inset-0 h-full w-full object-cover object-center" />
          <div className="absolute inset-0 bg-[hsl(210_53%_13%)]/15" />
          <div className="relative z-10 flex min-h-[560px] max-w-xl flex-col justify-between p-6 sm:p-10 md:min-h-[680px] md:p-14">
            <div className="w-fit rounded-full bg-white/90 px-4 py-2 text-xs font-semibold text-primary backdrop-blur">
              Verified homes for LAUTECH students
            </div>
            <div className="rounded-[24px] bg-background/95 p-6 shadow-2xl shadow-black/10 backdrop-blur sm:p-8">
              <h1 className="font-heading text-4xl font-semibold leading-[1.02] tracking-[-0.045em] text-foreground sm:text-5xl md:text-6xl">
                A better way to find your place.
              </h1>
              <p className="mt-5 max-w-md text-base leading-7 text-muted-foreground">
                Browse verified student homes, meet trusted agents, and pay rent with protection built in.
              </p>
              <Link to="/browse"
                className="mt-7 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3.5 text-sm font-semibold text-primary-foreground transition-colors hover:opacity-90">
                Browse listings <ArrowRight className="h-4 w-4" />
              </Link>
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
              <img src={type.image} alt="" className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]" />
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

      {/* How it works */}
      <section className="bg-white py-20 md:py-28">
        <div className="mx-auto grid max-w-7xl gap-12 px-5 sm:px-8 lg:grid-cols-[1.05fr_.95fr] lg:items-center">
          <img src={interiorImg} alt="Bright student apartment interior" className="aspect-[4/3] w-full rounded-[24px] object-cover" />
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

      {/* Become an agent CTA */}
      <section className="mx-auto max-w-7xl px-5 py-20 sm:px-8 md:py-24">
        <div className="overflow-hidden rounded-[28px] bg-primary p-7 text-primary-foreground sm:p-12 md:p-16">
          <div className="grid gap-10 md:grid-cols-[1.25fr_.75fr] md:items-end">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/55">Build your business</p>
              <h2 className="mt-4 max-w-2xl text-3xl font-semibold tracking-[-0.035em] sm:text-5xl">
                Earn more as a verified Rentora agent.
              </h2>
              <p className="mt-5 max-w-xl text-base leading-7 text-white/70">
                Keep 100% of every inspection fee, plus receive the full rent and agent fee payout when students move in.
              </p>
            </div>
            <Link to="/become-agent"
                  className="inline-flex w-fit items-center gap-2 rounded-full bg-white px-6 py-3.5 text-sm font-semibold text-primary md:justify-self-end">
              Become an agent <ArrowRight className="h-4 w-4" />
            </Link>
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
