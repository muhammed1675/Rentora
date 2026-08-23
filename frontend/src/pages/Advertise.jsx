import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { adsAPI } from '../lib/api';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { ArrowLeft, CheckCircle2, ImagePlus, Loader2, Users } from 'lucide-react';
import { useSubmitGuard } from '../hooks/useSubmitGuard';
import { normalizeNgPhone } from '../lib/utils';

const SLOT_LABELS = {
  header_billboard: 'Header Billboard',
  mid_page_content: 'Mid-Page Content',
  in_feed_banner: 'In-Feed Banner',
};

const formatNaira = (n) => `₦${Number(n || 0).toLocaleString('en-NG')}`;

export function Advertise() {
  const { guard, busy } = useSubmitGuard();

  const [slots, setSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(true);
  const [duration, setDuration] = useState('week');
  const [selectedSlot, setSelectedSlot] = useState(null);

  const [form, setForm] = useState({ businessName: '', contactName: '', whatsappNumber: '', email: '' });
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [imageDims, setImageDims] = useState(null);

  const [outcome, setOutcome] = useState(null); // { kind: 'pending_review' | 'pending_queue', queuePosition }

  const refreshSlots = () => {
    adsAPI.getSlots()
      .then(({ data }) => setSlots(data))
      .catch(() => toast.error('Could not load ad slots. Please refresh.'))
      .finally(() => setLoadingSlots(false));
  };

  useEffect(() => { refreshSlots(); }, []);

  const set = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const priceFor = (slot, dur) => (dur === 'week' ? slot.price_week : slot.price_month);

  const handlePickSlot = (slot) => {
    setSelectedSlot(slot);
    setOutcome(null);
  };

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    const url = URL.createObjectURL(file);
    setImagePreview(url);
    const img = new Image();
    img.onload = () => setImageDims({ width: img.naturalWidth, height: img.naturalHeight });
    img.src = url;
  };

  const aspectOk = useMemo(() => {
    if (!selectedSlot || !imageDims) return null;
    const target = selectedSlot.image_width / selectedSlot.image_height;
    const actual = imageDims.width / imageDims.height;
    return Math.abs(actual - target) / target <= 0.1; // ±10% tolerance
  }, [selectedSlot, imageDims]);

  const canSubmit = selectedSlot && form.businessName && form.contactName && form.whatsappNumber && imageFile && aspectOk !== false;

  const handleSubmit = async () => {
    if (!selectedSlot) return;
    if (!form.businessName || !form.contactName || !form.whatsappNumber) {
      toast.error('Please fill in business name, contact name, and WhatsApp number.');
      return;
    }
    if (!imageFile) {
      toast.error('Please upload your ad creative.');
      return;
    }
    if (aspectOk === false) {
      toast.error(`Image dimensions are off — aim for ${selectedSlot.image_width}×${selectedSlot.image_height}px.`);
      return;
    }

    try {
      const { data: uploaded } = await adsAPI.uploadCreative(imageFile);
      const normalizedWhatsapp = normalizeNgPhone(form.whatsappNumber);
      const { data: order } = await adsAPI.createPendingOrder({
        slotType: selectedSlot.slot_type,
        businessName: form.businessName,
        contactName: form.contactName,
        whatsappNumber: normalizedWhatsapp,
        email: form.email,
        imageUrl: uploaded.url,
        durationType: duration,
        amount: priceFor(selectedSlot, duration),
      });

      const { openFlutterwaveCheckout } = await import('../lib/flutterwave');
      await openFlutterwaveCheckout({
        reference: order.payment_reference,
        amount: order.amount_paid,
        email: form.email || 'ads@rentora.com.ng',
        name: form.contactName,
        phone: form.whatsappNumber,
        narration: `Rentora ad — ${SLOT_LABELS[selectedSlot.slot_type]} (${duration})`,
        confirmEndpoint: '/api/confirm-ad-payment',
        onSuccess: (_ref, confirmBody) => {
          if (confirmBody?.status === 'pending_queue') {
            setOutcome({ kind: 'pending_queue', queuePosition: confirmBody.queue_position });
          } else {
            setOutcome({ kind: 'pending_review' });
          }
          refreshSlots();
        },
        onFailed: () => toast.error('Payment failed. Please try again.'),
        onPending: () => toast.message('Payment received — confirming now. This can take a minute.'),
      });
    } catch (err) {
      toast.error(err.message || 'Something went wrong. Please try again.');
    }
  };

  if (outcome) {
    return (
      <div className="mx-auto max-w-xl px-5 py-16 sm:px-8 text-center">
        <CheckCircle2 className="mx-auto h-12 w-12 text-primary" />
        {outcome.kind === 'pending_review' ? (
          <>
            <h1 className="mt-5 text-2xl font-semibold">Thanks! Your ad is being reviewed.</h1>
            <p className="mt-2 text-muted-foreground">It'll go live within 24 hours once approved.</p>
          </>
        ) : (
          <>
            <h1 className="mt-5 text-2xl font-semibold">You're #{outcome.queuePosition} in line</h1>
            <p className="mt-2 text-muted-foreground">That slot is fully booked right now. We'll message you on WhatsApp the moment it goes live.</p>
          </>
        )}
        <Link to="/" className="mt-6 inline-block text-sm font-semibold text-primary hover:underline">Back to Rentora</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-5 py-10 sm:px-8">
      <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to Rentora
      </Link>

      <div className="mt-4 max-w-2xl">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Advertise on Rentora</h1>
        <p className="mt-2 text-muted-foreground">
          Reach students browsing verified homes near LAUTECH. No account needed — pick a slot, pay, and your ad rotates live once approved.
        </p>
      </div>

      {/* Duration toggle */}
      <div className="mt-8 inline-flex rounded-full border border-border/70 bg-muted/40 p-1">
        {['week', 'month'].map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setDuration(d)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${duration === d ? 'bg-white shadow text-foreground' : 'text-muted-foreground'}`}
          >
            {d === 'week' ? '1 week' : '1 month'}
          </button>
        ))}
      </div>

      {/* Slot cards */}
      <div className="mt-5 grid gap-5 sm:grid-cols-3">
        {loadingSlots ? (
          <div className="col-span-3 flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (
          slots.map((slot) => {
            const full = slot.active_count >= slot.max_concurrent_ads;
            const price = priceFor(slot, duration);
            const isSelected = selectedSlot?.slot_type === slot.slot_type;
            return (
              <Card key={slot.slot_type} className={`p-5 flex flex-col ${isSelected ? 'ring-2 ring-primary' : ''}`}>
                <div className={`aspect-[${slot.image_width}/${slot.image_height}] w-full rounded-lg mb-3 flex items-center justify-center text-xs text-muted-foreground ${full ? 'bg-muted/50 grayscale' : 'bg-muted/30'}`}
                     style={{ aspectRatio: slot.image_width / slot.image_height }}>
                  {slot.image_width}×{slot.image_height}px
                </div>
                <h3 className="font-semibold">{SLOT_LABELS[slot.slot_type] || slot.slot_type}</h3>
                <p className="mt-1 text-lg font-semibold text-foreground">
                  {formatNaira(price)}<span className="text-xs font-normal text-muted-foreground">/{duration === 'week' ? 'wk' : 'mo'}</span>
                </p>
                {duration === 'month' && (
                  <p className="text-xs text-muted-foreground">save vs 4 weeks at the weekly rate</p>
                )}

                <div className="mt-3 flex-1">
                  {full ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800">
                      <Users className="h-3 w-3" /> Fully booked — {slot.queue_count} waiting
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      {slot.max_concurrent_ads - slot.active_count} of {slot.max_concurrent_ads} spots open
                    </span>
                  )}
                </div>

                <Button className="mt-4" variant={isSelected ? 'default' : 'outline'} onClick={() => handlePickSlot(slot)}>
                  {full ? 'Join Waitlist' : isSelected ? 'Selected' : 'Select'}
                </Button>
              </Card>
            );
          })
        )}
      </div>

      {/* Details form */}
      {selectedSlot && (
        <Card className="mt-8 p-6 max-w-xl">
          <h2 className="font-semibold text-lg">Your details</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {SLOT_LABELS[selectedSlot.slot_type]} · {duration === 'week' ? '1 week' : '1 month'} · {formatNaira(priceFor(selectedSlot, duration))}
          </p>

          <div className="mt-5 space-y-4">
            <div className="space-y-2">
              <Label>Business name *</Label>
              <Input value={form.businessName} onChange={(e) => set('businessName', e.target.value)} placeholder="e.g. Campus Bites" />
            </div>
            <div className="space-y-2">
              <Label>Contact name *</Label>
              <Input value={form.contactName} onChange={(e) => set('contactName', e.target.value)} placeholder="Your name" />
            </div>
            <div className="space-y-2">
              <Label>WhatsApp number *</Label>
              <Input value={form.whatsappNumber} onChange={(e) => set('whatsappNumber', e.target.value)} placeholder="e.g. 0801 234 5678 or +234..." />
              <p className="text-xs text-muted-foreground">
                This is where clicks on your ad will go — double check it.
                {form.whatsappNumber && normalizeNgPhone(form.whatsappNumber) && (
                  <> We'll save it as <span className="font-medium text-foreground">+{normalizeNgPhone(form.whatsappNumber)}</span>.</>
                )}
              </p>
            </div>
            <div className="space-y-2">
              <Label>Email (optional backup contact)</Label>
              <Input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="you@business.com" />
            </div>

            <div className="space-y-2">
              <Label>Ad image *</Label>
              <p className="text-xs text-muted-foreground">Recommended: {selectedSlot.image_width}×{selectedSlot.image_height}px</p>
              <label className="mt-1 flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-border/70 bg-muted/20 p-4 text-sm text-muted-foreground hover:bg-muted/40">
                <ImagePlus className="h-4 w-4" />
                {imageFile ? imageFile.name : 'Choose an image'}
                <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleImageChange} />
              </label>
              {imagePreview && (
                <div className="mt-2 overflow-hidden rounded-lg border" style={{ aspectRatio: selectedSlot.image_width / selectedSlot.image_height }}>
                  <img src={imagePreview} alt="Ad preview" className="h-full w-full object-cover" />
                </div>
              )}
              {aspectOk === false && (
                <p className="text-xs text-destructive">
                  That image's proportions are off — aim for {selectedSlot.image_width}×{selectedSlot.image_height}px (±10%).
                </p>
              )}
            </div>

            <Button className="w-full" disabled={!canSubmit || busy} onClick={guard(handleSubmit)}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : `Pay ${formatNaira(priceFor(selectedSlot, duration))} & Submit`}
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}

export default Advertise;
