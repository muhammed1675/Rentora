import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { inspectionAPI, transactionAPI, verificationAPI, paymentAPI, rentAPI, tipAPI, maintenanceAPI, userAPI, storageAPI } from '../lib/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../components/ui/dialog';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { downloadReceiptPNG } from '../lib/receipt';
import { 
  User, 
  Calendar, 
  Receipt, 
  Shield,
  ShieldCheck,
  ShieldAlert,
  Building2,
  Phone,
  Home as HomeIcon,
  CheckCircle2,
  RefreshCw,
  Clock,
  Download,
  Camera,
  Gift,
  X
} from 'lucide-react';
import { toast } from 'sonner';

export function Profile() {
  const navigate = useNavigate();
  const { user, isAuthenticated, refreshUser, isUser, verificationStatus, deleteAccount } = useAuth();
  
  const [viewings, setInspections] = useState([]);
  const [transactions, setTransactions] = useState({ inspection_transactions: [] });
  const [rentPayments, setRentPayments] = useState([]);
  const [tips, setTips] = useState([]);
  const [verificationRequest, setVerificationRequest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [avatarUploading, setAvatarUploading] = useState(false);

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Please choose an image file'); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error('Image must be under 5MB'); return; }

    const previousAvatarUrl = user?.avatar_url;
    setAvatarUploading(true);
    try {
      const { data } = await storageAPI.uploadImage(file, 'avatars', { maxWidthOrHeight: 1000, maxSizeMB: 0.3 });
      await userAPI.updateProfile(user.id, { avatar_url: data.url });
      if (previousAvatarUrl) await storageAPI.deleteImage(previousAvatarUrl, 'avatars');
      await refreshUser();
      toast.success('Profile picture updated');
    } catch (err) {
      toast.error(err.message || 'Failed to upload picture');
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleRemoveAvatar = async () => {
    if (!user?.avatar_url) return;
    const previousAvatarUrl = user.avatar_url;
    setAvatarUploading(true);
    try {
      await userAPI.updateProfile(user.id, { avatar_url: null });
      await storageAPI.deleteImage(previousAvatarUrl, 'avatars');
      await refreshUser();
      toast.success('Profile picture removed');
    } catch (err) {
      toast.error(err.message || 'Failed to remove picture');
    } finally {
      setAvatarUploading(false);
    }
  };

  const [showDeleteAccount, setShowDeleteAccount] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deletingAccount, setDeletingAccount] = useState(false);

  const handleDeleteAccount = async () => {
    setDeletingAccount(true);
    try {
      await deleteAccount();
      toast.success('Your account has been deleted.');
      navigate('/');
    } catch (err) {
      toast.error(err.message || 'Failed to delete account. Please try again or contact support.');
    } finally {
      setDeletingAccount(false);
      setShowDeleteAccount(false);
      setDeleteConfirmText('');
    }
  };

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    fetchData();

    // Auto-confirm payment if redirected back from Flutterwave
    const params = new URLSearchParams(window.location.search);
    const reference = params.get('reference') || params.get('trxref');
    if (reference) {
      paymentAPI.confirmPayment(reference).then(async (res) => {
        if (res?.data?.type === 'inspection') {
          await fetchData();
          toast.success('Inspection payment confirmed!');
        } else if (res?.data?.type === 'tip') {
          await fetchData();
          toast.success('Tip sent to the agent!');
        }
        window.history.replaceState({}, '', window.location.pathname);
      }).catch(() => {});
    }
  }, [isAuthenticated, user]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    maintenanceAPI.expireStalePending(); // fire-and-forget fallback, not awaited
    try {
      const [inspectionsRes, txRes, rentRes, tipsRes] = await Promise.all([
        inspectionAPI.getMyInspections(user.id),
        transactionAPI.getMyTransactions(user.id),
        rentAPI.getMyPayments(user.id).catch(() => ({ data: [] })),
        tipAPI.getMyTips(user.id).catch(() => ({ data: [] })),
      ]);
      
      setInspections(inspectionsRes.data);
      setTransactions(txRes.data);
      setRentPayments(rentRes.data || []);
      setTips(tipsRes.data || []);

      // Check verification request for users
      if (user?.role === 'user') {
        try {
          const verRes = await verificationAPI.getMyRequest(user.id);
          setVerificationRequest(verRes.data);
        } catch (e) {
          // No request yet
        }
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const [moveInDialogPayment, setMoveInDialogPayment] = useState(null);
  const [moveInPhotoFile, setMoveInPhotoFile] = useState(null);
  const [moveInPhotoPreview, setMoveInPhotoPreview] = useState(null);
  const [confirmingMoveIn, setConfirmingMoveIn] = useState(false);

  const [tipDialogViewing, setTipDialogViewing] = useState(null);
  const [tipAmount, setTipAmount] = useState('');
  const [sendingTip, setSendingTip] = useState(false);

  const tipForViewing = (viewingId) => tips.find((t) => t.inspection_id === viewingId && t.status === 'completed');

  const openTipDialog = (viewing) => {
    setTipAmount('');
    setTipDialogViewing(viewing);
  };

  const handleSendTip = async () => {
    if (!tipDialogViewing) return;
    const amt = parseFloat(tipAmount);
    if (!amt || amt <= 0) { toast.error('Enter a valid tip amount'); return; }
    setSendingTip(true);
    try {
      const res = await tipAPI.initiate(tipDialogViewing, amt, user);
      const { openFlutterwaveCheckout } = await import('../lib/flutterwave');
      await openFlutterwaveCheckout({
        reference: res.data.reference,
        amount: res.data.amount,
        email: user.email,
        name: user?.full_name || user?.email,
        narration: `Tip for ${tipDialogViewing.agent_name || 'your agent'} — ${tipDialogViewing.property_title || 'viewing'}`,
        onSuccess: async () => {
          toast.success('Tip sent! Thank you for supporting your agent.');
          setTipDialogViewing(null);
          setSendingTip(false);
          await fetchData();
        },
        onFailed: () => { toast.error('Tip payment failed. Please try again.'); setSendingTip(false); },
        onPending: () => {
          toast.message('Payment received — confirming now. This page will update automatically once confirmed.');
          setSendingTip(false);
          setTipDialogViewing(null);
        },
        onClose: () => setSendingTip(false),
      });
    } catch (e) {
      toast.error(e.message || 'Failed to start tip payment');
      setSendingTip(false);
    }
  };

  const openMoveInDialog = (payment) => {
    setMoveInDialogPayment(payment);
    setMoveInPhotoFile(null);
    setMoveInPhotoPreview(null);
  };

  const handleMoveInPhotoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Mobile camera photos can be 10-20MB+, which is slow or can time out
    // on a weak connection — catch it here with a clear message instead of
    // a confusing failure partway through upload.
    const MAX_SIZE_MB = 8;
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      toast.error(`That photo is too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Please choose one under ${MAX_SIZE_MB}MB — most phones let you pick a smaller size in the camera/gallery app.`);
      return;
    }
    setMoveInPhotoFile(file);
    setMoveInPhotoPreview(URL.createObjectURL(file));
  };

  const handleConfirmMoveIn = async () => {
    if (!moveInDialogPayment) return;
    if (!moveInPhotoFile) { toast.error('Please upload a photo of yourself at the property to confirm move-in'); return; }
    setConfirmingMoveIn(true);
    let uploadedUrl;
    try {
      const uploadRes = await storageAPI.uploadImage(moveInPhotoFile, 'move-in-photos', { maxWidthOrHeight: 1000, maxSizeMB: 0.4 });
      uploadedUrl = uploadRes.data.url;
    } catch (e) {
      toast.error('Could not upload your photo: ' + (e.message || 'unknown error') + '. Please check your connection and try again.');
      setConfirmingMoveIn(false);
      return;
    }
    try {
      await rentAPI.confirmMoveIn(moveInDialogPayment.id, user.id, uploadedUrl);
      toast.success("Move-in reported. Rentora will review your photo and release the rent to the agent shortly.");
      setMoveInDialogPayment(null);
      fetchData();
    } catch (e) {
      toast.error('Photo uploaded, but confirming move-in failed: ' + (e.message || 'unknown error') + '. Please try again — your photo will not need to be re-uploaded if you retry immediately.');
    } finally {
      setConfirmingMoveIn(false);
    }
  };

  const [phoneDraft, setPhoneDraft] = useState(user?.phone || '');
  const [savingPhone, setSavingPhone] = useState(false);

  useEffect(() => { setPhoneDraft(user?.phone || ''); }, [user?.phone]);

  const handleSavePhone = async () => {
    setSavingPhone(true);
    try {
      await userAPI.updateProfile(user.id, { phone: phoneDraft });
      toast.success('Phone number updated');
      await refreshUser();
    } catch (e) {
      toast.error(e.message || 'Failed to update phone number');
    } finally {
      setSavingPhone(false);
    }
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
    }).format(price);
  };

  const getStatusBadge = (status) => {
    const variants = {
      pending: 'bg-yellow-100 text-yellow-800',
      completed: 'bg-green-100 text-green-800',
      assigned: 'bg-blue-100 text-blue-800',
      cancelled: 'bg-red-100 text-red-800',
      approved: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
      failed: 'bg-red-100 text-red-800',
      held: 'bg-yellow-100 text-yellow-800',
      released: 'bg-green-100 text-green-800',
      paid: 'bg-green-100 text-green-800',
      refunded: 'bg-red-100 text-red-800',
    };
    return variants[status] || 'bg-gray-100 text-gray-800';
  };

  if (!isAuthenticated) return null;

  return (
    <div className="container mx-auto py-6" data-testid="profile-page">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">My Profile</h1>
        <p className="text-muted-foreground mt-1">Manage your account and view your activity</p>
      </div>

      {/* User Info */}
      <div className="grid md:grid-cols-3 gap-6 mb-8">
        {/* User Card */}
        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="relative shrink-0" data-testid="profile-avatar-wrapper">
              <label className="block cursor-pointer group" data-testid="profile-avatar-label">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden">
                  {user?.avatar_url ? (
                    <img src={user.avatar_url} alt={user.full_name} className="w-full h-full object-cover" loading="lazy" decoding="async" width="800" height="600" />
                  ) : (
                    <User className="w-8 h-8 text-primary" />
                  )}
                </div>
                <span className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center border-2 border-white group-hover:opacity-90">
                  {avatarUploading ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Camera className="w-3 h-3" />}
                </span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarChange}
                  disabled={avatarUploading}
                  data-testid="profile-avatar-input"
                />
              </label>
              {user?.avatar_url && (
                <button
                  type="button"
                  onClick={handleRemoveAvatar}
                  disabled={avatarUploading}
                  className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-white border border-destructive text-destructive flex items-center justify-center shadow-sm hover:bg-destructive hover:text-white transition-colors"
                  aria-label="Remove profile picture"
                  data-testid="profile-avatar-remove"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
            <div>
              <h2 className="font-semibold text-lg">{user?.full_name}</h2>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
              {user?.phone && (
                <a href={`tel:${user.phone}`} className="text-sm text-primary flex items-center gap-1 mt-0.5 hover:underline">
                  <Phone className="w-3.5 h-3.5" /> {user.phone}
                </a>
              )}
              <Badge variant="outline" className="mt-2 capitalize">
                {user?.role}
              </Badge>
              {isUser && (
                verificationStatus === 'approved' ? (
                  <Badge className="mt-2 ml-1.5 gap-1 bg-green-100 text-green-800 hover:bg-green-100">
                    <ShieldCheck className="w-3 h-3" /> Verified
                  </Badge>
                ) : verificationStatus === 'pending' ? (
                  <Badge className="mt-2 ml-1.5 gap-1 bg-amber-100 text-amber-800 hover:bg-amber-100">
                    <Clock className="w-3 h-3" /> Under review
                  </Badge>
                ) : (
                  <Link to="/verify-account">
                    <Badge className="mt-2 ml-1.5 gap-1 bg-red-100 text-red-800 hover:bg-red-200 cursor-pointer">
                      <ShieldAlert className="w-3 h-3" /> Not verified
                    </Badge>
                  </Link>
                )
              )}
            </div>
          </div>
        </Card>

        {/* Quick Stats */}
        <Card className="p-6">
          <div className="text-center">
            <p className="text-2xl font-bold">{viewings.length}</p>
            <p className="text-xs text-muted-foreground">Viewing Requests</p>
          </div>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="rent" className="w-full">
        <TabsList className="grid w-full grid-cols-4 mb-6">
          <TabsTrigger value="rent" className="gap-2" data-testid="tab-rent">
            <HomeIcon className="w-4 h-4" />
            <span className="hidden sm:inline">Rent &amp; Escrow</span>
          </TabsTrigger>
          <TabsTrigger value="inspections" className="gap-2" data-testid="tab-viewings">
            <Calendar className="w-4 h-4" />
            <span className="hidden sm:inline">Viewing Requests</span>
          </TabsTrigger>
          <TabsTrigger value="transactions" className="gap-2" data-testid="tab-transactions">
            <Receipt className="w-4 h-4" />
            <span className="hidden sm:inline">Transactions</span>
          </TabsTrigger>
          <TabsTrigger value="settings" className="gap-2" data-testid="tab-settings">
            <User className="w-4 h-4" />
            <span className="hidden sm:inline">Settings</span>
          </TabsTrigger>
        </TabsList>

        {/* Rent payments (escrow) */}
        <TabsContent value="rent">
          <h3 className="font-semibold mb-3">Escrow Payment History</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Every rent payment you've made through Rentora, and where it stands — held safely with us, released to the agent, or refunded.
          </p>
          {rentPayments.length > 0 ? (
            <div className="space-y-4">
              {rentPayments.map((rp) => (
                <Card key={rp.id} className="p-4">
                  <div className="flex flex-col sm:flex-row gap-4">
                    <img
                      src={rp.property?.images?.[0] || 'https://images.pexels.com/photos/3754595/pexels-photo-3754595.jpeg?auto=compress&cs=tinysrgb&w=800'}
                      alt=""
                      className="w-24 h-24 rounded-lg object-cover" loading="lazy" decoding="async" width="800" height="600" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold">{rp.property?.title || 'Property'}</h3>
                        {rp.status === 'held' && (
                          <Badge className="gap-1 bg-yellow-100 text-yellow-800 hover:bg-yellow-100"><Clock className="w-3 h-3" />Held by Rentora</Badge>
                        )}
                        {rp.status === 'move_in_reported' && (
                          <Badge className="gap-1 bg-blue-100 text-blue-800 hover:bg-blue-100"><Clock className="w-3 h-3" />Move-in reported — awaiting Rentora review</Badge>
                        )}
                        {rp.status === 'released' && (
                          <Badge className="gap-1 bg-green-100 text-green-800 hover:bg-green-100"><CheckCircle2 className="w-3 h-3" />Released</Badge>
                        )}
                        {rp.status === 'pending' && (
                          <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">Payment pending</Badge>
                        )}
                        {rp.status === 'failed' && (
                          <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Payment failed</Badge>
                        )}
                        {rp.status === 'refunded' && (
                          <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Refunded</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{rp.property?.location}</p>
                      <div className="mt-2 text-sm space-y-0.5">
                        <div>Rent: <span className="font-medium">{formatPrice(rp.rent_amount)}</span></div>
                        {rp.agent_fee > 0 && (
                          <div>Agent fee: <span className="font-medium">{formatPrice(rp.agent_fee)}</span></div>
                        )}
                        {rp.caution_fee > 0 && (
                          <div>Caution fee: <span className="font-medium">{formatPrice(rp.caution_fee)}</span></div>
                        )}
                        <div>Service fee: <span className="font-medium">{formatPrice(rp.service_fee)}</span></div>
                        <div>Total paid: <span className="font-semibold">{formatPrice(rp.total_amount)}</span></div>
                        {rp.status === 'held' && rp.auto_release_at && (
                          <div className="text-xs text-muted-foreground mt-1">
                            Auto-releases on {new Date(rp.auto_release_at).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-start gap-2">
                      {rp.status === 'held' && (
                        <Button
                          size="sm"
                          onClick={() => openMoveInDialog(rp)}
                          className="gap-1"
                          data-testid={`confirm-movein-${rp.id}`}
                        >
                          <CheckCircle2 className="w-4 h-4" />I've moved in
                        </Button>
                      )}
                      {(rp.status === 'pending' || rp.status === 'failed') && rp.property_id && (
                        <Button
                          size="sm"
                          className="gap-1"
                          onClick={() => navigate(`/property/${rp.property_id}`)}
                        >
                          <RefreshCw className="w-4 h-4" />Retry Payment
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="p-8 text-center">
              <HomeIcon className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-semibold">No rent payments yet</h3>
              <p className="text-sm text-muted-foreground mt-2">
                When you pay rent on Rentora, we hold it safely until you confirm you've moved in.
              </p>
            </Card>
          )}
        </TabsContent>

        {/* Viewing Requests */}
        <TabsContent value="inspections">
          {loading ? (
            <div className="space-y-4">
              {[1, 2].map(i => (
                <Card key={i} className="p-4 animate-pulse">
                  <div className="h-20 bg-muted rounded" />
                </Card>
              ))}
            </div>
          ) : viewings.length > 0 ? (
            <div className="space-y-4">
              {viewings.map((viewing) => (
                <Card key={viewing.id} className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold">{viewing.property_title}</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        Scheduled: {viewing.inspection_date}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Agent: {viewing.agent_name || 'To be assigned'}
                      </p>
                    </div>
                    <div className="text-right">
                      <Badge className={getStatusBadge(viewing.status)}>
                        {viewing.status}
                      </Badge>
                      <div className="mt-2">
                        {tipForViewing(viewing.id) ? (
                          <Badge className="gap-1 bg-green-100 text-green-800 hover:bg-green-100">
                            <Gift className="w-3 h-3" /> Tipped {formatPrice(tipForViewing(viewing.id).amount)}
                          </Badge>
                        ) : viewing.agent_id ? (
                          <Button size="sm" variant="outline" className="gap-1" onClick={() => openTipDialog(viewing)}>
                            <Gift className="w-3.5 h-3.5" /> Tip Agent
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="p-8 text-center">
              <Calendar className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-semibold">No Viewing Requests</h3>
              <p className="text-sm text-muted-foreground mt-2">
                Request viewings from property detail pages
              </p>
            </Card>
          )}
        </TabsContent>

        {/* Transactions */}
        <TabsContent value="transactions">
          <div className="space-y-6">
            <div>
              <h3 className="font-semibold mb-4">Rent Payments</h3>
              {rentPayments.length > 0 ? (
                <div className="space-y-3">
                  {rentPayments.map((rp) => (
                    <Card key={rp.id} className="p-4">
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div>
                          <p className="font-medium">{rp.property?.title || 'Property'}</p>
                          <p className="text-sm text-muted-foreground">{rp.reference}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <p className="font-bold text-primary">{formatPrice(rp.total_amount)}</p>
                            <Badge className={
                              rp.status === 'held' ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100'
                              : rp.status === 'move_in_reported' ? 'bg-blue-100 text-blue-800 hover:bg-blue-100'
                              : rp.status === 'released' ? 'bg-green-100 text-green-800 hover:bg-green-100'
                              : rp.status === 'refunded' ? 'bg-red-100 text-red-800 hover:bg-red-100'
                              : rp.status === 'failed' ? 'bg-red-100 text-red-800 hover:bg-red-100'
                              : 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100'
                            }>
                              {rp.status === 'move_in_reported' ? 'Move-in reported' : rp.status === 'held' ? 'Held by Rentora' : rp.status}
                            </Badge>
                          </div>
                          <Button
                            size="sm" variant="outline" className="gap-1 shrink-0"
                            onClick={() => downloadReceiptPNG({
                              title: 'Rent Payment Receipt',
                              reference: rp.reference,
                              date: new Date(rp.created_at || rp.held_at || Date.now()).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' }),
                              status: rp.status,
                              rows: [
                                { label: 'Property', value: rp.property?.title || 'Property' },
                                { label: 'Location', value: rp.property?.location || '—' },
                                { label: 'Rent', value: formatPrice(rp.rent_amount) },
                                { label: 'Agent Fee', value: formatPrice(rp.agent_fee) },
                                ...(rp.caution_fee > 0 ? [{ label: 'Caution Fee', value: formatPrice(rp.caution_fee) }] : []),
                                { label: 'Service Fee', value: formatPrice(rp.service_fee) },
                                ...(rp.status === 'refunded' ? [{ label: 'Refunded', value: rp.refunded_at ? new Date(rp.refunded_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Yes' }] : []),
                              ],
                              total: { label: 'Total Paid', value: formatPrice(rp.total_amount) },
                              filename: `rentora-rent-receipt-${rp.reference || rp.id}.png`,
                            })}
                          >
                            <Download className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card className="p-4 text-center text-muted-foreground">
                  No rent payments yet
                </Card>
              )}
            </div>

            <div>
              <h3 className="font-semibold mb-4">Viewing Payments</h3>
              {transactions.inspection_transactions.length > 0 ? (
                <div className="space-y-3">
                  {transactions.inspection_transactions.map((tx) => (
                    <Card key={tx.id} className="p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-medium">Viewing Fee</p>
                          <p className="text-sm text-muted-foreground">{tx.reference}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <p className="font-bold text-primary">{formatPrice(tx.amount)}</p>
                            <Badge className={getStatusBadge(tx.status)}>{tx.status}</Badge>
                          </div>
                          {(tx.status === 'pending' || tx.status === 'failed') && tx.inspection?.property_id && (
                            <Button
                              size="sm" variant="outline" className="gap-1 shrink-0 text-primary border-primary/40"
                              onClick={() => navigate(`/property/${tx.inspection.property_id}`)}
                            >
                              <RefreshCw className="w-4 h-4" />Retry
                            </Button>
                          )}
                          <Button
                            size="sm" variant="outline" className="gap-1 shrink-0"
                            onClick={() => downloadReceiptPNG({
                              title: 'Inspection Payment Receipt',
                              reference: tx.reference,
                              date: new Date(tx.created_at || Date.now()).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' }),
                              status: tx.status,
                              rows: [{ label: 'Inspection Fee', value: formatPrice(tx.amount) }],
                              total: { label: 'Amount Paid', value: formatPrice(tx.amount) },
                              filename: `rentora-viewing-receipt-${tx.reference || tx.id}.png`,
                            })}
                          >
                            <Download className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card className="p-4 text-center text-muted-foreground">
                  No viewing payments yet
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Settings */}
        <TabsContent value="settings">
          <Card className="p-6">
            <h3 className="font-semibold mb-4">Account Settings</h3>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Full Name <span className="text-xs italic">(contact support to change)</span></p>
                <p className="font-medium">{user?.full_name}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Email <span className="text-xs italic">(contact support to change)</span></p>
                <p className="font-medium">{user?.email}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Phone Number</p>
                <div className="flex items-center gap-2 mt-1 max-w-sm">
                  <Input
                    value={phoneDraft}
                    onChange={(e) => setPhoneDraft(e.target.value)}
                    placeholder="+234..."
                    data-testid="profile-phone-input"
                  />
                  <Button
                    size="sm"
                    disabled={savingPhone || phoneDraft === (user?.phone || '')}
                    onClick={handleSavePhone}
                    data-testid="profile-phone-save"
                  >
                    {savingPhone ? 'Saving...' : 'Save'}
                  </Button>
                </div>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Role</p>
                <p className="font-medium capitalize">{user?.role}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Account Status</p>
                <Badge variant={user?.suspended ? 'destructive' : 'outline'}>
                  {user?.suspended ? 'Suspended' : 'Active'}
                </Badge>
              </div>
            </div>
          </Card>

          <Card className="p-6 mt-4 border-destructive/30">
            <h3 className="font-semibold mb-1 text-destructive">Danger Zone</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Permanently delete your account. This can't be undone.
            </p>
            <Button
              variant="outline"
              className="border-destructive text-destructive hover:bg-destructive hover:text-white"
              onClick={() => setShowDeleteAccount(true)}
              data-testid="profile-delete-account-open"
            >
              Delete Account
            </Button>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!tipDialogViewing} onOpenChange={(open) => { if (!open) setTipDialogViewing(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tip your agent</DialogTitle>
            <DialogDescription>
              Send {tipDialogViewing?.agent_name || 'your agent'} a one-off tip for the viewing of "{tipDialogViewing?.property_title || 'the property'}". It goes straight to their Rentora balance — Rentora takes no cut. You can only tip once per viewing.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {[500, 1000, 2000, 5000].map((preset) => (
                <Button
                  key={preset}
                  type="button"
                  size="sm"
                  variant={tipAmount === String(preset) ? 'default' : 'outline'}
                  onClick={() => setTipAmount(String(preset))}
                >
                  ₦{preset.toLocaleString('en-NG')}
                </Button>
              ))}
            </div>
            <div>
              <Label htmlFor="tip-amount">Or enter an amount (₦)</Label>
              <Input
                id="tip-amount"
                type="number"
                min="1"
                placeholder="e.g. 1500"
                value={tipAmount}
                onChange={(e) => setTipAmount(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTipDialogViewing(null)}>Cancel</Button>
            <Button onClick={handleSendTip} disabled={sendingTip || !tipAmount}>
              {sendingTip ? 'Processing...' : 'Send Tip'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!moveInDialogPayment} onOpenChange={(open) => { if (!open) setMoveInDialogPayment(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Report Move-In</DialogTitle>
            <DialogDescription>
              Upload a photo of yourself at the property to report that you've moved in. Rentora will review this photo and then release your rent, agent fee, and caution fee to the agent — it isn't released instantly, so it may take a little while after you submit. Note: Rentora does not yet have an automated refund process for the caution fee when you eventually move out — that's handled directly with your agent/landlord.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Label htmlFor="move-in-photo">Photo at the property *</Label>
            <Input
              id="move-in-photo"
              type="file"
              accept="image/*"
              onChange={handleMoveInPhotoChange}
              data-testid="move-in-photo-input"
            />
            {moveInPhotoPreview && (
              <img src={moveInPhotoPreview} alt="Move-in preview" className="w-full max-h-64 object-cover rounded-lg border" loading="lazy" decoding="async" width="800" height="600" />
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMoveInDialogPayment(null)}>Cancel</Button>
            <Button onClick={handleConfirmMoveIn} disabled={confirmingMoveIn || !moveInPhotoFile} data-testid="move-in-confirm-submit">
              {confirmingMoveIn ? 'Submitting...' : 'Report Move-In'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDeleteAccount} onOpenChange={(open) => { setShowDeleteAccount(open); if (!open) setDeleteConfirmText(''); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete your account?</DialogTitle>
            <DialogDescription>
              This permanently removes your login and personal details from Rentora. This action can't be undone.
              If you have any pending rent payments, active listings, or a wallet balance, you'll need to resolve
              those first.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="delete-confirm-text" className="text-sm">
              Type <span className="font-semibold">DELETE</span> to confirm
            </Label>
            <Input
              id="delete-confirm-text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="DELETE"
              data-testid="delete-account-confirm-input"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteAccount(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={handleDeleteAccount}
              disabled={deleteConfirmText !== 'DELETE' || deletingAccount}
              data-testid="delete-account-confirm-submit"
            >
              {deletingAccount ? 'Deleting...' : 'Permanently Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default Profile;