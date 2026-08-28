import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, BadgeCheck, ImageIcon, MessageCircle, ShieldCheck,
} from 'lucide-react';
import { advertisingAPI, AD_SLOT_SPECS } from '../lib/advertising';
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from '../components/ui/accordion';

const money = (value) => `₦${Number(value || 0).toLocaleString('en-NG')}`;

// Static preview creatives shown on the pricing page (files live in /public).
const SLOT_PREVIEW_IMAGES = {
  header_billboard: '/Header_billboard.png',
  mid_page_content: '/Mid_page_content.png',
  in_feed_banner: '/In_feed_banner.png',
};

const howItWorks = [
  { step: '01', title: 'Choose a placement', copy: 'Pick from three ad slots across the Rentora site, each with transparent weekly and monthly pricing.' },
  { step: '02', title: 'Submit your campaign', copy: 'Upload your creative, set a headline and destination link, and pick a duration.' },
  { step: '03', title: 'Pay securely', copy: 'Checkout is handled through our existing secure payment flow — the price is always the one shown to you.' },
  { step: '04', title: 'Go live after review', copy: 'Once approved, your ad starts rotating in its slot for the length of your campaign.' },
];

const faqs = [
  { q: 'How is pricing calculated?', a: 'Each slot has its own weekly and monthly rate, shown live on this page. A 14-day campaign is billed at twice the weekly rate; a 30-day campaign uses the monthly rate.' },
  { q: 'Do I need a separate account to advertise?', a: 'No — sign in with your existing Rentora account (the same one used for browsing or renting) to create and manage campaigns.' },
  { q: 'How long does review take?', a: 'Submitted campaigns are checked shortly after payment is confirmed. Once approved, your ad starts rotating immediately in its slot.' },
  { q: 'Can I change my creative after submitting?', a: 'Reach out via Contact and our team can help swap your creative or destination link before or during a campaign.' },
];

function SlotPreview({ slotKey, price }) {
  const spec = AD_SLOT_SPECS[slotKey];
  const ratio = spec.width / spec.height;
  const weekly = price;
  const monthly = price ? Math.round(price * 3.5) : null; // matches a ~30-day rate if no explicit monthly rate is returned
  return (
    <div className="rounded-2xl border border-border/70 bg-card p-5">
      <div
        className="mx-auto flex w-full items-center justify-center overflow-hidden rounded-xl border border-border bg-muted/40 text-muted-foreground"
        style={{ aspectRatio: ratio, maxHeight: 180 }}
      >
        {SLOT_PREVIEW_IMAGES[slotKey] ? (
          <img
            src={SLOT_PREVIEW_IMAGES[slotKey]}
            alt={`${spec.label} ad preview`}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <ImageIcon className="h-6 w-6" />
        )}
      </div>
      <p className="mt-4 font-semibold text-foreground">{spec.label}</p>
      <p className="text-xs text-muted-foreground">{spec.width}×{spec.height}px</p>
      <div className="mt-4 space-y-1.5 border-t border-border/60 pt-4">
        <div className="flex items-baseline justify-between">
          <span className="text-xs text-muted-foreground">7 days</span>
          <span className="text-sm font-semibold text-foreground">{weekly ? money(weekly) : '—'}</span>
        </div>
        <div className="flex items-baseline justify-between">
          <span className="text-xs text-muted-foreground">14 days</span>
          <span className="text-sm font-semibold text-foreground">{weekly ? money(weekly * 2) : '—'}</span>
        </div>
        <div className="flex items-baseline justify-between">
          <span className="text-xs text-muted-foreground">30 days</span>
          <span className="text-sm font-semibold text-foreground">{monthly ? money(monthly) : '—'}</span>
        </div>
      </div>
    </div>
  );
}

export function AdvertisePricing() {
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
      {/* Header */}
      <section className="mx-auto max-w-7xl px-5 pb-12 pt-16 sm:px-8 md:pb-16 md:pt-24">
        <div className="mx-auto max-w-2xl text-center">
          <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-sm font-semibold text-primary">
            <BadgeCheck size={16} /> Placements &amp; pricing
          </div>
          <h1 className="font-heading text-4xl font-semibold leading-[1.05] tracking-[-0.03em] text-foreground sm:text-5xl">
            Live pricing for every ad slot
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg">
            Three placements across the Rentora site, each with transparent weekly and monthly rates. Every campaign can run 7, 14, or 30 days.
          </p>
        </div>
      </section>

      {/* Placements */}
      <section className="border-y border-border/60 bg-muted/20 py-16 md:py-20">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="grid gap-5 sm:grid-cols-3">
            {Object.keys(AD_SLOT_SPECS).map((slotKey) => (
              <SlotPreview key={slotKey} slotKey={slotKey} price={priceFor(slotKey)} />
            ))}
          </div>
          <div className="mt-10 flex justify-center">
            <Link to="/advertise/create" className="inline-flex items-center gap-2 rounded-full bg-primary px-7 py-3.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90">
              Advertise now <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-16 md:py-24">
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
          <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-foreground sm:text-4xl">Pricing &amp; billing questions</h2>
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

export default AdvertisePricing;