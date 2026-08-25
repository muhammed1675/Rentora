import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ImagePlus, Megaphone, Send, UploadCloud, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { toast } from 'sonner';

const slots = [
  ['header_billboard', 'Header Billboard', 970, 250],
  ['mid_page_content', 'Mid-Page Content', 728, 90],
  ['in_feed_banner', 'In-Feed Banner', 300, 200],
];

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

function validateImage(file, slot) {
  const config = slots.find(([value]) => value === slot);
  if (!file || !config) return Promise.reject(new Error('Choose an image.'));
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return Promise.reject(new Error('Use a JPG, PNG, or WebP image.'));
  if (file.size > MAX_IMAGE_BYTES) return Promise.reject(new Error('Image must be 5MB or smaller.'));
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      if (image.naturalWidth !== config[2] || image.naturalHeight !== config[3]) reject(new Error(`${config[1]} requires exactly ${config[2]} × ${config[3]}px.`));
      else resolve(true);
    };
    image.onerror = () => reject(new Error('The selected file could not be read.'));
    image.src = URL.createObjectURL(file);
  });
}

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
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [imageError, setImageError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    supabase.from('ad_slot_config').select('*').order('slot').then(({ data }) => setConfigs(data || []));
  }, []);

  const selectedConfig = useMemo(() => configs.find(c => c.slot === form.slot), [configs, form.slot]);
  const set = (key) => (event) => setForm(current => ({ ...current, [key]: event.target.value }));

  const chooseImage = async (file) => {
    setImageError('');
    try {
      await validateImage(file, form.slot);
      setImageFile(file); setImagePreview(URL.createObjectURL(file));
    } catch (error) { setImageFile(null); setImagePreview(''); setImageError(error.message); }
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!form.full_name.trim() || !form.business_name.trim() || !form.whatsapp_number.trim() || !imageFile) { toast.error('Complete the form and choose one valid image.'); return; }
    const whatsapp = normalizeWhatsapp(form.whatsapp_number);
    if (whatsapp.length < 13) { toast.error('Enter a valid Nigerian WhatsApp number.'); return; }
    setSubmitting(true);
    const extension = imageFile.name.split('.').pop().toLowerCase();
    const path = `${crypto.randomUUID()}.${extension}`;
    const upload = await supabase.storage.from('ads').upload(path, imageFile, { contentType: imageFile.type, upsert: false });
    if (upload.error) { setSubmitting(false); toast.error('Image upload failed.'); return; }
    const { data: publicData } = supabase.storage.from('ads').getPublicUrl(path);
    const { error } = await supabase.from('ads').insert({
      full_name: form.full_name.trim(), business_name: form.business_name.trim(), whatsapp_number: whatsapp,
      image_url: publicData.publicUrl, ad_text: form.ad_text.trim() || null, slot: form.slot,
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
      <div className="flex flex-col gap-2 text-sm font-medium"><span>Ad image * <span className="font-normal text-muted-foreground">(one image only)</span></span><button type="button" onClick={() => fileInputRef.current?.click()} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); chooseImage(event.dataTransfer.files?.[0]); }} className="group flex min-h-40 flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 p-5 text-center transition hover:border-primary hover:bg-primary/10"><input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(event) => chooseImage(event.target.files?.[0])} />{imagePreview ? <img src={imagePreview} alt="Advert preview" className="max-h-32 max-w-full rounded-lg object-contain" /> : <><UploadCloud className="text-primary" /><span>Drop your image here, or click to choose</span><span className="text-xs font-normal text-muted-foreground">Gallery or camera · JPG, PNG, WebP · max 5MB</span></>}</button>{imagePreview && <button type="button" onClick={() => { setImageFile(null); setImagePreview(''); }} className="inline-flex items-center gap-1 self-start text-xs text-destructive"><X /> Remove image</button>}{imageError && <span className="text-xs font-normal text-destructive">{imageError}</span>}<span className="text-xs font-normal text-muted-foreground">Required size: {slots.find(([value]) => value === form.slot)?.slice(2).join(' × ')}px. Your phone camera and gallery are supported.</span></div>
      <label htmlFor="ad-text" className="flex flex-col gap-2 text-sm font-medium">Short message<Textarea id="ad-text" value={form.ad_text} onChange={set('ad_text')} placeholder="Tell students what you offer" maxLength={180} /></label>
      <fieldset className="flex flex-col gap-3"><legend className="text-sm font-medium">Choose an available slot *</legend><div className="grid gap-3 sm:grid-cols-3">{slots.map(([value, label]) => { const config = configs.find(c => c.slot === value); return <label key={value} className={`cursor-pointer rounded-xl border p-4 transition ${form.slot === value ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'}`}><input type="radio" name="slot" value={value} checked={form.slot === value} onChange={set('slot')} className="sr-only" /><span className="block text-sm font-semibold">{label}</span><span className="mt-2 block text-xs text-muted-foreground">{config ? `₦${Number(config.price_per_week ?? config.weekly_price ?? 0).toLocaleString()}/week` : 'Pricing shown after setup'}</span></label>; })}</div></fieldset>
      <div className="rounded-xl bg-muted/50 p-4 text-sm text-muted-foreground"><Megaphone className="mb-2 text-primary" />{selectedConfig ? `Your selected slot allows up to ${selectedConfig.max_concurrent_ads || 5} concurrent adverts. If it is full, your submission will wait for the next opening.` : 'Admin approval is required before your advert appears.'}</div>
      <Button type="submit" disabled={submitting}>{submitting ? 'Submitting…' : 'Submit for review'} <Send data-icon="inline-end" /></Button>
    </form></Card>
    <p className="mt-5 flex items-center gap-2 text-xs text-muted-foreground"><ImagePlus data-icon="inline-start" /> Your image and details will be checked by the Rentora admin team.</p>
  </main>;
}

