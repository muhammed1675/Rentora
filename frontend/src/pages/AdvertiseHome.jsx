import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, BadgeCheck, BarChart3, Clock, ImageIcon,
  LayoutDashboard, Megaphone, MessageCircle, ShieldCheck, Target,
} from 'lucide-react';
import { useAuth } from '../lib/auth';
import { advertisingAPI, AD_SLOT_SPECS } from '../lib/advertising';
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from '../components/ui/accordion';

const money = (value) => `₦${Number(value || 0).toLocaleString('en-NG')}`;

const benefits = [
  { icon: Target, title: 'Reach students actively searching', copy: 'Every viewer is already looking for a place to live — your ad meets real intent, not passive scrolling.' },
  { icon: BadgeCheck, title: 'Reviewed, never spammy', copy: 'Every creative is checked before it goes live, keeping placements trustworthy for renters and advertisers alike.' },
  { icon: BarChart3, title: 'Clear performance', copy: 'Track clicks on your campaign so you know it is working, not just running.' },
  { icon: Clock, title: 'Flexible campaign lengths', copy: 'Run for a week, two weeks, or a full month — pause and relaunch whenever suits your budget.' },
];

const howItWorks = [
  { step: '01', title: 'Choose a placement', copy: 'Pick from three ad slots across the Rentora site, each with transparent weekly and monthly pricing.' },
  { step: '02', title: 'Submit your campaign', copy: 'Upload your creative, set a headline and destination link, and pick a duration.' },
  { step: '03', title: 'Pay securely', copy: 'Checkout is handled through our existing secure payment flow — the price is always the one shown to you.' },
  { step: '04', title: 'Go live after review', copy: 'Once approved, your ad starts rotating in its slot for the length of your campaign.' },
];

const faqs = [
  { q: 'Who can advertise on Rentora?', a: 'Any business or individual with a property, service, or offer relevant to LAUTECH students in Ogbomosho. All creatives are reviewed before going live.' },
  { q: 'How is pricing calculated?', a: 'Each slot has its own weekly and monthly rate, shown live on this page. A 14-day campaign is billed at twice the weekly rate; a 30-day campaign uses the monthly rate.' },
  { q: 'Do I need a separate account to advertise?', a: 'No — sign in with your existing Rentora account (the same one used for browsing or renting) to create and manage campaigns.' },
  { q: 'How long does review take?', a: 'Submitted campaigns are checked shortly after payment is confirmed. Once approved, your ad starts rotating immediately in its slot.' },
  { q: 'Can I see how my ad is performing?', a: 'Yes — your advertiser dashboard shows payment status, approval status, campaign dates, and clicks for every campaign you run.' },
];

function SlotPreview({ slotKey, price }) {
  const spec = AD_SLOT_SPECS[slotKey];
  const ratio = spec.width / spec.height;
  return (
    <div className="rounded-2xl border border-border/70 bg-card p-5">
      <div
        className="mx-auto flex w-full items-center justify-center rounded-xl border border-dashed border-border bg-muted/40 text-muted-foreground"
        style={{ aspectRatio: ratio, maxHeight: 180 }}
      >
        <ImageIcon className="h-6 w-6" />
      </div>
      <p className="mt-4 font-semibold text-foreground">{spec.label}</p>
      <p className="text-xs text-muted-foreground">{spec.width}×{spec.height}px</p>
      <div className="mt-3 flex items-baseline gap-1.5">
        <span className="text-lg font-semibold text-foreground">{price ? money(price) : '—'}</span>
        <span className="text-xs text-muted-foreground">/week</span>
      </div>
    </div>
  );
}

