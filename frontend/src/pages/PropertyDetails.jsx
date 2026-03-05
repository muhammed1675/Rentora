import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { propertyAPI, inspectionAPI, reviewAPI } from '../lib/api';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../components/ui/dialog';
import { 
  MapPin, 
  Phone, 
  User, 
  Lock, 
  Unlock, 
  Calendar as CalendarIcon, 
  ArrowLeft,
  Home,
  Building,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Heart,
  Share2,
  Check,
  Eye,
  GitCompare,
  Star,
  Send,
} from 'lucide-react';
import { toast } from 'sonner';


// ── Favourites helpers ───────────────────────────────────────────────────────
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

// ── Recently viewed tracker ──────────────────────────────────────────────────
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

// ── Compare helpers (max 2) ──────────────────────────────────────────────────
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
  const [unlocking, setUnlocking] = useState(false);
  const [isFavourited, setIsFavourited] = useState(false);
  const [copied, setCopied] = useState(false);
  const [inCompare, setInCompare] = useState(false);
  const [similarProperties, setSimilarProperties] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [hoverRating, setHoverRating] = useState(0);
  
  // Inspection dialog
  const [showInspectionDialog, setShowInspectionDialog] = useState(false);
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
      // Load similar properties
      try {
        const sim = await propertyAPI.getSimilar(id, response.data.property_type, response.data.location);
        setSimilarProperties(sim.data || []);
      } catch {}
      // Load reviews
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

  const handleUnlock = async () => {
    if (!isAuthenticated) {
      toast.error('Please login to unlock contact');
      navigate('/login');
      return;
    }

    if ((user?.token_balance || 0) < 1) {
      toast.error('Insufficient tokens. Please buy more tokens.');
      navigate('/buy-tokens');
      return;
    }

    setUnlocking(true);
    try {
      const response = await propertyAPI.unlock(id, user.id);
      toast.success('Contact unlocked successfully!');
      setProperty({
        ...property,
        contact_unlocked: true,
        contact_phone: response.data.contact_phone,
      });
      await refreshUser();
    } catch (error) {
      toast.error(error.message || 'Failed to unlock contact');
    } finally {
      setUnlocking(false);
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
        setTimeout(() => setCopied(false), 2000);
      } catch { toast.error('Could not copy link'); }
    }
  };

  const handleCompare = () => {
    const result = toggleCompare(property);
    if (result.full) {
      toast.error('You can only compare 2 properties. Remove one first.');
      return;
    }
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
    if (!isAuthenticated) {
      toast.error('Please login to leave a review');
      navigate('/login');
      return;
    }
    if (reviewRating === 0) {
      toast.error('Please select a star rating');
      return;
    }
    if (!reviewComment.trim()) {
      toast.error('Please write a comment');
      return;
    }
    setSubmittingReview(true);
    try {
      await reviewAPI.submit({
        property_id: id,
        rating: reviewRating,
        comment: reviewComment.trim(),
      }, user);
      toast.success('Review submitted!');
      setReviewRating(0);
      setReviewComment('');
      // Reload reviews
      const rev = await reviewAPI.getByProperty(id);
      setReviews(rev.data || []);
    } catch (error) {
      toast.error(error.message || 'Failed to submit review');
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleRequestInspection = async () => {
    if (!inspectionDate || inspectionDate === '') {
      toast.error('Please select an inspection date');
      return;
    }
    if (!inspectionEmail || !inspectionPhone) {
      toast.error('Please fill in all fields');
      return;
    }

    setRequestingInspection(true);
    try {
      const response = await inspectionAPI.request({
        property_id: id,
        inspection_date: inspectionDate,
        email: inspectionEmail,
        phone_number: inspectionPhone,
      }, user);
      
      toast.success('Redirecting to payment...');
      setShowInspectionDialog(false);
      
      // Open checkout URL
      if (response.data.checkout_url) {
        window.open(response.data.checkout_url, '_blank');
      }
    } catch (error) {
      toast.error(error.message || 'Failed to request inspection');
    } finally {
      setRequestingInspection(false);
    }
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
    }).format(price);
  };

  const nextImage = () => {
    if (property?.images?.length > 1) {
      setCurrentImageIndex((prev) => (prev + 1) % property.images.length);
    }
  };

  const prevImage = () => {
    if (property?.images?.length > 1) {
      setCurrentImageIndex((prev) => (prev - 1 + property.images.length) % property.images.length);
    }
  };

  const tomorrow = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(0, 0, 0, 0);
    return d.toISOString().split('T')[0];
  })();

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-6">
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
    <div className="container mx-auto px-4 py-6" data-testid="property-details-page">
      {/* Back Button + Actions */}
      <div className="flex items-center justify-between mb-4">
        <Button variant="ghost" onClick={() => navigate('/browse')} className="gap-2" data-testid="back-btn">
          <ArrowLeft className="w-4 h-4" />
          Back to Browse
        </Button>
        <div className="flex items-center gap-2">
          {/* Compare button */}
          <Button
            variant="outline" size="sm"
            onClick={handleCompare}
            className={`gap-1.5 h-9 text-xs ${inCompare ? 'bg-blue-50 border-blue-300 text-blue-600 hover:bg-blue-100' : ''}`}
            title="Add to compare"
          >
            <GitCompare className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{inCompare ? 'In Compare' : 'Compare'}</span>
          </Button>
          {/* Share button */}
          <Button variant="outline" size="icon" onClick={handleShare} className="rounded-full h-9 w-9" title="Share property">
            {copied ? <Check className="w-4 h-4 text-green-500" /> : <Share2 className="w-4 h-4" />}
          </Button>
          {/* Favourite button */}
          <Button
            variant="outline" size="icon" onClick={handleFavourite}
            className={`rounded-full h-9 w-9 transition-all ${isFavourited ? 'bg-red-50 border-red-200 hover:bg-red-100' : ''}`}
            title={isFavourited ? 'Remove from favourites' : 'Save to favourites'}
          >
            <Heart className={`w-4 h-4 ${isFavourited ? 'fill-red-500 text-red-500' : ''}`} />
          </Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Image Gallery */}
          <div className="relative aspect-video rounded-xl overflow-hidden group">
            <img
              src={property.images?.[currentImageIndex] || 'https://images.pexels.com/photos/3754595/pexels-photo-3754595.jpeg'}
              alt={property.title}
              className="w-full h-full object-cover"
            />
            
            {/* Navigation Arrows */}
            {property.images?.length > 1 && (
              <>
                <Button
                  variant="secondary"
                  size="icon"
                  onClick={prevImage}
                  className="absolute left-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity"
                  data-testid="prev-image"
                >
                  <ChevronLeft className="w-5 h-5" />
                </Button>
                <Button
                  variant="secondary"
                  size="icon"
                  onClick={nextImage}
                  className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity"
                  data-testid="next-image"
                >
                  <ChevronRight className="w-5 h-5" />
                </Button>
              </>
            )}

            {/* Image Counter */}
            {property.images?.length > 1 && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/50 text-white px-3 py-1 rounded-full text-sm">
                {currentImageIndex + 1} / {property.images.length}
              </div>
            )}

            {/* Type Badge */}
            <Badge className="absolute top-4 left-4 gap-1">
              <TypeIcon className="w-3 h-3" />
              {property.property_type}
            </Badge>
            {/* View count */}
            {property.views > 0 && (
              <div className="absolute bottom-4 right-4 bg-black/50 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
                <Eye className="w-3 h-3" />
                {property.views} {property.views === 1 ? 'view' : 'views'}
              </div>
            )}
            {/* Saved badge */}
            {isFavourited && (
              <div className="absolute top-4 right-4 bg-red-500 text-white text-xs px-2 py-1 rounded-full font-medium flex items-center gap-1">
                <Heart className="w-3 h-3 fill-white" /> Saved
              </div>
            )}
          </div>

          {/* Thumbnail Strip */}
          {property.images?.length > 1 && (
            <div className="flex gap-2 overflow-x-auto scrollbar-hide">
              {property.images.map((img, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentImageIndex(index)}
                  className={`shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 transition-all ${
                    index === currentImageIndex ? 'border-primary' : 'border-transparent opacity-60'
                  }`}
                >
                  <img src={img} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}

          {/* Property Info */}
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{property.title}</h1>
            <div className="flex items-center gap-2 mt-2 text-muted-foreground">
              <MapPin className="w-5 h-5" />
              <span>{property.location}</span>
            </div>
          </div>

          {/* Description */}
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Description</h2>
            <p className="text-muted-foreground whitespace-pre-wrap">{property.description}</p>
          </Card>

          {/* Similar Properties */}
          {similarProperties.length > 0 && (
            <div>
              <h2 className="text-xl font-semibold mb-4">Similar Properties</h2>
              <div className="grid sm:grid-cols-2 gap-4">
                {similarProperties.map(sim => (
                  <div
                    key={sim.id}
                    onClick={() => navigate(`/property/${sim.id}`)}
                    className="flex gap-3 p-3 rounded-xl border border-border bg-card hover:shadow-md transition-shadow cursor-pointer group"
                  >
                    <div className="w-20 h-20 rounded-lg overflow-hidden shrink-0 bg-muted">
                      <img
                        src={sim.images?.[0] || 'https://images.pexels.com/photos/3754595/pexels-photo-3754595.jpeg'}
                        alt={sim.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm line-clamp-1">{sim.title}</p>
                      <div className="flex items-center gap-1 mt-0.5 text-muted-foreground">
                        <MapPin className="w-3 h-3 shrink-0" />
                        <span className="text-xs line-clamp-1">{sim.location}</span>
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
                  ({reviews.length} {reviews.length === 1 ? 'review' : 'reviews'} · {(reviews.reduce((s,r) => s + r.rating, 0) / reviews.length).toFixed(1)} ★)
                </span>
              )}
            </h2>

            {/* Star input */}
            {isAuthenticated && (
              <Card className="p-4 mb-4">
                <p className="text-sm font-medium mb-2">Leave a Review</p>
                {/* Stars */}
                <div className="flex gap-1 mb-3">
                  {[1,2,3,4,5].map(star => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setReviewRating(star)}
                      onMouseEnter={() => setHoverRating(star)}
                      onMouseLeave={() => setHoverRating(0)}
                      className="transition-transform hover:scale-110"
                    >
                      <Star className={`w-7 h-7 ${(hoverRating || reviewRating) >= star ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/30'}`} />
                    </button>
                  ))}
                  {reviewRating > 0 && (
                    <span className="text-sm text-muted-foreground ml-2 self-center">
                      {['','Poor','Fair','Good','Very Good','Excellent'][reviewRating]}
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="Share your experience..."
                    value={reviewComment}
                    onChange={(e) => setReviewComment(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSubmitReview()}
                    className="flex-1"
                  />
                  <Button size="icon" onClick={handleSubmitReview} disabled={submittingReview}>
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </Card>
            )}

            {/* Review list */}
            {reviews.length > 0 ? (
              <div className="space-y-3">
                {reviews.map(review => (
                  <Card key={review.id} className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <span className="text-xs font-bold text-primary">
                            {(review.user_name || 'A').charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="text-sm font-semibold">{review.user_name || 'Anonymous'}</p>
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
                    <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{review.comment}</p>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="p-6 text-center border-dashed">
                <Star className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No reviews yet. Be the first to review!</p>
              </Card>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Price Card */}
          <Card className="p-6">
            <p className="text-sm text-muted-foreground">Annual Rent</p>
            <p className="text-4xl font-bold text-primary mt-1">{formatPrice(property.price)}</p>
            <p className="text-sm text-muted-foreground">/year</p>
          </Card>

          {/* Contact Card */}
          <Card className="p-6">
            <h3 className="font-semibold mb-4">Owner Contact</h3>
            
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">{property.contact_name}</p>
                  <p className="text-sm text-muted-foreground">Property Owner</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Phone className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1">
                  {property.contact_unlocked || property.contact_phone !== '***LOCKED***' ? (
                    <a 
                      href={`tel:${property.contact_phone}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {property.contact_phone}
                    </a>
                  ) : (
                    <span className="text-muted-foreground">***LOCKED***</span>
                  )}
                </div>
              </div>
            </div>

            {/* Unlock Button */}
            {(!property.contact_unlocked && property.contact_phone === '***LOCKED***') && (
              <Button
                onClick={handleUnlock}
                disabled={unlocking}
                className="w-full mt-4 gap-2"
                data-testid="unlock-btn"
              >
                {unlocking ? (
                  'Unlocking...'
                ) : (
                  <>
                    <Unlock className="w-4 h-4" />
                    Unlock Contact (1 Token)
                  </>
                )}
              </Button>
            )}

            {property.contact_unlocked && (
              <div className="flex items-center gap-2 mt-4 text-secondary">
                <Unlock className="w-4 h-4" />
                <span className="text-sm">Contact Unlocked</span>
              </div>
            )}
          </Card>

          {/* Inspection Card */}
          <Card className="p-6">
            <h3 className="font-semibold mb-2">Request Inspection</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Schedule a physical visit with our verified agent for ₦2,000
            </p>
            <Button
              variant="outline"
              onClick={() => {
                if (!isAuthenticated) {
                  toast.error('Please login to request inspection');
                  navigate('/login');
                  return;
                }
                setInspectionEmail(user?.email || '');
                setShowInspectionDialog(true);
              }}
              className="w-full gap-2"
              data-testid="request-inspection-btn"
            >
              <CalendarIcon className="w-4 h-4" />
              Schedule Inspection
            </Button>
          </Card>

          {/* Agent Info */}
          {property.uploaded_by_agent_name && (
            <Card className="p-6">
              <h3 className="font-semibold mb-2">Listed By</h3>
              <p className="text-muted-foreground">{property.uploaded_by_agent_name}</p>
              <p className="text-xs text-muted-foreground mt-1">Verified Agent</p>
            </Card>
          )}
        </div>
      </div>

      {/* Inspection Dialog */}
      <Dialog open={showInspectionDialog} onOpenChange={setShowInspectionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Property Inspection</DialogTitle>
            <DialogDescription>
              Schedule a physical inspection with our verified agent. Payment of ₦2,000 is required.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Select Date</label>
              <input
                type="date"
                value={inspectionDate || ''}
                min={tomorrow}
                onChange={(e) => setInspectionDate(e.target.value)}
                className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 cursor-pointer"
                data-testid="inspection-date-picker"
              />
              {inspectionDate && (
                <p className="text-xs text-primary font-medium">
                  ✓ {new Date(inspectionDate + 'T00:00:00').toLocaleDateString('en-NG', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Email</label>
              <Input
                type="email"
                value={inspectionEmail}
                onChange={(e) => setInspectionEmail(e.target.value)}
                placeholder="your@email.com"
                data-testid="inspection-email"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Phone Number</label>
              <Input
                type="tel"
                value={inspectionPhone}
                onChange={(e) => setInspectionPhone(e.target.value)}
                placeholder="+234..."
                data-testid="inspection-phone"
              />
            </div>

            <Card className="p-4 bg-muted/50">
              <div className="flex justify-between items-center">
                <span className="font-medium">Inspection Fee</span>
                <span className="text-xl font-bold text-primary">₦2,000</span>
              </div>
            </Card>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInspectionDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleRequestInspection} 
              disabled={requestingInspection}
              className="gap-2"
              data-testid="confirm-inspection-btn"
            >
              {requestingInspection ? 'Processing...' : (
                <>
                  <ExternalLink className="w-4 h-4" />
                  Pay & Schedule
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default PropertyDetails;
