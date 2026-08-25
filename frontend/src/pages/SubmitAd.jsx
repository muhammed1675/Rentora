import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ImagePlus, Megaphone, Send } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { toast } from 'sonner';

const slots = [
  ['header_billboard', 'Header Billboard'],
  ['mid_page_content', 'Mid-Page Content'],
  ['in_feed_banner', 'In-Feed Banner'],
];

function normalizeWhatsapp(value) {
  const raw = String(value || '').trim();
  if (raw.startsWith('+234')) return raw.replace(/\D/g, '');
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('234')) return digits;
  if (digits.startsWith('0')) return `234${digits.slice(1)}`;
  return digits;
}

export default function SubmitAd() {
  const navigate = useNavigate();
  const [configs, setConfigs] = useState([]);
  const [form, setForm] = useState({ full_name: '', business_name: '', whatsapp_number: '', image_url: '', ad_text: '', slot: 'header_billboard' });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    supabase.from('ad_slot_config').select('*').order('slot').then(({ data }) => setConfigs(data || []));
  }, []);

  const selectedConfig = useMemo(() => configs.find(c => c.slot === form.slot), [configs, form.slot]);
  const set = (key) => (event) => setForm(current => ({ ...current, [key]: event.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    if (!form.full_name.trim() || !form.business_name.trim() || !form.whatsapp_number.trim() || !form.image_url.trim()) {
      toast.error('Please complete every required field.');
      return;
    }
    const whatsapp = normalizeWhatsapp(form.whatsapp_number);
    if (whatsapp.length < 13) { toast.error('Enter a valid Nigerian WhatsApp number.'); return; }
    setSubmitting(true);
    const { error } = await supabase.from('ads').insert({
      full_name: form.full_name.trim(), business_name: form.business_name.trim(), whatsapp_number: whatsapp,
      image_url: form.image_url.trim(), ad_text: form.ad_text.trim() || null, slot: form.slot,
      status: 'pending_review', payment_status: 'pending', clicks: 0,
    });
    setSubmitting(false);
    if (error) { toast.error('We could not submit your advert. Please try again.'); return; }
    toast.success('Advert submitted for admin review.');
    navigate('/');
  };

  return <main className="mx-auto max-w-3xl px-5 py-10 sm:px-8">
    <Link to="/" className="mb-8 inline-flex items-center gap-2 text-sm font-semibold text-primary"><ArrowLeft data-icon="inline-start" /> Back to Rentora</Link>
    <div className="mb-8"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Grow your reach</p><h1 className="mt-3 text-4xl font-semibold tracking-tight">Advertise on Rentora</h1><p className="mt-3 max-w-xl leading-7 text-muted-foreground">Reach students while they search, compare and choose their next home. Every advert is reviewed before it goes live.</p></div>
    <Card className="p-6 sm:p-8"><form onSubmit={submit} className="flex flex-col gap-5">
      <div className="grid gap-5 sm:grid-cols-2"><label className="flex flex-col gap-2 text-sm font-medium">Full name *<Input value={form.full_name} onChange={set('full_name')} placeholder="Your full name" /></label><label className="flex flex-col gap-2 text-sm font-medium">Business name *<Input value={form.business_name} onChange={set('business_name')} placeholder="Business or brand name" /></label></div>
      <label className="flex flex-col gap-2 text-sm font-medium">WhatsApp number *<Input value={form.whatsapp_number} onChange={set('whatsapp_number')} placeholder="080..., 090... or +234..." /><span className="text-xs font-normal text-muted-foreground">We normalize Nigerian numbers automatically.</span></label>
      <label className="flex flex-col gap-2 text-sm font-medium">Ad image URL *<Input value={form.image_url} onChange={set('image_url')} placeholder="https://your-domain.com/advert.jpg" /><span className="text-xs font-normal text-muted-foreground">Use a public image URL. Recommended: 1200 × 400px.</span></label>
      <label htmlFor="ad-text" className="flex flex-col gap-2 text-sm font-medium">Short message<Textarea id="ad-text" value={form.ad_text} onChange={set('ad_text')} placeholder="Tell students what you offer" maxLength={180} /></label>
      <fieldset className="flex flex-col gap-3"><legend className="text-sm font-medium">Choose an available slot *</legend><div className="grid gap-3 sm:grid-cols-3">{slots.map(([value, label]) => { const config = configs.find(c => c.slot === value); return <label key={value} className={`cursor-pointer rounded-xl border p-4 transition ${form.slot === value ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'}`}><input type="radio" name="slot" value={value} checked={form.slot === value} onChange={set('slot')} className="sr-only" /><span className="block text-sm font-semibold">{label}</span><span className="mt-2 block text-xs text-muted-foreground">{config ? `₦${Number(config.price_per_week ?? config.weekly_price ?? 0).toLocaleString()}/week` : 'Pricing shown after setup'}</span></label>; })}</div></fieldset>
      <div className="rounded-xl bg-muted/50 p-4 text-sm text-muted-foreground"><Megaphone className="mb-2 text-primary" />{selectedConfig ? `Your selected slot allows up to ${selectedConfig.max_concurrent_ads || 5} concurrent adverts. If it is full, your submission will wait for the next opening.` : 'Admin approval is required before your advert appears.'}</div>
      <Button type="submit" disabled={submitting}>{submitting ? 'Submitting…' : 'Submit for review'} <Send data-icon="inline-end" /></Button>
    </form></Card>
    <p className="mt-5 flex items-center gap-2 text-xs text-muted-foreground"><ImagePlus data-icon="inline-start" /> Your image and details will be checked by the Rentora admin team.</p>
  </main>;
}