export function AdvertiseHome() {
  const { user } = useAuth();
  const [slots, setSlots] = useState([]);

  useEffect(() => {
    advertisingAPI.getSlotConfig().then(setSlots).catch(() => {});
  }, []);

  const priceFor = (slotKey) => {
    const row = slots.find((s) => s.slot === slotKey);
    return row?.weekly_price ?? row?.price_per_week ?? null;
  };

  return (
    <main className="min-h-screen bg-background">
      {/* Hero */}
      <section className="mx-auto max-w-7xl px-5 pb-16 pt-16 sm:px-8 md:pb-24 md:pt-24">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-sm font-semibold text-primary">
            <Megaphone size={16} /> Rentora Advertising
          </div>
          <h1 className="font-heading text-4xl font-semibold leading-[1.05] tracking-[-0.03em] text-foreground sm:text-5xl md:text-6xl">
            Reach renters on Rentora
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg">
            Put your property, business, or offer in front of LAUTECH students who are actively searching for a place to live — right on Rentora's homepage and listings.
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-4">
            <Link to="/advertise/create" className="inline-flex items-center gap-2 rounded-full bg-primary px-7 py-3.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90">
              Advertise now <ArrowRight className="h-4 w-4" />
            </Link>
            {user ? (
              <Link to="/advertise/dashboard" className="inline-flex items-center gap-2 rounded-full border border-border px-7 py-3.5 text-sm font-semibold text-foreground transition hover:bg-muted/50">
                <LayoutDashboard className="h-4 w-4" /> My campaigns
              </Link>
            ) : (
              <Link to="/login?next=/advertise/dashboard" className="inline-flex items-center gap-2 rounded-full border border-border px-7 py-3.5 text-sm font-semibold text-foreground transition hover:bg-muted/50">
                Log in
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* Placements */}
      <section className="border-y border-border/60 bg-muted/20 py-16 md:py-24">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Placements</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-foreground sm:text-4xl">Available ad slots</h2>
            <p className="mt-3 text-muted-foreground">Live pricing, pulled directly from current rates. Every campaign can run 7, 14, or 30 days.</p>
          </div>
          <div className="mt-10 grid gap-5 sm:grid-cols-3">
            {Object.keys(AD_SLOT_SPECS).map((slotKey) => (
              <SlotPreview key={slotKey} slotKey={slotKey} price={priceFor(slotKey)} />
            ))}
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="mx-auto max-w-7xl px-5 py-16 sm:px-8 md:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Why advertise here</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-foreground sm:text-4xl">Built for real intent, not idle scrolling</h2>
        </div>
        <div className="mt-12 grid gap-6 sm:grid-cols-2">
          {benefits.map((b) => (
            <div key={b.title} className="flex gap-4 rounded-2xl border border-border/60 p-6">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <b.icon className="h-5 w-5" />
              </span>
              <div>
                <h3 className="font-semibold text-foreground">{b.title}</h3>
                <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{b.copy}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="bg-muted/20 py-16 md:py-24">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Process</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-foreground sm:text-4xl">How advertising works</h2>
          </div>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {howItWorks.map((s) => (
              <div key={s.step} className="rounded-2xl bg-card p-6 border border-border/60">
                <span className="text-sm font-semibold text-primary">{s.step}</span>
                <h3 className="mt-3 font-semibold text-foreground">{s.title}</h3>
                <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{s.copy}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-3xl px-5 py-16 sm:px-8 md:py-24">
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">FAQ</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-foreground sm:text-4xl">Common questions</h2>
        </div>
        <Accordion type="single" collapsible className="mt-10">
          {faqs.map((f, i) => (
            <AccordionItem key={i} value={`item-${i}`}>
              <AccordionTrigger className="text-left text-base font-semibold text-foreground">{f.q}</AccordionTrigger>
              <AccordionContent className="text-sm leading-6 text-muted-foreground">{f.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-7xl px-5 pb-20 sm:px-8 md:pb-28">
        <div className="overflow-hidden rounded-[28px] bg-gradient-to-br from-blue-600 to-blue-800 p-8 text-center text-white sm:p-14">
          <ShieldCheck className="mx-auto h-8 w-8 text-blue-100" />
          <h2 className="mt-4 text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">Ready to put your listing in front of renters?</h2>
          <p className="mx-auto mt-4 max-w-xl text-blue-50">Every ad is reviewed before it goes live, and pricing is always shown upfront — no surprises at checkout.</p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link to="/advertise/create" className="inline-flex items-center gap-2 rounded-full bg-white px-7 py-3.5 text-sm font-semibold text-blue-800 transition hover:opacity-90">
              Advertise now <ArrowRight className="h-4 w-4" />
            </Link>
            <Link to="/contact" className="inline-flex items-center gap-2 rounded-full border border-white/40 px-7 py-3.5 text-sm font-semibold text-white transition hover:bg-white/10">
              <MessageCircle className="h-4 w-4" /> Ask a question
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

export default AdvertiseHome;
