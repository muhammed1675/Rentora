import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Check, ImagePlus, Loader2, Megaphone, ShieldCheck } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { advertisingAPI, AD_SLOT_SPECS, estimateAdPrice, normalizeWhatsApp, safeExternalUrl, validateCreative } from '../lib/advertising';

const money = (value) => `₦${Number(value || 0).toLocaleString('en-NG')}`;

export default function Advertise() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [slots, setSlots] = useState([]);
  const [form, setForm] = useState({ slot: '', durationDays: 7, advertiserName: user?.full_name || '', whatsapp: '', destinationUrl: '', headline: '', description: '' });
  const [file, setFile] = useState(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { advertisingAPI.getSlotConfig().then(setSlots).catch(() => setMessage('Unable to load live ad pricing right now.')); }, []);
  const selected = slots.find((slot) => slot.slot === form.slot);
  // Estimate only, for display before checkout. The price that's actually
  // charged is always recomputed server-side from ad_slot_config in
  // /api/advertise-init-payment.js — this number is never sent as an amount.
  const total = useMemo(() => estimateAdPrice(selected, form.durationDays), [selected, form.durationDays]);

  const submit = async (event) => {
    event.preventDefault(); setMessage('');
    if (!user) { navigate(`/login?next=${encodeURIComponent('/advertise')}`); return; }
    const url = safeExternalUrl(form.destinationUrl);
    const creativeError = validateCreative(file, form.slot);
    if (!form.slot || !form.advertiserName.trim() || !normalizeWhatsApp(form.whatsapp) || !url || !form.headline.trim() || creativeError) { setMessage(creativeError || 'Please complete every field with valid information.'); return; }
    setBusy(true);
    try {
      const uploaded = await advertisingAPI.uploadCreative(file);
      const ad = await advertisingAPI.createPendingAd({ ...form, userId: user.id, durationDays: Number(form.durationDays), whatsapp: normalizeWhatsApp(form.whatsapp), destinationUrl: url, creativeUrl: uploaded.url, creativePath: uploaded.path });
      // The server appends its own generated ?reference= to this base URL.
      const payment = await advertisingAPI.initPayment(ad.id, `${window.location.origin}/payment/callback`);
      const checkoutUrl = payment?.data?.checkout_url;
      if (checkoutUrl) window.location.assign(checkoutUrl);
      else if (payment?.data?.alreadyPaid) { setMessage('This advert has already been paid for.'); }
      else setMessage('Your ad is saved as pending. Please try payment again from your account.');
    } catch (error) { setMessage(error.message || 'We could not submit your advertisement.'); } finally { setBusy(false); }
  };

  return <main className="min-h-screen bg-slate-50 py-12"><div className="mx-auto max-w-6xl px-4 sm:px-6"><div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-start"><section className="pt-4"><div className="mb-5 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1.5 text-sm font-semibold text-primary"><Megaphone size={16} /> Reach renters on Rentora</div><h1 className="max-w-xl text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">Put your property in the right hands.</h1><p className="mt-5 max-w-lg text-lg leading-8 text-slate-600">Launch a clear, high-impact listing promotion that meets renters while they are actively searching.</p><div className="mt-8 grid gap-4 text-sm text-slate-700"><div className="flex gap-3"><ShieldCheck className="mt-0.5 text-primary" size={20} /><span>Every ad is reviewed before it goes live.</span></div><div className="flex gap-3"><Check className="mt-0.5 text-primary" size={20} /><span>Live pricing and transparent campaign durations.</span></div></div></section><form onSubmit={submit} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"><div className="mb-7"><h2 className="text-2xl font-bold text-slate-900">Create your campaign</h2><p className="mt-1 text-sm text-slate-500">Pay securely, then your ad goes live after a quick admin review.</p></div><div className="grid gap-5 sm:grid-cols-2"><label className="text-sm font-semibold text-slate-700">Advertiser name<input required value={form.advertiserName} onChange={(e) => setForm({ ...form, advertiserName: e.target.value })} className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal outline-none focus:border-primary" /></label><label className="text-sm font-semibold text-slate-700">WhatsApp number<input required placeholder="08012345678" value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal outline-none focus:border-primary" /></label><label className="text-sm font-semibold text-slate-700 sm:col-span-2">Destination URL<input required type="url" placeholder="https://yourwebsite.com" value={form.destinationUrl} onChange={(e) => setForm({ ...form, destinationUrl: e.target.value })} className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal outline-none focus:border-primary" /></label><label className="text-sm font-semibold text-slate-700">Ad placement<select required value={form.slot} onChange={(e) => setForm({ ...form, slot: e.target.value })} className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-normal"><option value="">Choose a placement</option>{slots.map((slot) => <option key={slot.slot} value={slot.slot}>{AD_SLOT_SPECS[slot.slot]?.label || slot.slot} — from {money(slot.weekly_price ?? slot.price_per_week)}/week</option>)}</select></label><label className="text-sm font-semibold text-slate-700">Duration<select value={form.durationDays} onChange={(e) => setForm({ ...form, durationDays: e.target.value })} className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-normal"><option value="7">7 days</option><option value="14">14 days</option><option value="30">30 days</option></select></label><label className="text-sm font-semibold text-slate-700 sm:col-span-2">Headline<input required maxLength={90} value={form.headline} onChange={(e) => setForm({ ...form, headline: e.target.value })} className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal" /></label><label className="text-sm font-semibold text-slate-700 sm:col-span-2">Creative<input required type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setFile(e.target.files?.[0] || null)} className="mt-2 block w-full rounded-lg border border-dashed border-slate-300 p-3 text-sm font-normal" /><span className="mt-1 block text-xs font-normal text-slate-500">JPG, PNG, or WebP. Maximum 5 MB.</span></label></div>{selected && <div className="mt-6 flex items-center justify-between rounded-xl bg-slate-50 p-4"><span className="text-sm text-slate-600">Estimated total</span><strong className="text-xl text-slate-900">{money(total)}</strong></div>}{message && <p role="alert" className="mt-5 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{message}</p>}<button disabled={busy} className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-60">{busy ? <Loader2 className="animate-spin" size={18} /> : <ImagePlus size={18} />} Submit and continue <ArrowRight size={17} /></button></form></div></div></main>;
}
