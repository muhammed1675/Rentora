import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Check, ImagePlus, Loader2, Megaphone, ShieldCheck, UploadCloud, X } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { advertisingAPI, AD_SLOT_SPECS, estimateAdPrice, normalizeWhatsApp, safeExternalUrl, validateCreative } from '../lib/advertising';

const money = (value) => `₦${Number(value || 0).toLocaleString('en-NG')}`;

export default function Advertise() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [slots, setSlots] = useState([]);
  const [form, setForm] = useState({ slot: '', durationDays: 7, advertiserName: user?.full_name || '', whatsapp: '', destinationUrl: '', headline: '', description: '' });
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => { advertisingAPI.getSlotConfig().then(setSlots).catch(() => setMessage('Unable to load live ad pricing right now.')); }, []);
  const selected = slots.find((slot) => slot.slot === form.slot);
  // Estimate only, for display before checkout. The price that's actually
  // charged is always recomputed server-side from ad_slot_config in
  // /api/advertise-init-payment.js — this number is never sent as an amount.
  const total = useMemo(() => estimateAdPrice(selected, form.durationDays), [selected, form.durationDays]);

  // Revoke the object URL whenever it changes or the component unmounts, so
  // we don't leak memory across repeated drag/drop or select actions.
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  const applyFile = (candidate) => {
    if (!candidate) return;
    const creativeError = validateCreative(candidate, form.slot || Object.keys(AD_SLOT_SPECS)[0]);
    if (creativeError) { setMessage(creativeError); return; }
    setMessage('');
    setFile(candidate);
    setPreviewUrl((current) => { if (current) URL.revokeObjectURL(current); return URL.createObjectURL(candidate); });
  };

  const clearFile = () => {
    setFile(null);
    setPreviewUrl((current) => { if (current) URL.revokeObjectURL(current); return ''; });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const onDrop = (event) => {
    event.preventDefault();
    setDragActive(false);
    applyFile(event.dataTransfer.files?.[0] || null);
  };

  const submit = async (event) => {
    event.preventDefault(); setMessage('');
    if (!user) { navigate(`/login?next=${encodeURIComponent('/advertise/create')}`); return; }
    const url = safeExternalUrl(form.destinationUrl);
    const creativeError = validateCreative(file, form.slot);
    if (!form.slot || !form.advertiserName.trim() || !normalizeWhatsApp(form.whatsapp) || !url || !form.headline.trim() || !form.description.trim() || creativeError) { setMessage(creativeError || 'Please complete every field with valid information.'); return; }
    setBusy(true);
    try {
      const uploaded = await advertisingAPI.uploadCreative(file);
      const ad = await advertisingAPI.createPendingAd({ ...form, userId: user.id, durationDays: Number(form.durationDays), whatsapp: normalizeWhatsApp(form.whatsapp), destinationUrl: url, creativeUrl: uploaded.url, creativePath: uploaded.path, price: total });
      // The server appends its own generated ?reference= to this base URL.
      const payment = await advertisingAPI.initPayment(ad.id, `${window.location.origin}/payment/callback`);
      const checkoutUrl = payment?.data?.checkout_url;
      if (checkoutUrl) window.location.assign(checkoutUrl);
      else if (payment?.data?.alreadyPaid) { setMessage('This advert has already been paid for.'); }
      else setMessage('Your ad is saved as pending. Please try payment again from your account.');
    } catch (error) { setMessage(error.message || 'We could not submit your advertisement.'); } finally { setBusy(false); }
  };

  return (
    <main className="min-h-screen bg-slate-50 py-12">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
          <section className="pt-4">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1.5 text-sm font-semibold text-primary">
              <Megaphone size={16} /> Reach renters on Rentora
            </div>
            <h1 className="max-w-xl text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">Put your property in the right hands.</h1>
            <p className="mt-5 max-w-lg text-lg leading-8 text-slate-600">Launch a clear, high-impact listing promotion that meets renters while they are actively searching.</p>
            <div className="mt-8 grid gap-4 text-sm text-slate-700">
              <div className="flex gap-3"><ShieldCheck className="mt-0.5 text-primary" size={20} /><span>Every ad is reviewed before it goes live.</span></div>
              <div className="flex gap-3"><Check className="mt-0.5 text-primary" size={20} /><span>Live pricing and transparent campaign durations.</span></div>
            </div>
          </section>

          <form onSubmit={submit} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="mb-7">
              <h2 className="text-2xl font-bold text-slate-900">Create your campaign</h2>
              <p className="mt-1 text-sm text-slate-500">Pay securely, then your ad goes live after a quick admin review.</p>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <label className="text-sm font-semibold text-slate-700">
                Advertiser name
                <input required value={form.advertiserName} onChange={(e) => setForm({ ...form, advertiserName: e.target.value })} className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal outline-none focus:border-primary" />
              </label>

              <label className="text-sm font-semibold text-slate-700">
                WhatsApp number
                <input required placeholder="08012345678" value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal outline-none focus:border-primary" />
              </label>

              <label className="text-sm font-semibold text-slate-700 sm:col-span-2">
                Destination URL
                <input required type="url" placeholder="https://yourwebsite.com" value={form.destinationUrl} onChange={(e) => setForm({ ...form, destinationUrl: e.target.value })} className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal outline-none focus:border-primary" />
              </label>

              <label className="text-sm font-semibold text-slate-700">
                Ad placement
                <select required value={form.slot} onChange={(e) => setForm({ ...form, slot: e.target.value })} className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-normal">
                  <option value="">Choose a placement</option>
                  {slots.map((slot) => <option key={slot.slot} value={slot.slot}>{AD_SLOT_SPECS[slot.slot]?.label || slot.slot} — from {money(slot.weekly_price ?? slot.price_per_week)}/week</option>)}
                </select>
              </label>

              <label className="text-sm font-semibold text-slate-700">
                Duration
                <select value={form.durationDays} onChange={(e) => setForm({ ...form, durationDays: e.target.value })} className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-normal">
                  <option value="7">7 days</option>
                  <option value="14">14 days</option>
                  <option value="30">30 days</option>
                </select>
              </label>

              <label className="text-sm font-semibold text-slate-700 sm:col-span-2">
                Headline
                <textarea required maxLength={220} rows={3} value={form.headline} onChange={(e) => setForm({ ...form, headline: e.target.value })} className="mt-2 w-full resize-none rounded-lg border border-slate-300 px-3 py-2.5 font-normal outline-none focus:border-primary" />
                <span className="mt-1 block text-xs font-normal text-slate-500">{form.headline.length}/220 characters</span>
              </label>

              <label className="text-sm font-semibold text-slate-700 sm:col-span-2">
                Message body
                <textarea required maxLength={2000} rows={5} placeholder="Tell renters more about your business or property — this shows on your ad's full details page." value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="mt-2 w-full resize-none rounded-lg border border-slate-300 px-3 py-2.5 font-normal outline-none focus:border-primary" />
                <span className="mt-1 block text-xs font-normal text-slate-500">{form.description.length}/2000 characters</span>
              </label>

              <div className="sm:col-span-2">
                <span className="text-sm font-semibold text-slate-700">Creative</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => applyFile(e.target.files?.[0] || null)}
                  className="hidden"
                />

                {previewUrl ? (
                  <div className="mt-2 flex items-center gap-4 rounded-lg border border-slate-300 bg-slate-50 p-3">
                    <img src={previewUrl} alt="Creative preview" className="h-20 w-32 shrink-0 rounded-md object-cover" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-700">{file?.name}</p>
                      <p className="text-xs text-slate-500">{file ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : ''}</p>
                      <div className="mt-2 flex gap-3">
                        <button type="button" onClick={() => fileInputRef.current?.click()} className="text-xs font-semibold text-primary hover:underline">
                          Replace image
                        </button>
                        <button type="button" onClick={clearFile} className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600 hover:underline">
                          <X size={12} /> Remove
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                    onDragLeave={() => setDragActive(false)}
                    onDrop={onDrop}
                    className={`mt-2 flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 text-center transition ${
                      dragActive ? 'border-primary bg-primary/5' : 'border-slate-300 bg-slate-50 hover:border-primary/50 hover:bg-slate-100'
                    }`}
                  >
                    <UploadCloud className={dragActive ? 'text-primary' : 'text-slate-400'} size={26} />
                    <span className="text-sm font-semibold text-slate-700">
                      {dragActive ? 'Drop your image here' : 'Drag and drop your image, or click to browse'}
                    </span>
                    <span className="text-xs font-normal text-slate-500">JPG, PNG, or WebP. Maximum 5 MB.</span>
                  </button>
                )}
              </div>
            </div>

            {selected && (
              <div className="mt-6 flex items-center justify-between rounded-xl bg-slate-50 p-4">
                <span className="text-sm text-slate-600">Estimated total</span>
                <strong className="text-xl text-slate-900">{money(total)}</strong>
              </div>
            )}

            {message && <p role="alert" className="mt-5 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{message}</p>}

            <button disabled={busy} className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-60">
              {busy ? <Loader2 className="animate-spin" size={18} /> : <ImagePlus size={18} />} Submit and continue <ArrowRight size={17} />
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}