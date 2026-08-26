import { Link } from 'react-router-dom';
import {
  ArrowRight, BadgeCheck, BarChart3, Clock, LayoutDashboard,
  Megaphone, MessageCircle, ShieldCheck, Tag, Target,
} from 'lucide-react';
import { useAuth } from '../lib/auth';

const benefits = [
  { icon: Target, title: 'Reach students actively searching', copy: 'Every viewer is already looking for a place to live — your ad meets real intent, not passive scrolling.' },
  { icon: BadgeCheck, title: 'Reviewed, never spammy', copy: 'Every creative is checked before it goes live, keeping placements trustworthy for renters and advertisers alike.' },
  { icon: BarChart3, title: 'Clear performance', copy: 'Track clicks on your campaign so you know it is working, not just running.' },
  { icon: Clock, title: 'Flexible campaign lengths', copy: 'Run for a week, two weeks, or a full month — pause and relaunch whenever suits your budget.' },
];

export function AdvertiseHome() {
  const { user } = useAuth();

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
            <Link to="/advertise" className="inline-flex items-center gap-2 rounded-full border border-border px-7 py-3.5 text-sm font-semibold text-foreground transition hover:bg-muted/50">
              <Tag className="h-4 w-4" /> View placements &amp; pricing
            </Link>
          </div>
          {user && (
            <div className="mt-4">
              <Link to="/advertise/dashboard" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition hover:text-primary">
                <LayoutDashboard className="h-3.5 w-3.5" /> Go to my campaigns
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* Benefits */}
      <section className="border-y border-border/60 bg-muted/20 py-16 md:py-24">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Why advertise here</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-foreground sm:text-4xl">Built for real intent, not idle scrolling</h2>
          </div>
          <div className="mt-12 grid gap-6 sm:grid-cols-2">
            {benefits.map((b) => (
              <div key={b.title} className="flex gap-4 rounded-2xl border border-border/60 bg-card p-6">
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
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-7xl px-5 py-16 sm:px-8 md:py-24">
        <div className="overflow-hidden rounded-[28px] bg-gradient-to-br from-blue-600 to-blue-800 p-8 text-center text-white sm:p-14">
          <ShieldCheck className="mx-auto h-8 w-8 text-blue-100" />
          <h2 className="mt-4 text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">Ready to put your listing in front of renters?</h2>
          <p className="mx-auto mt-4 max-w-xl text-blue-50">See exact pricing for every slot, then submit your campaign in a few minutes.</p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link to="/advertise" className="inline-flex items-center gap-2 rounded-full bg-white px-7 py-3.5 text-sm font-semibold text-blue-800 transition hover:opacity-90">
              <Tag className="h-4 w-4" /> View placements &amp; pricing
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
