import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { propertyAPI, inspectionAPI } from '../lib/api';
import { openKorapayCheckout } from '../lib/korapay';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../components/ui/dialog';
import { Calendar } from '../components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover';
import { 
  MapPin, Phone, User, Unlock, Calendar as CalendarIcon,
  ArrowLeft, Home, Building, ChevronLeft, ChevronRight, Shield, Coins
} from 'lucide-react';
import { toast } from 'sonner';

export function PropertyDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated, refreshUser } = useAuth();
  
  const [property, setProperty] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [unlocking, setUnlocking] = useState(false);
  
  const [showInspectionDialog, setShowInspectionDialog] = useState(false);
  const [inspectionDate, setInspectionDate] = useState('');
  const [inspectionEmail, setInspectionEmail] = useState('');
  const [inspectionPhone, setInspectionPhone] = useState('');
  const [requestingInspection, setRequestingInspection] = useState(false);

  useEffect(() => {
    fetchProperty();
  }, [id, isAuthenticated]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchProperty = async () => {
    setLoading(true);
    try {
      let response;
      if (isAuthenticated && user) {
        response = await propertyAPI.getById(id, user.id);
      } else {
        response = await propertyAPI.getPublic(id);
      }
      setProperty(response.data);
    } catch (error) {
      toast.error('Property not found');
      navigate('/browse');
    } finally {
      setLoading(false);
    }
  };

  const handleUnlock = async () => {
    if (!isAuthenticated) { toast.error('Please login to unlock contact'); navigate('/login'); return; }
    if ((user?.token_balance || 0) < 1) { toast.error('Insufficient tokens. Please buy more.'); navigate('/buy-tokens'); return; }
    setUnlocking(true);
    try {
      const response = await propertyAPI.unlock(id, user.id);
      toast.success('Contact unlocked!');
      setProperty({ ...property, contact_unlocked: true, contact_phone: response.data.contact_phone });
      await refreshUser();
    } catch (error) {
      toast.error(error.message || 'Failed to unlock contact');
    } finally {
      setUnlocking(false);
    }
  };

  const handleRequestInspection = async () => {
    if (!inspectionDate || inspectionDate === '') { toast.error('Please select an inspection date'); return; }
    if (!inspectionEmail || !inspectionPhone) { toast.error('Please fill in all fields'); return; }

    setRequestingInspection(true);
    try {
      const response = await inspectionAPI.request({
        property_id: id,
        inspection_date: inspectionDate,
        email: inspectionEmail,
        phone_number: inspectionPhone,
      }, user);

      const { reference } = response.data;
      setShowInspectionDialog(false);

      await openKorapayCheckout({
        reference, amount: 2000, email: inspectionEmail,
        name: user?.full_name || user?.email,
        narration: `Inspection Fee — ${property?.title}`,
        onSuccess: () => { toast.success('Payment confirmed! Inspection scheduled. The agent will contact you soon.'); setRequestingInspection(false); },
        onFailed: () => { toast.error('Payment was not successful. Please try again.'); setRequestingInspection(false); },
        onClose: () => { setRequestingInspection(false); },
      });
    } catch (error) {
      toast.error(error.message || 'Failed to request inspection');
    } finally {
      setRequestingInspection(false);
    }
  };

  const formatPrice = (price) => new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 0 }).format(price);
  const nextImage = () => property?.images?.length > 1 && setCurrentImageIndex(p => (p + 1) % property.images.length);
  const prevImage = () => property?.images?.length > 1 && setCurrentImageIndex(p => (p - 1 + property.images.length) % property.images.length);

  const tomorrow = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(0, 0, 0, 0);
    return d.toISOString().split('T')[0];
  })();

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="animate-pulse">
          <div className="h-72 md:h-[480px] bg-muted w-full" />
          <div className="container mx-auto px-4 py-6 space-y-4">
            <div className="h-8 bg-muted rounded w-2/3" />
            <div className="h-5 bg-muted rounded w-1/3" />
            <div className="h-24 bg-muted rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (!property) return null;

  const TypeIcon = property.property_type === 'hostel' ? Home : Building;
  const images = property.images?.length > 0 ? property.images : ['https://images.pexels.com/photos/3754595/pexels-photo-3754595.jpeg'];

  return (
    <div className="min-h-screen bg-background" data-testid="property-details-page">

      {/* ── Hero Image ── */}
      <div className="relative w-full h-72 md:h-[480px] bg-black overflow-hidden">
        <img
          src={images[currentImageIndex]}
          alt={property.title}
          className="w-full h-full object-cover opacity-90 transition-all duration-500"
        />

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-black/30" />

        {/* Back button */}
        <button
          onClick={() => navigate('/browse')}
          className="absolute top-4 left-4 flex items-center gap-1.5 bg-black/40 hover:bg-black/60 backdrop-blur-sm text-white px-3 py-2 rounded-full text-sm font-medium transition-all"
          data-testid="back-btn"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>

        {/* Type badge */}
        <div className="absolute top-4 right-4 flex items-center gap-1.5 bg-primary text-primary-foreground px-3 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wide">
          <TypeIcon className="w-3.5 h-3.5" />
          {property.property_type}
        </div>

        {/* Image navigation */}
        {images.length > 1 && (
          <>
            <button onClick={prevImage} className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 bg-black/40 hover:bg-black/70 backdrop-blur-sm text-white rounded-full flex items-center justify-center transition-all" data-testid="prev-image">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button onClick={nextImage} className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 bg-black/40 hover:bg-black/70 backdrop-blur-sm text-white rounded-full flex items-center justify-center transition-all" data-testid="next-image">
              <ChevronRight className="w-5 h-5" />
            </button>
            {/* Dot indicators */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5">
              {images.map((_, i) => (
                <button key={i} onClick={() => setCurrentImageIndex(i)}
                  className={`w-2 h-2 rounded-full transition-all ${i === currentImageIndex ? 'bg-white scale-125' : 'bg-white/50'}`}
                />
              ))}
            </div>
          </>
        )}

        {/* Title overlay at bottom of hero */}
        <div className="absolute bottom-0 left-0 right-0 p-4 md:p-6">
          <h1 className="text-white text-2xl md:text-3xl font-bold leading-tight drop-shadow">{property.title}</h1>
          <div className="flex items-center gap-1.5 mt-1 text-white/80 text-sm">
            <MapPin className="w-4 h-4" />
            <span>{property.location}</span>
          </div>
        </div>
      </div>

      {/* ── Thumbnail strip ── */}
      {images.length > 1 && (
        <div className="flex gap-2 px-4 py-3 overflow-x-auto scrollbar-hide bg-background border-b">
          {images.map((img, i) => (
            <button key={i} onClick={() => setCurrentImageIndex(i)}
              className={`shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all ${i === currentImageIndex ? 'border-primary' : 'border-transparent opacity-50'}`}
            >
              <img src={img} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}

      {/* ── Main content ── */}
      <div className="container mx-auto px-4 py-6 max-w-5xl">
        <div className="flex flex-col lg:flex-row gap-6">

          {/* Left: details — grows to fill space */}
          <div className="flex-1 min-w-0 space-y-5">

            {/* Price + type row */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="inline-flex items-baseline gap-1.5 bg-primary/10 border border-primary/20 rounded-2xl px-5 py-2.5">
                <span className="text-4xl font-black text-primary">{formatPrice(property.price)}</span>
                <span className="text-sm text-muted-foreground font-medium">/year</span>
              </div>
            </div>

            {/* Description */}
            <div className="bg-muted/40 rounded-2xl p-5 border border-border/50">
              <h2 className="font-semibold text-base mb-3 flex items-center gap-2">
                <span className="w-1 h-4 bg-primary rounded-full inline-block" />
                About this property
              </h2>
              <p className="text-muted-foreground text-sm leading-relaxed whitespace-pre-wrap">{property.description || 'No description provided.'}</p>
            </div>

            {/* Listed by */}
            {property.uploaded_by_agent_name && (
              <div className="flex items-center gap-3 p-4 bg-muted/30 rounded-2xl border border-border/50">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Shield className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Listed by</p>
                  <p className="font-semibold text-sm">{property.uploaded_by_agent_name}</p>
                  <p className="text-xs text-primary font-medium">✓ Verified Agent</p>
                </div>
              </div>
            )}
          </div>

          {/* Right: sticky action sidebar */}
          <div className="w-full lg:w-80 shrink-0 space-y-4 lg:sticky lg:top-20 lg:self-start">

            {/* Contact card */}
            <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
              <div className="bg-primary/5 border-b border-border/50 px-5 py-3">
                <h3 className="font-semibold text-sm">Owner Contact</h3>
              </div>
              <div className="p-5 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <User className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">{property.contact_name}</p>
                    <p className="text-xs text-muted-foreground">Property Owner</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Phone className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    {property.contact_unlocked || property.contact_phone !== '***LOCKED***' ? (
                      <a href={`tel:${property.contact_phone}`} className="font-bold text-primary hover:underline text-base">
                        {property.contact_phone}
                      </a>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground text-sm blur-[3px] select-none">08012345678</span>
                        <span className="text-xs bg-muted px-2 py-0.5 rounded-full">Locked</span>
                      </div>
                    )}
                  </div>
                </div>

                {(!property.contact_unlocked && property.contact_phone === '***LOCKED***') && (
                  <Button onClick={handleUnlock} disabled={unlocking} className="w-full gap-2 rounded-xl h-11" data-testid="unlock-btn">
                    {unlocking ? 'Unlocking...' : <><Unlock className="w-4 h-4" />Unlock Contact — 1 Token</>}
                  </Button>
                )}

                {property.contact_unlocked && (
                  <div className="flex items-center justify-center gap-2 py-1 text-green-600 text-sm font-medium">
                    <Unlock className="w-4 h-4" />
                    Contact Unlocked
                  </div>
                )}

                {!isAuthenticated && (
                  <p className="text-center text-xs text-muted-foreground">
                    <button onClick={() => navigate('/login')} className="text-primary hover:underline font-medium">Login</button>
                    {' '}to unlock contact details
                  </p>
                )}
              </div>
            </div>

            {/* Token balance */}
            {isAuthenticated && (
              <div className="flex items-center justify-between px-4 py-2.5 bg-muted/40 rounded-xl border border-border/50 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Coins className="w-4 h-4" />
                  <span>Your balance</span>
                </div>
                <span className="font-bold text-primary">{user?.token_balance || 0} tokens</span>
              </div>
            )}

            {/* Inspection card */}
            <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
              <div className="bg-primary/5 border-b border-border/50 px-5 py-3">
                <h3 className="font-semibold text-sm">Book Inspection</h3>
              </div>
              <div className="p-5">
                <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
                  Schedule a physical visit with our verified agent. A one-time fee of <span className="font-semibold text-foreground">₦2,000</span> is required.
                </p>
                <Button
                  variant="outline"
                  onClick={() => {
                    if (!isAuthenticated) { toast.error('Please login to request inspection'); navigate('/login'); return; }
                    setInspectionEmail(user?.email || '');
                    setShowInspectionDialog(true);
                  }}
                  className="w-full gap-2 rounded-xl h-11 border-primary/40 text-primary hover:bg-primary hover:text-primary-foreground transition-all"
                  data-testid="request-inspection-btn"
                >
                  <CalendarIcon className="w-4 h-4" />
                  Schedule Inspection
                </Button>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* ── Inspection Dialog ── */}
      <Dialog open={showInspectionDialog} onOpenChange={setShowInspectionDialog}>
        <DialogContent className="w-[calc(100vw-32px)] max-w-sm mx-auto rounded-2xl p-0 overflow-hidden gap-0">

          {/* Header */}
          <div className="bg-primary px-5 py-4">
            <DialogTitle className="text-white text-base font-bold">Book Inspection</DialogTitle>
            <DialogDescription className="text-primary-foreground/80 text-xs mt-0.5 truncate">
              {property.title}
            </DialogDescription>
          </div>

          <div className="px-5 py-4 space-y-3">

            {/* Date */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Date</label>
              <input
                type="date"
                value={inspectionDate}
                min={tomorrow}
                onChange={(e) => setInspectionDate(e.target.value)}
                className="w-full h-11 px-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer"
                data-testid="inspection-date-picker"
              />
              {inspectionDate && (
                <p className="text-xs text-primary font-medium">
                  ✓ {new Date(inspectionDate + 'T00:00:00').toLocaleDateString('en-NG', { weekday: 'long', day: 'numeric', month: 'long' })}
                </p>
              )}
            </div>

            {/* Email */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Email</label>
              <Input
                type="email"
                value={inspectionEmail}
                onChange={(e) => setInspectionEmail(e.target.value)}
                placeholder="your@email.com"
                className="h-11 rounded-xl"
                data-testid="inspection-email"
              />
            </div>

            {/* Phone */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Phone</label>
              <Input
                type="tel"
                value={inspectionPhone}
                onChange={(e) => setInspectionPhone(e.target.value)}
                placeholder="080XXXXXXXX"
                className="h-11 rounded-xl"
                data-testid="inspection-phone"
              />
            </div>

            {/* Fee summary */}
            <div className="flex items-center justify-between bg-muted/50 rounded-xl px-4 py-3 mt-1">
              <span className="text-sm text-muted-foreground">Inspection Fee</span>
              <span className="text-lg font-black text-primary">₦2,000</span>
            </div>
          </div>

          {/* Footer buttons */}
          <div className="flex gap-2 px-5 pb-5">
            <Button variant="outline" onClick={() => setShowInspectionDialog(false)} className="flex-1 rounded-xl h-11">
              Cancel
            </Button>
            <Button onClick={handleRequestInspection} disabled={requestingInspection} className="flex-1 rounded-xl h-11 gap-2" data-testid="confirm-inspection-btn">
              {requestingInspection ? 'Opening...' : '💳 Pay & Schedule'}
            </Button>
          </div>

        </DialogContent>
      </Dialog>

    </div>
  );
}

export default PropertyDetails;
