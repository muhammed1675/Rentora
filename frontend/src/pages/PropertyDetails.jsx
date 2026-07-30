import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { propertyAPI, inspectionAPI, reviewAPI, rentAPI, reportAPI } from '../lib/api';
import { openFlutterwaveCheckout } from '../lib/flutterwave';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../components/ui/dialog';
import { 
  MapPin, Phone, User, Lock, Calendar as CalendarIcon, ArrowLeft,
  Home, Building, ChevronLeft, ChevronRight, ExternalLink, Heart, Share2,
  Check, CheckCircle2, Eye, GitCompare, Star, Send, Flag,
} from 'lucide-react';
import { toast } from 'sonner';

function getFavourites() {
  try { return JSON.parse(localStorage.getItem('rentora_favourites') || '[]'); }
  catch { return []; }
}
function toggleFavourite(id) {
  const favs = getFavourites();
  const idx = favs.indexOf(id);
  if (idx === -1) { favs.push(id); } else { favs.splice(idx, 1); }
  localStorage.setItem('rentora_favourites', JSON.stringify(favs));
  return idx === -1;
}

function trackRecentlyViewed(property) {
  try {
    const key = 'rentora_recently_viewed';
    const existing = JSON.parse(localStorage.getItem(key) || '[]');
    const filtered = existing.filter(p => p.id !== property.id);
    const updated = [{
      id: property.id, title: property.title, location: property.location,
      price: property.price, image: property.images?.[0] || null,
      property_type: property.property_type,
    }, ...filtered].slice(0, 10);
    localStorage.setItem(key, JSON.stringify(updated));
  } catch {}
}

function getCompareList() {
  try { return JSON.parse(localStorage.getItem('rentora_compare') || '[]'); }
  catch { return []; }
}
function toggleCompare(property) {
  const list = getCompareList();
  const idx = list.findIndex(p => p.id === property.id);
  if (idx !== -1) {
    list.splice(idx, 1);
    localStorage.setItem('rentora_compare', JSON.stringify(list));
    return { added: false, full: false };
  }
  if (list.length >= 2) return { added: false, full: true };
  list.push({ id: property.id, title: property.title, location: property.location, price: property.price, image: property.images?.[0] || null, property_type: property.property_type });
  localStorage.setItem('rentora_compare', JSON.stringify(list));
  return { added: true, full: false };
}

