import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from '../components/ui/accordion';
import {
  Factory, Clock, ShieldCheck, Leaf, ArrowRight, Home as HomeIcon,
  Building2, Briefcase, GraduationCap, ClipboardList, Hammer, Truck,
  Wrench, Sparkles, MapPin, MessageSquareText, Phone
} from 'lucide-react';

export function Home() {
  const navigate = useNavigate();

  const highlights = [
    { icon: Factory, title: 'Built in Controlled', sub: 'Factory Settings' },
    { icon: Clock, title: '50% Faster', sub: 'Project Delivery' },
    { icon: ShieldCheck, title: 'Superior Quality', sub: '& Durability' },
    { icon: Leaf, title: 'Sustainable', sub: 'by Design' },
  ];

  const solutions = [
    { icon: HomeIcon, tag: 'Modular Homes', desc: 'Beautiful, energy-efficient homes built for modern living.',
      img: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=900&q=70' },
    { icon: Building2, tag: 'Multi-Family', desc: 'Scalable housing solutions built faster, for more people.',
      img: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=900&q=70' },
    { icon: Briefcase, tag: 'Commercial', desc: 'Offices, retail, and mixed-use spaces — built with precision.',
      img: 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=900&q=70' },
    { icon: GraduationCap, tag: 'Institutions', desc: 'Schools and facilities that support communities.',
      img: 'https://images.unsplash.com/photo-1562774053-701939374585?auto=format&fit=crop&w=900&q=70' },
  ];

  const steps = [
    { n: 1, icon: ClipboardList, title: 'Plan',    desc: 'We collaborate and design to bring your vision to life.' },
    { n: 2, icon: Hammer,        title: 'Build',   desc: 'Modules are built in our factory with precision and quality control.' },
    { n: 3, icon: Truck,         title: 'Deliver', desc: 'Modules are transported to your site, ready for quick installation.' },
    { n: 4, icon: Wrench,        title: 'Install', desc: 'Our team assembles modules quickly and efficiently on-site.' },
    { n: 5, icon: Sparkles,      title: 'Enjoy',   desc: 'Move in sooner and enjoy a better building experience.' },
  ];

  const stats = [
    { icon: Clock, value: '50%', label: 'Faster Delivery' },
    { icon: Briefcase, value: '20%', label: 'Cost Savings' },
    { icon: ShieldCheck, value: 'High', label: 'Quality Control' },
    { icon: Leaf, value: 'Low', label: 'Environmental Impact' },
  ];

  const projects = [
    { name: 'Lakeside Retreat', location: 'Lake Arrowhead, CA', tag: 'Modular Home',
      desc: 'A custom modular home designed for comfort, views, and year-round living.',
      img: 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=900&q=70' },
    { name: 'The Summit', location: 'Denver, CO', tag: 'Multi-Family',
      desc: 'A 48-unit complex delivered in half the time of traditional construction.',
      img: 'https://images.unsplash.com/photo-1600585154526-990dced4db0d?auto=format&fit=crop&w=900&q=70' },
    { name: 'Elevate Office', location: 'Austin, TX', tag: 'Commercial',
      desc: 'A sleek, sustainable office space built for productivity and growth.',
      img: 'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?auto=format&fit=crop&w=900&q=70' },
  ];

  const faqs = [
    { q: 'How is modular construction different?',
      a: 'Modules are built in a climate-controlled factory in parallel with site preparation, cutting timelines and improving quality control.' },
    { q: 'How much time and cost can I save?',
      a: 'Most projects are delivered up to 50% faster with roughly 20% cost savings compared to traditional site-built construction.' },
    { q: 'Is modular construction as durable as traditional?',
      a: 'Yes — Skyline modules are engineered to meet or exceed local building codes and are transport-tested for structural integrity.' },
    { q: 'Can modular buildings be customized?',
      a: 'Absolutely. From layout and finishes to façade materials, every Skyline project starts with your vision.' },
    { q: 'Do you handle permitting and site work?',
      a: 'We coordinate permits, foundation, utilities, and installation as part of a single turn-key process.' },
  ];

  return (
    <div className="min-h-screen bg-background" data-testid="home-page">
      {/* Hero */}
      <section className="relative bg-background">
        <div className="container mx-auto px-6 pt-10 md:pt-16 pb-6">
          <div className="grid md:grid-cols-2 gap-10 items-center">
            <div className="max-w-xl">
              <h1 className="font-display font-extrabold tracking-tight text-4xl md:text-5xl lg:text-6xl leading-[1.05] text-foreground">
                Built Smarter.
                <span className="block text-primary">Delivered Faster.</span>
              </h1>
              <p className="mt-6 text-base md:text-lg text-muted-foreground leading-relaxed">
                Premium modular and prefab buildings engineered for quality, efficiency, and a better way to build.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button size="lg" className="gap-2 px-6 shadow-sm" onClick={() => navigate('/browse')}>
                  Explore Solutions <ArrowRight className="w-4 h-4" />
                </Button>
                <Button size="lg" variant="outline" className="gap-2 px-6 border-primary text-primary hover:bg-primary/5"
                  onClick={() => navigate('/contact')}>
                  Get a Free Quote
                </Button>
              </div>
            </div>
            <div className="relative rounded-2xl overflow-hidden shadow-xl aspect-[4/3] md:aspect-[5/4]">
              <img
                src="https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1400&q=80"
                alt="Modern modular home at dusk"
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        </div>

        <div className="container mx-auto px-6 pb-14">
          <div className="rounded-2xl border border-border bg-white shadow-sm px-6 py-5 grid grid-cols-2 md:grid-cols-4 gap-4">
            {highlights.map(h => (
              <div key={h.title} className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-brand-soft flex items-center justify-center shrink-0">
                  <h.icon className="w-5 h-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-sm text-foreground leading-tight">{h.title}</p>
                  <p className="text-xs text-muted-foreground leading-tight">{h.sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Solutions */}
      <section className="py-16 md:py-20 bg-muted/40">
        <div className="container mx-auto px-6">
          <div className="text-center mb-10">
            <p className="text-primary text-xs font-bold tracking-[0.25em] uppercase">Modular Solutions</p>
            <h2 className="mt-2 text-3xl md:text-4xl font-extrabold text-foreground">Built for Every Need</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {solutions.map(s => (
              <Card key={s.tag} className="overflow-hidden border-border/70 bg-white hover:shadow-lg transition-shadow">
                <div className="relative aspect-[4/3]">
                  <img src={s.img} alt={s.tag} className="w-full h-full object-cover" />
                  <div className="absolute -bottom-6 left-4 w-12 h-12 rounded-full bg-white shadow-md flex items-center justify-center">
                    <s.icon className="w-6 h-6 text-primary" />
                  </div>
                </div>
                <div className="p-5 pt-8">
                  <h3 className="font-semibold text-lg text-foreground">{s.tag}</h3>
                  <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
                  <Link to="/browse" className="mt-3 inline-flex items-center gap-1 text-primary text-sm font-semibold">
                    Learn More <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-16 md:py-20 bg-background">
        <div className="container mx-auto px-6">
          <div className="text-center mb-14">
            <p className="text-primary text-xs font-bold tracking-[0.25em] uppercase">How It Works</p>
            <h2 className="mt-2 text-3xl md:text-4xl font-extrabold text-foreground">A Smarter Way to Build</h2>
          </div>
          <div className="relative max-w-5xl mx-auto">
            <div className="hidden md:block absolute top-10 left-[10%] right-[10%] border-t-2 border-dashed border-primary/30" />
            <div className="grid grid-cols-2 md:grid-cols-5 gap-8 relative">
              {steps.map(s => (
                <div key={s.n} className="flex flex-col items-center text-center">
                  <div className="relative w-20 h-20 rounded-full bg-primary flex items-center justify-center shadow-lg">
                    <s.icon className="w-8 h-8 text-white" />
                    <div className="absolute -bottom-2 w-6 h-6 rounded-full bg-white border-2 border-primary flex items-center justify-center text-[11px] font-bold text-primary">
                      {s.n}
                    </div>
                  </div>
                  <h3 className="mt-5 font-semibold text-foreground">{s.title}</h3>
                  <p className="mt-1 text-xs text-muted-foreground leading-relaxed max-w-[180px]">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Stats banner */}
      <section className="py-10">
        <div className="container mx-auto px-6">
          <div className="rounded-2xl overflow-hidden bg-primary text-white grid md:grid-cols-2">
            <div className="relative min-h-[220px]">
              <img
                src="https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=1200&q=70"
                alt="Modular construction in progress"
                className="absolute inset-0 w-full h-full object-cover mix-blend-luminosity opacity-70"
              />
              <div className="absolute inset-0 bg-primary/40" />
            </div>
            <div className="p-8 md:p-10">
              <p className="text-xs font-bold tracking-[0.25em] uppercase text-white/70">Speed & Efficiency</p>
              <h3 className="mt-2 text-2xl md:text-3xl font-extrabold">Better Buildings. Better Outcomes.</h3>
              <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-6">
                {stats.map(s => (
                  <div key={s.label}>
                    <s.icon className="w-6 h-6 text-white/80" />
                    <p className="mt-2 text-2xl font-extrabold">{s.value}</p>
                    <p className="text-xs text-white/80">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Featured projects */}
      <section className="py-16 md:py-20 bg-background">
        <div className="container mx-auto px-6">
          <div className="flex items-end justify-between mb-8 gap-4 flex-wrap">
            <div>
              <p className="text-primary text-xs font-bold tracking-[0.25em] uppercase">Featured Projects</p>
              <h2 className="mt-2 text-3xl md:text-4xl font-extrabold text-foreground">Real Projects. Real Results.</h2>
            </div>
            <Link to="/browse" className="inline-flex items-center gap-1 text-primary text-sm font-semibold">
              View All Projects <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {projects.map(p => (
              <Card key={p.name} className="overflow-hidden border-border/70 bg-white hover:shadow-lg transition-shadow">
                <div className="aspect-[4/3]">
                  <img src={p.img} alt={p.name} className="w-full h-full object-cover" />
                </div>
                <div className="p-5">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="font-semibold text-lg text-foreground">{p.name}</h3>
                    <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-brand-soft text-primary whitespace-nowrap">{p.tag}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground inline-flex items-center gap-1">
                    <MapPin className="w-3 h-3" /> {p.location}
                  </p>
                  <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{p.desc}</p>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA + FAQ */}
      <section className="py-10 md:py-16 bg-background">
        <div className="container mx-auto px-6 grid md:grid-cols-[1fr_1.4fr] gap-6">
          <Card className="bg-primary text-white p-8 border-0 shadow-xl">
            <div className="w-12 h-12 rounded-full bg-white/15 flex items-center justify-center">
              <MessageSquareText className="w-6 h-6 text-white" />
            </div>
            <h3 className="mt-5 text-2xl md:text-3xl font-extrabold leading-tight">Ready to Build Something Better?</h3>
            <p className="mt-3 text-sm text-white/85 leading-relaxed">
              Let's discuss your project and show you how modular can save you time and money.
            </p>
            <Button size="lg" variant="secondary" className="mt-6 bg-white text-primary hover:bg-white/90 gap-2"
              onClick={() => navigate('/contact')}>
              Get a Free Quote <ArrowRight className="w-4 h-4" />
            </Button>
          </Card>

          <Card className="p-8 border-border/70 bg-white">
            <p className="text-primary text-xs font-bold tracking-[0.25em] uppercase">FAQ</p>
            <h3 className="mt-2 text-2xl md:text-3xl font-extrabold text-foreground">Frequently Asked Questions</h3>
            <Accordion type="single" collapsible className="mt-4">
              {faqs.map((f, i) => (
                <AccordionItem key={i} value={`f-${i}`} className="border-border/70">
                  <AccordionTrigger className="text-left text-sm font-semibold hover:no-underline">{f.q}</AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground">{f.a}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-8 bg-[#0b1220] text-white/80">
        <div className="container mx-auto px-6 py-14 grid grid-cols-2 md:grid-cols-5 gap-8">
          <div className="col-span-2">
            <div className="text-white">
              <div className="font-display font-extrabold tracking-tight text-lg">SKYLINE</div>
              <div className="text-[10px] tracking-[0.35em] text-white/60 mt-1">MODULAR</div>
            </div>
            <p className="mt-4 text-sm text-white/70 max-w-xs leading-relaxed">
              Modern buildings. Smarter process. Better results. That's the Skyline Modular promise.
            </p>
          </div>
          <div>
            <p className="text-white font-semibold text-sm mb-3">Solutions</p>
            <ul className="space-y-2 text-sm text-white/70">
              <li><Link to="/browse">Modular Homes</Link></li>
              <li><Link to="/browse">Multi-Family</Link></li>
              <li><Link to="/browse">Commercial</Link></li>
              <li><Link to="/browse">Institutions</Link></li>
            </ul>
          </div>
          <div>
            <p className="text-white font-semibold text-sm mb-3">Company</p>
            <ul className="space-y-2 text-sm text-white/70">
              <li><Link to="/contact">About Us</Link></li>
              <li><Link to="/contact">Our Process</Link></li>
              <li><Link to="/become-agent">Partners</Link></li>
              <li><Link to="/contact">Contact</Link></li>
            </ul>
          </div>
          <div>
            <p className="text-white font-semibold text-sm mb-3">Get in Touch</p>
            <ul className="space-y-2 text-sm text-white/70">
              <li className="inline-flex items-center gap-2"><Phone className="w-4 h-4" /> (888) SKY-8230</li>
              <li>hello@skylinemodular.com</li>
              <li>123 Skyline Way, San Diego, CA</li>
            </ul>
          </div>
        </div>
        <div className="border-t border-white/10 py-4 text-center text-xs text-white/50">
          © {new Date().getFullYear()} Skyline Modular. All rights reserved.
        </div>
      </footer>
    </div>
  );
}

export default Home;
