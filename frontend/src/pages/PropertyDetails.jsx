import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { propertyAPI, inspectionAPI } from '../lib/api';
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
  ExternalLink
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
    } catch (error) {
      console.error('Failed to fetch property:', error);
      toast.error('Property not found');
      navigate('/browse');
    } finally {
      setLoading(false);
    }
  };


  // Load Korapay inline SDK
  useEffect(() => {
    if (document.getElementById('korapay-script')) return;
    const script = document.createElement('script');
    script.id = 'korapay-script';
    script.src = 'https://korablobstorage.blob.core.windows.net/modal-bucket/korapay-collections.min.js';
    script.async = true;
    document.body.appendChild(script);
    return () => {
      const el = document.getElementById('korapay-script');
      if (el) document.body.removeChild(el);
    };
  }, []);

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
      
      setShowInspectionDialog(false);

      // Use Korapay inline JS SDK
      const { reference, amount } = response.data;
      const publicKey = process.env.REACT_APP_KORALPAY_PUBLIC_KEY;

      if (window.Korapay) {
        window.Korapay.initialize({
          key: publicKey,
          reference,
          amount,
          currency: 'NGN',
          customer: {
            email: inspectionEmail,
            name: user.full_name,
          },
          onSuccess: (data) => {
            toast.success('Payment successful! Redirecting...');
            navigate(`/payment-callback?reference=${data.reference}&type=inspection`);
          },
          onFailed: () => {
            toast.error('Payment failed. Please try again.');
          },
          onClose: () => {
            toast.info('Payment cancelled.');
          },
        });
      } else {
        // Fallback: redirect to Korapay hosted checkout
        window.location.href = `https://checkout.korapay.com/checkout?amount=${amount}&currency=NGN&reference=${reference}&merchant=${publicKey}&email=${encodeURIComponent(inspectionEmail)}`;
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
      {/* Back Button */}
      <Button
        variant="ghost"
        onClick={() => navigate('/browse')}
        className="mb-4 gap-2"
        data-testid="back-btn"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Browse
      </Button>

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
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Price Card */}
          <Card className="p-6">
            <p className="text-sm text-muted-foreground">Annual Rent</p>
            <p className="text-4xl font-bold text-primary mt-1">{formatPrice(property.price)}</p>
            <p className="text-sm text-muted-foreground">/year</p>
            <div className="mt-3 pt-3 border-t border-border/50 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <p className="text-muted-foreground">Annual Rent</p>
                <p className="font-medium">{formatPrice(property.price)}</p>
              </div>
              <div className="flex items-center justify-between text-sm">
                <p className="text-muted-foreground">Agent Fee</p>
                <p className="font-medium">₦10,000</p>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-border/50">
                <p className="text-sm font-bold">Total Package</p>
                <p className="text-sm font-bold text-primary">{formatPrice(property.price + 10000)}</p>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                * Rent is paid to the landlord. Agent fee of ₦10,000 is paid separately to the agent.
              </p>
            </div>
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