export function PropertyDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated, refreshUser } = useAuth();
  
  const [property, setProperty] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isFavourited, setIsFavourited] = useState(false);
  const [copied, setCopied] = useState(false);
  const [inCompare, setInCompare] = useState(false);
  const [similarProperties, setSimilarProperties] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [hoverRating, setHoverRating] = useState(0);
  
  const [showInspectionDialog, setShowInspectionDialog] = useState(false);
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportDetails, setReportDetails] = useState('');
  const [submittingReport, setSubmittingReport] = useState(false);

  const REPORT_REASONS = [
    'This looks like a scam',
    'Property is already rented / unavailable',
    'Misleading photos or description',
    'Agent unresponsive or unprofessional',
    'Inappropriate content',
    'Other',
  ];

  const handleSubmitReport = async () => {
    if (!isAuthenticated) { toast.error('Please login to report a listing'); navigate('/login'); return; }
    if (!reportReason) { toast.error('Please select a reason'); return; }

    setSubmittingReport(true);
    try {
      await reportAPI.submit({ property_id: id, reason: reportReason, details: reportDetails.trim() }, user);
      toast.success('Thanks — our team will review this listing.');
      setShowReportDialog(false);
      setReportReason('');
      setReportDetails('');
    } catch (err) {
      toast.error(err.message || 'Failed to submit report');
    } finally {
      setSubmittingReport(false);
    }
  };
  const [inspectionDate, setInspectionDate] = useState(null);
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
      trackRecentlyViewed(response.data);
      setIsFavourited(getFavourites().includes(id));
      setInCompare(getCompareList().some(p => p.id === id));
      try {
        const sim = await propertyAPI.getSimilar(id, response.data.property_type, response.data.location);
        setSimilarProperties(sim.data || []);
      } catch {}
      try {
        const rev = await reviewAPI.getByProperty(id);
        setReviews(rev.data || []);
      } catch {}
    } catch (error) {
      console.error('Failed to fetch property:', error);
      toast.error('Property not found');
      navigate('/browse');
    } finally {
      setLoading(false);
    }
  };

  

  const handleFavourite = () => {
    const added = toggleFavourite(id);
    setIsFavourited(added);
    toast.success(added ? '❤️ Added to favourites' : 'Removed from favourites');
  };

  const handleShare = async () => {
    const url = window.location.href;
    const text = `Check out this property on Rentora: ${property?.title} — ${property?.location}`;
    if (navigator.share) {
      try { await navigator.share({ title: property?.title, text, url }); } catch {}
    } else {
      try {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        toast.success('Link copied to clipboard!');
        setTimeout(() => setCopied(false), 3000);
      } catch { toast.error('Could not copy link'); }
    }
  };

  const handleCompare = () => {
    const result = toggleCompare(property);
    if (result.full) { toast.error('You can only compare 2 properties. Remove one first.'); return; }
    setInCompare(result.added);
    if (result.added) {
      const list = getCompareList();
      if (list.length === 2) {
        toast.success('2 properties selected! Click Compare to view side by side.', {
          action: { label: 'Compare Now', onClick: () => navigate('/compare') }
        });
      } else {
        toast.success('Added to compare. Select one more property.');
      }
    } else {
      toast.success('Removed from compare');
    }
  };

  const handleSubmitReview = async () => {
    if (!isAuthenticated) { toast.error('Please login to leave a review'); navigate('/login'); return; }
    if (reviewRating === 0) { toast.error('Please select a star rating'); return; }
    if (!reviewComment.trim()) { toast.error('Please write a comment'); return; }
    setSubmittingReview(true);
    try {
      await reviewAPI.submit({ property_id: id, rating: reviewRating, comment: reviewComment.trim() }, user);
      toast.success('Review submitted!');
      setReviewRating(0);
      setReviewComment('');
      const rev = await reviewAPI.getByProperty(id);
      setReviews(rev.data || []);
    } catch (error) {
      toast.error(error.message || 'Failed to submit review');
    } finally {
      setSubmittingReview(false);
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

      setShowInspectionDialog(false);

      await openFlutterwaveCheckout({
        reference: response.data.reference,
        amount: response.data.amount,
        email: inspectionEmail,
        name: user?.full_name || user?.email,
        narration: `Inspection — ${property?.title}`,
        onSuccess: async () => {
          toast.success('Inspection booked! Our agent will contact you shortly.');
          setRequestingInspection(false);
          // Note: the agent + student inspection emails are already sent by
          // paymentAPI.confirmPayment() (called automatically inside
          // openFlutterwaveCheckout's onSuccess in flutterwave.js) — do not send a
          // second notification here, that was causing duplicate emails.
        },
        onFailed: () => {
          toast.error('Payment was not successful. Please try again.');
          setRequestingInspection(false);
        },
        onClose: () => {
          setRequestingInspection(false);
        },
      });

    } catch (error) {
      toast.error(error.message || 'Failed to request inspection');
      setRequestingInspection(false);
    }
  };

  const [payingRent, setPayingRent] = useState(false);
  const [serviceFeePct, setServiceFeePct] = useState(5);

  useEffect(() => {
    rentAPI.getServiceFeePct().then(setServiceFeePct).catch(() => {});
  }, []);
  const handlePayRent = async () => {
    if (!user) { toast.error('Please log in first'); return; }
    if (property?.availability === 'unavailable') { toast.error('This property is no longer available'); return; }
    setPayingRent(true);
    try {
      const res = await rentAPI.initiate(id, user);
      const { openFlutterwaveCheckout } = await import('../lib/flutterwave');
      await openFlutterwaveCheckout({
        reference: res.data.reference,
        amount: res.data.amount,
        email: user.email,
        name: user?.full_name || user?.email,
        narration: `Rent (held by Rentora) — ${property?.title}`,
        onSuccess: async (kref) => {
          try { await rentAPI.markHeld(res.data.reference, kref); } catch (_) {}
          toast.success('Rent held by Rentora. Confirm move-in from your profile to release funds.');
          setPayingRent(false);
        },
        onFailed: () => { toast.error('Payment failed. Please try again.'); setPayingRent(false); },
        onClose: () => setPayingRent(false),
      });
    } catch (e) {
      toast.error(e.message || 'Failed to start rent payment');
      setPayingRent(false);
    }
  };

  const formatPrice = (price) => new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 0 }).format(price);
  const nextImage = () => { if (property?.images?.length > 1) setCurrentImageIndex((prev) => (prev + 1) % property.images.length); };
  const prevImage = () => { if (property?.images?.length > 1) setCurrentImageIndex((prev) => (prev - 1 + property.images.length) % property.images.length); };

  const tomorrow = (() => {
    const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(0, 0, 0, 0);
    return d.toISOString().split('T')[0];
  })();

  if (loading) {
    return (
      <div className="w-full max-w-full overflow-x-hidden px-3 py-4 sm:px-6 sm:py-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-muted rounded w-32" />
          <div className="aspect-video bg-muted rounded-xl" />
          <div className="h-10 bg-muted rounded w-2/3" />
          <div className="h-6 bg-muted rounded w-1/3" />
        </div>
      </div>
    );
  }

  if (!property) return null;

  const TypeIcon = property.property_type === 'hostel' ? Home : Building;

  return (
    <div className="w-full max-w-full overflow-x-hidden px-3 py-4 sm:px-6 sm:py-6" data-testid="property-details-page">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 mb-4">
        <Button variant="ghost" onClick={() => navigate('/browse')} className="min-w-0 justify-start gap-2 px-2 text-xs sm:text-sm" data-testid="back-btn">
          <ArrowLeft className="w-4 h-4 shrink-0" /> <span className="truncate">Back to Browse</span>
        </Button>
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <Button variant="outline" size="sm" onClick={handleCompare}
            className={`h-9 w-9 shrink-0 gap-1.5 px-0 text-xs sm:w-auto sm:px-3 ${inCompare ? 'bg-blue-50 border-blue-300 text-blue-600 hover:bg-blue-100' : ''}`}>
            <GitCompare className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{inCompare ? 'In Compare' : 'Compare'}</span>
          </Button>
          <Button variant="outline" size="icon" onClick={handleShare} className="h-9 w-9 shrink-0 rounded-full">
            {copied ? <Check className="w-4 h-4 text-green-500" /> : <Share2 className="w-4 h-4" />}
          </Button>
          <Button variant="outline" size="icon" onClick={handleFavourite}
            className={`h-9 w-9 shrink-0 rounded-full ${isFavourited ? 'bg-red-50 border-red-200 hover:bg-red-100' : ''}`}>
            <Heart className={`w-4 h-4 ${isFavourited ? 'fill-red-500 text-red-500' : ''}`} />
          </Button>
          <Button variant="outline" size="icon" onClick={() => setShowReportDialog(true)}
            className="h-9 w-9 shrink-0 rounded-full text-muted-foreground hover:text-destructive hover:border-destructive"
            data-testid="report-listing-btn" title="Report this listing">
            <Flag className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)] lg:gap-8">
        <div className="min-w-0 space-y-5 sm:space-y-6">
          {/* Image Gallery */}
          <div className="relative aspect-video w-full max-w-full overflow-hidden rounded-xl group">
            <img src={property.images?.[currentImageIndex] || 'https://images.pexels.com/photos/3754595/pexels-photo-3754595.jpeg'}
              alt={property.title} className="w-full h-full object-cover" />
            {property.images?.length > 1 && (
              <>
                <Button variant="secondary" size="icon" onClick={prevImage}
                  className="absolute left-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <ChevronLeft className="w-5 h-5" />
                </Button>
                <Button variant="secondary" size="icon" onClick={nextImage}
                  className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <ChevronRight className="w-5 h-5" />
                </Button>
              </>
            )}
            {property.images?.length > 1 && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/50 text-white px-3 py-1 rounded-full text-sm">
                {currentImageIndex + 1} / {property.images.length}
              </div>
            )}
            <Badge className="absolute top-4 left-4 gap-1"><TypeIcon className="w-3 h-3" />{property.property_type}</Badge>
            {property.views > 0 && (
              <div className="absolute bottom-4 right-4 bg-black/50 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
                <Eye className="w-3 h-3" />{property.views} {property.views === 1 ? 'view' : 'views'}
              </div>
            )}
            {isFavourited && (
              <div className="absolute top-4 right-4 bg-red-500 text-white text-xs px-2 py-1 rounded-full font-medium flex items-center gap-1">
                <Heart className="w-3 h-3 fill-white" /> Saved
              </div>
            )}
          </div>

          {property.images?.length > 1 && (
            <div className="flex max-w-full gap-2 overflow-x-auto pb-1 scrollbar-hide">
              {property.images.map((img, index) => (
                <button key={index} onClick={() => setCurrentImageIndex(index)}
                  className={`shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 transition-all ${index === currentImageIndex ? 'border-primary' : 'border-transparent opacity-60'}`}>
                  <img src={img} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}

          <div>
            <h1 className="break-words text-2xl font-bold tracking-tight sm:text-3xl">{property.title}</h1>
            <div className="flex items-center gap-2 mt-2 text-muted-foreground flex-wrap">
              <MapPin className="w-5 h-5 shrink-0" /><span className="min-w-0 break-words">{property.location}</span>
            </div>
            {property.address && (
              <p className="mt-1 text-sm text-muted-foreground break-words">{property.address}</p>
            )}
            {property.google_maps_link && (
              <a
                href={property.google_maps_link}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex max-w-full items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 sm:px-4"
              >
                <MapPin className="h-4 w-4 shrink-0" /><span className="min-w-0 truncate">Get Directions on Google Maps</span>
              </a>
            )}
          </div>

          <Card className="max-w-full overflow-hidden p-4 sm:p-6">
            <h2 className="text-xl font-semibold mb-4">Description</h2>
            <p className="whitespace-pre-wrap break-words text-muted-foreground">{property.description}</p>
          </Card>

          {property.amenities?.length > 0 && (
            <Card className="max-w-full overflow-hidden p-4 sm:p-6">
              <h2 className="text-xl font-semibold mb-4">Amenities</h2>
              <div className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2 sm:grid-cols-3">
                {property.amenities.map((item) => (
                  <div key={item} className="flex min-w-0 items-center gap-2 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                    <span className="min-w-0 break-words">{item}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {similarProperties.length > 0 && (
            <div>
              <h2 className="text-xl font-semibold mb-4">Similar Properties</h2>
              <div className="grid sm:grid-cols-2 gap-4">
                {similarProperties.map(sim => (
                  <div key={sim.id} onClick={() => navigate(`/property/${sim.id}`)}
                    className="flex min-w-0 cursor-pointer gap-3 rounded-xl border border-border bg-card p-3 transition-shadow hover:shadow-md group">
                    <div className="w-20 h-20 rounded-lg overflow-hidden shrink-0 bg-muted">
                      <img src={sim.images?.[0] || 'https://images.pexels.com/photos/3754595/pexels-photo-3754595.jpeg'}
                        alt={sim.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm line-clamp-1">{sim.title}</p>
                      <div className="flex items-center gap-1 mt-0.5 text-muted-foreground">
                        <MapPin className="w-3 h-3 shrink-0" /><span className="text-xs line-clamp-1">{sim.location}</span>
                      </div>
                      <p className="text-primary font-bold text-sm mt-1">{formatPrice(sim.price)}<span className="text-xs text-muted-foreground font-normal">/yr</span></p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Reviews */}
          <div>
            <h2 className="text-xl font-semibold mb-4">
              Student Reviews
              {reviews.length > 0 && (
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  ({reviews.length} {reviews.length === 1 ? 'review' : 'reviews'} · {(reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)} ★)
                </span>
              )}
            </h2>
            {isAuthenticated && (
              <Card className="mb-4 max-w-full overflow-hidden p-4">
                <p className="text-sm font-medium mb-2">Leave a Review</p>
                <div className="mb-3 flex flex-wrap gap-1">
                  {[1,2,3,4,5].map(star => (
                    <button key={star} type="button" onClick={() => setReviewRating(star)}
                      onMouseEnter={() => setHoverRating(star)} onMouseLeave={() => setHoverRating(0)}
                      className="transition-transform hover:scale-110">
                      <Star className={`w-7 h-7 ${(hoverRating || reviewRating) >= star ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/30'}`} />
                    </button>
                  ))}
                  {reviewRating > 0 && (
                    <span className="text-sm text-muted-foreground ml-2 self-center">
                      {['','Poor','Fair','Good','Very Good','Excellent'][reviewRating]}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                  <Input placeholder="Share your experience..." value={reviewComment}
                    onChange={(e) => setReviewComment(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSubmitReview()} className="min-w-0" />
                  <Button size="icon" onClick={handleSubmitReview} disabled={submittingReview}>
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </Card>
            )}
            {reviews.length > 0 ? (
              <div className="min-w-0 space-y-3">
                {reviews.map(review => (
                  <Card key={review.id} className="max-w-full overflow-hidden p-4">
                    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <span className="text-xs font-bold text-primary">{(review.user_name || 'A').charAt(0).toUpperCase()}</span>
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">{review.user_name || 'Anonymous'}</p>
                          <div className="flex gap-0.5 mt-0.5">
                            {[1,2,3,4,5].map(s => (
                              <Star key={s} className={`w-3 h-3 ${review.rating >= s ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/20'}`} />
                            ))}
                          </div>
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {new Date(review.created_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                    </div>
                    <p className="mt-2 break-words text-sm leading-relaxed text-muted-foreground">{review.comment}</p>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="max-w-full overflow-hidden border-dashed p-4 text-center sm:p-6">
                <Star className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No reviews yet. Be the first to review!</p>
              </Card>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="min-w-0 space-y-5 sm:space-y-6">
          <Card className="max-w-full overflow-hidden p-4 sm:p-6">
            <p className="text-sm text-muted-foreground">Annual Rent</p>
            <p className="text-3xl sm:text-4xl font-bold text-primary mt-1 break-words">{formatPrice(property.price)}</p>
            <p className="text-sm text-muted-foreground">/year</p>
            {(property.caution_fee || property.price) && (
              <div className="mt-4 pt-4 border-t border-border/60 space-y-2">
                {property.caution_fee > 0 && (
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                  <p className="text-sm text-muted-foreground min-w-0">Caution Fee</p>
                  <p className="text-sm font-semibold shrink-0">{formatPrice(property.caution_fee)}</p>
                </div>
                )}
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                  <p className="text-sm text-muted-foreground min-w-0">Agent Fee <span className="text-xs">(10% of rent)</span></p>
                  <p className="text-sm font-semibold shrink-0">{formatPrice(Math.round(Number(property.price || 0) * 0.10))}</p>
                </div>
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2 border-t border-border/40 pt-2">
                  <p className="text-sm font-semibold min-w-0">Total Move-in Cost <span className="text-xs font-normal text-muted-foreground block sm:inline">(+ small service fee at checkout)</span></p>
                  <p className="text-sm font-bold text-primary shrink-0">
                    {formatPrice(
                      Number(property.price || 0) +
                      Number(property.caution_fee || 0) +
                      Math.round(Number(property.price || 0) * 0.10)
                    )}
                  </p>
                </div>
                <p className="break-words pt-1 text-xs text-muted-foreground">
                  Rent, agent fee, and caution fee are all held safely by Rentora and released to the listing agent once you confirm move-in.
                </p>
              </div>
            )}
          </Card>

          <Card className="max-w-full overflow-hidden p-4 sm:p-6">
            <div className="mb-4 max-w-full overflow-hidden rounded-lg border bg-muted/30 p-3 sm:p-4">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 mb-2">
                <h3 className="min-w-0 font-semibold">Rent this property</h3>
                {property?.availability === 'unavailable' && (
                  <span className="text-xs px-2 py-0.5 rounded bg-secondary">Taken</span>
                )}
              </div>
              {property?.price > 0 && (() => {
                const rent = Number(property.price);
                const agentFee = Math.round(rent * 0.10);
                const cautionFee = Number(property.caution_fee) || 0;
                const serviceFee = Math.round((rent + agentFee) * (serviceFeePct / 100));
                const total = rent + agentFee + cautionFee + serviceFee;
                return (
                  <div className="text-sm space-y-1 mb-3">
                    <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2"><span className="min-w-0 text-muted-foreground">Rent</span><span className="shrink-0 text-right">{formatPrice(rent)}</span></div>
                    <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2"><span className="min-w-0 text-muted-foreground">Agent fee (10%)</span><span className="shrink-0 text-right">{formatPrice(agentFee)}</span></div>
                    {cautionFee > 0 && (
                      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2"><span className="min-w-0 text-muted-foreground">Caution fee</span><span className="shrink-0 text-right">{formatPrice(cautionFee)}</span></div>
                    )}
                    <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2"><span className="min-w-0 text-muted-foreground">Service fee ({serviceFeePct}%)</span><span className="shrink-0 text-right">{formatPrice(serviceFee)}</span></div>
                    <div className="mt-1 grid grid-cols-[minmax(0,1fr)_auto] gap-2 border-t pt-1.5 font-semibold"><span className="min-w-0">Total to pay</span><span className="shrink-0 text-right text-primary">{formatPrice(total)}</span></div>
                  </div>
                );
              })()}
              <p className="text-xs text-muted-foreground mb-3">
                Rentora holds your rent, agent fee, and caution fee safely until you confirm you've moved in, then releases them to the listing agent.
              </p>
              <Button
                onClick={handlePayRent}
                disabled={payingRent || property?.availability === 'unavailable'}
                className="w-full min-w-0 gap-2"
                data-testid="pay-rent-btn"
              >
                {payingRent ? 'Processing...' : (<><ExternalLink className="h-4 w-4 shrink-0" /><span className="truncate">Pay Rent Securely</span></>)}
              </Button>
            </div>
            <h3 className="font-semibold mb-2">Request Inspection</h3>
            {property?.availability === 'unavailable' ? (
              <p className="text-sm text-muted-foreground mb-4">This property has been taken and is no longer accepting inspection bookings.</p>
            ) : (
              <>
                <p className="text-sm text-muted-foreground mb-4">Schedule a physical visit with our verified agent for {formatPrice(Number(property?.inspection_fee) || 3000)}</p>
                <Button variant="outline" onClick={() => {
                  if (!isAuthenticated) { toast.error('Please login to request inspection'); navigate('/login'); return; }
                  setInspectionEmail(user?.email || '');
                  setShowInspectionDialog(true);
                }} className="w-full min-w-0 gap-2" data-testid="request-inspection-btn">
                  <CalendarIcon className="h-4 w-4 shrink-0" /><span className="truncate">Schedule Inspection</span>
                </Button>
              </>
            )}
          </Card>

          {/* "Listed By" card removed intentionally. */}
        </div>
      </div>

      {/* Inspection Dialog */}
      <Dialog open={showInspectionDialog} onOpenChange={setShowInspectionDialog}>
        <DialogContent className="max-w-[calc(100vw-1.5rem)] overflow-hidden sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Request Property Inspection</DialogTitle>
            <DialogDescription className="break-words">Schedule a physical inspection with our verified agent. Payment of {formatPrice(Number(property?.inspection_fee) || 3000)} is required.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Select Date</label>
              <input type="date" value={inspectionDate || ''} min={tomorrow}
                onChange={(e) => setInspectionDate(e.target.value)}
                className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 cursor-pointer"
                data-testid="inspection-date-picker" />
              {inspectionDate && (
                <p className="text-xs text-primary font-medium">
                  ✓ {new Date(inspectionDate + 'T00:00:00').toLocaleDateString('en-NG', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Email</label>
              <Input type="email" value={inspectionEmail} onChange={(e) => setInspectionEmail(e.target.value)} placeholder="your@email.com" data-testid="inspection-email" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Phone Number</label>
              <Input type="tel" value={inspectionPhone} onChange={(e) => setInspectionPhone(e.target.value)} placeholder="+234..." data-testid="inspection-phone" />
            </div>
            <Card className="p-4 bg-muted/50">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                <span className="font-medium">Inspection Fee</span>
                <span className="shrink-0 text-right text-lg font-bold text-primary sm:text-xl">{formatPrice(Number(property?.inspection_fee) || 3000)}</span>
              </div>
            </Card>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInspectionDialog(false)}>Cancel</Button>
            <Button onClick={handleRequestInspection} disabled={requestingInspection} className="min-w-0 gap-2" data-testid="confirm-inspection-btn">
              {requestingInspection ? 'Processing...' : <><ExternalLink className="h-4 w-4 shrink-0" /><span className="truncate">Pay & Schedule</span></>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showReportDialog} onOpenChange={(open) => { setShowReportDialog(open); if (!open) { setReportReason(''); setReportDetails(''); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Report this listing</DialogTitle>
            <DialogDescription>
              Let us know what's wrong. Our team reviews every report and will take action if needed.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Reason *</label>
              <div className="grid gap-2">
                {REPORT_REASONS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setReportReason(r)}
                    className={`text-left text-sm px-3 py-2 rounded-lg border transition-colors ${reportReason === r ? 'border-primary bg-primary/5 text-primary font-medium' : 'border-border hover:border-primary/40'}`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Additional details (optional)</label>
              <Textarea
                value={reportDetails}
                onChange={(e) => setReportDetails(e.target.value)}
                placeholder="Anything else that would help us look into this..."
                rows={3}
                data-testid="report-details-input"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReportDialog(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={handleSubmitReport}
              disabled={submittingReport || !reportReason}
              data-testid="submit-report-btn"
            >
              {submittingReport ? 'Submitting...' : 'Submit Report'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default PropertyDetails;
