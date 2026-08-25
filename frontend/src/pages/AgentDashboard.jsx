import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { propertyAPI, inspectionAPI, storageAPI, balanceAPI, withdrawalAPI, rentAPI, locationAPI } from '../lib/api';
import { downloadReceiptPNG } from '../lib/receipt';
import { supabase } from '../lib/supabase';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../components/ui/dialog';
import { Building2, Plus, Calendar, Edit, CheckCircle2, XCircle, Home, Building, Upload, Image, Loader2, Expand, ChevronLeft, ChevronRight, X, CreditCard, Copy, Pencil, Phone, Wallet, TrendingUp, ArrowDownCircle, EyeOff, Eye, Lock, Download } from 'lucide-react';
import { toast } from 'sonner';
import { useSubmitGuard } from '../hooks/useSubmitGuard';

const FALLBACK_BANKS = [
  { code: '044', name: 'Access Bank' }, { code: '050', name: 'Ecobank Nigeria' },
  { code: '070', name: 'Fidelity Bank' }, { code: '011', name: 'First Bank of Nigeria' },
  { code: '214', name: 'FCMB' }, { code: '058', name: 'Guaranty Trust Bank' },
  { code: '082', name: 'Keystone Bank' }, { code: '526', name: 'Kuda Bank' },
  { code: '090405', name: 'Moniepoint MFB' }, { code: '999992', name: 'OPay' },
  { code: '120001', name: 'PalmPay' }, { code: '076', name: 'Polaris Bank' },
  { code: '101', name: 'Providus Bank' }, { code: '221', name: 'Stanbic IBTC Bank' },
  { code: '232', name: 'Sterling Bank' }, { code: '032', name: 'Union Bank' },
  { code: '033', name: 'UBA' }, { code: '035', name: 'Wema Bank' }, { code: '057', name: 'Zenith Bank' },
];

// ── Lightbox ────────────────────────────────────────────────────
function Lightbox({ images, startIndex, onClose }) {
  const [current, setCurrent] = useState(startIndex);
  const prev = () => setCurrent(i => (i - 1 + images.length) % images.length);
  const next = () => setCurrent(i => (i + 1) % images.length);

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'ArrowRight') next();
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center" onClick={onClose}>
      <button onClick={onClose} className="absolute top-4 right-4 w-10 h-10 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white transition-colors z-10">
        <X className="w-5 h-5" />
      </button>
      {images.length > 1 && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 text-white/70 text-sm bg-black/40 px-3 py-1 rounded-full">
          {current + 1} / {images.length}
        </div>
      )}
      {images.length > 1 && (
        <button onClick={(e) => { e.stopPropagation(); prev(); }} className="absolute left-4 w-10 h-10 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white transition-colors">
          <ChevronLeft className="w-6 h-6" />
        </button>
      )}
      <img src={images[current]} alt={`Property image ${current + 1}`} className="max-w-[90vw] max-h-[85vh] object-contain rounded-lg shadow-2xl" onClick={(e) => e.stopPropagation()} loading="lazy" decoding="async" width="1200" height="800" />
      {images.length > 1 && (
        <button onClick={(e) => { e.stopPropagation(); next(); }} className="absolute right-4 w-10 h-10 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white transition-colors">
          <ChevronRight className="w-6 h-6" />
        </button>
      )}
      {images.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
          {images.map((img, i) => (
            <button key={i} onClick={(e) => { e.stopPropagation(); setCurrent(i); }}
              className={`w-12 h-12 rounded-md overflow-hidden border-2 transition-all ${i === current ? 'border-white scale-110' : 'border-white/30 opacity-60 hover:opacity-100'}`}>
              <img src={img} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" width="800" height="600" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────
const AMENITY_OPTIONS = [
  'Kitchen', 'Private Toilet', 'Private Bathroom', 'Shared Toilet', 'Shared Bathroom',
  'Water Supply', 'Electricity (PHCN)', 'Generator/Power Backup', 'Security', 'Fence & Gate',
  'Parking Space', 'WiFi/Internet', 'Furnished', 'Wardrobe', 'Tiled Floor', 'POP Ceiling',
];

export function AgentDashboard() {
  const navigate = useNavigate();
  const { user, isAuthenticated, isAgent, isAdmin, isUser } = useAuth();
  const fileInputRef = useRef(null);

  // Properties & viewings
  const [properties, setProperties] = useState([]);
  const [rentPaymentsByProperty, setRentPaymentsByProperty] = useState({});
  const [viewings, setInspections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showPropertyDialog, setShowPropertyDialog] = useState(false);
  const [editingProperty, setEditingProperty] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  // Double-submit guard for the property dialog: a synchronous ref, so a fast
  // double-click can't slip a second INSERT through before React re-renders.
  const submittingPropertyRef = useRef(false);
  const [submittingProperty, setSubmittingProperty] = useState(false);
  const [lightbox, setLightbox] = useState({ open: false, images: [], index: 0 });
  const [locations, setLocations] = useState([]);
  const [formData, setFormData] = useState({
    title: '', description: '', price: '', agency_fee: '', agreement_fee: '', caution_fee: '', documentation_fee: '', other_fees: [], recurring_payment: '', inspection_fee: '', location_id: '', address: '',
    property_type: 'hostel', images: [], contact_name: '', contact_phone: '',
    owner_full_name: '', owner_phone: '',
    google_maps_link: '', amenities: [],
  });

  // Bank details
  const [banks, setBanks] = useState(FALLBACK_BANKS);
  const [banksLoading, setBanksLoading] = useState(true);
  const [bankDetails, setBankDetails] = useState(null);       // approved details
  const [pendingBankDetails, setPendingBankDetails] = useState(null); // pending change
  const [editingBank, setEditingBank] = useState(false);
  const [bankForm, setBankForm] = useState({ bank_code: '', bank_name: '', account_number: '', account_name: '' });
  const [savingBank, setSavingBank] = useState(false);
  const [balance, setBalance] = useState({ total_earned: 0, total_withdrawn: 0, available: 0 });
  const [withdrawalRequests, setWithdrawalRequests] = useState([]);
  const [earningsHistory, setEarningsHistory] = useState([]);
  const [showWithdrawDialog, setShowWithdrawDialog] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [submittingWithdrawal, setSubmittingWithdrawal] = useState(false);

  // Active tab — driven by ?tab= or #tab= so the "View on Agent Dashboard"
  // button in the rent-paid email can drop the agent straight on Rent Payments.
  const [activeTab, setActiveTab] = useState('properties');
  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      const wanted = url.searchParams.get('tab') || (window.location.hash || '').replace(/^#/, '');
      const allowed = ['properties', 'inspections', 'rent-payments', 'bank', 'earnings'];
      if (wanted && allowed.includes(wanted)) setActiveTab(wanted);
    } catch {}
  }, []);
  const [rentPaymentsList, setRentPaymentsList] = useState([]);

  // ── Load data on mount ───────────────────────────────────────
  useEffect(() => {
    if (!isAuthenticated) { navigate('/login'); return; }
    // A plain 'user' still gets in — read-only "explore" state until an
    // admin approves their agent application (role flips to 'agent').
    // fetchData() below is guarded to skip agent-only queries for them.
    fetchData();
  }, [isAuthenticated, isAgent, isAdmin, user]); // eslint-disable-line react-hooks/exhaustive-deps

  // Pending/rejected agent application status, for the explore-mode card.
  // Only relevant while role is still 'user' — once approved, role flips
  // to 'agent' and the full dashboard takes over.
  const [myAgentRequest, setMyAgentRequest] = useState(null);
  useEffect(() => {
    if (!isUser || !user?.id) return;
    supabase
      .from('agent_verification_requests')
      .select('status, reviewed_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => setMyAgentRequest(data || null))
      .catch(() => setMyAgentRequest(null));
  }, [isUser, user?.id]);

  useEffect(() => {
    locationAPI.getAll().then(res => setLocations(res.data)).catch(() => setLocations([]));
  }, []);

  useEffect(() => {
    if (user) {
      fetchBankDetails();
      loadBanks();
    }
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [propertiesRes, inspectionsRes, balanceRes, withdrawalsRes, rentPaymentsRes, earningsRes] = await Promise.all([
        propertyAPI.getMyListings(user.id),
        inspectionAPI.getAssigned(user.id),
        balanceAPI.getMyBalance(user.id),
        withdrawalAPI.getMyRequests(user.id),
        rentAPI.getPaymentsForAgent(user.id).catch(() => ({ data: [] })),
        balanceAPI.getEarningsHistory(user.id).catch(() => ({ data: [] })),
      ]);
      setProperties(propertiesRes.data);
      setInspections(inspectionsRes.data);
      if (balanceRes?.data) setBalance(balanceRes.data);
      if (withdrawalsRes?.data) setWithdrawalRequests(withdrawalsRes.data);
      setEarningsHistory(earningsRes?.data || []);
      // If a property has both a held and a released record (shouldn't
      // normally happen), prefer 'released' since it's the more final state.
      const paymentMap = {};
      const payments = rentPaymentsRes?.data || [];
      for (const p of payments) {
        if (!paymentMap[p.property_id] || p.status === 'released') paymentMap[p.property_id] = p;
      }
      setRentPaymentsByProperty(paymentMap);
      setRentPaymentsList(payments);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchBankDetails = async () => {
    if (!user) return;
    try {
      // Use .limit(1) + data[0] instead of .maybeSingle() to avoid body-stream-read error
      const bankRes = await supabase
        .from('agent_bank_details')
        .select('bank_code, bank_name, account_number, account_name')
        .eq('user_id', user.id)
        .limit(1);
      const bankRow = bankRes.data?.[0] || null;
      if (bankRow?.bank_name) setBankDetails(bankRow);

      const pendingRes = await supabase
        .from('agent_bank_change_requests')
        .select('bank_code, bank_name, account_number, account_name, created_at')
        .eq('user_id', user.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1);
      const pending = pendingRes.data?.[0] || null;
      if (pending?.bank_name) setPendingBankDetails(pending);
    } catch (e) { /* ignore */ }
  };

  const loadBanks = async () => {
    try {
      const url = `${process.env.REACT_APP_SUPABASE_URL}/functions/v1/resolve-bank?list=true`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${process.env.REACT_APP_SUPABASE_ANON_KEY}` },
      });
      const json = await res.json();
      if (json.status && Array.isArray(json.data)) {
        setBanks(json.data.filter(b => b.name && b.code).sort((a, b) => a.name.localeCompare(b.name)));
      }
    } catch (e) { /* keep fallback */ }
    finally { setBanksLoading(false); }
  };

  const handleSaveBankDetails = async () => {
    if (!bankForm.bank_code) { toast.error('Please select your bank'); return; }
    if (bankForm.account_number.length !== 10) { toast.error('Account number must be 10 digits'); return; }
    if (!bankForm.account_name.trim()) { toast.error('Please enter your account name'); return; }
    setSavingBank(true);
    try {
      // Insert a pending bank change request for admin to approve
      const { error } = await supabase
        .from('agent_bank_change_requests')
        .insert({
          user_id: user.id,
          bank_code: bankForm.bank_code,
          bank_name: bankForm.bank_name,
          account_number: bankForm.account_number,
          account_name: bankForm.account_name.trim().toUpperCase(),
          status: 'pending',
        });
      if (error) throw error;
      setPendingBankDetails({ ...bankForm, account_name: bankForm.account_name.trim().toUpperCase() });
      setEditingBank(false);
      setBankForm({ bank_code: '', bank_name: '', account_number: '', account_name: '' });
      toast.success('Bank details submitted — pending admin approval');
    } catch (err) {
      console.error(err);
      toast.error('Failed to submit bank details. Please try again.');
    } finally {
      setSavingBank(false);
    }
  };

  // ── Property handlers ────────────────────────────────────────
  const openLightbox = (images, index = 0) => setLightbox({ open: true, images, index });
  const closeLightbox = () => setLightbox({ open: false, images: [], index: 0 });

  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    if (formData.images.length + files.length > 3) { toast.error('Maximum 3 images allowed'); return; }
    setUploadingImage(true);
    try {
      const uploadedUrls = [];
      for (const file of files) {
        if (!file.type.startsWith('image/')) { toast.error(`${file.name} is not an image`); continue; }
        if (file.size > 5 * 1024 * 1024) { toast.error(`${file.name} is too large. Max 5MB`); continue; }
        const result = await storageAPI.uploadImage(file, 'property-images');
        uploadedUrls.push(result.data.url);
      }
      if (uploadedUrls.length > 0) {
        setFormData(prev => ({ ...prev, images: [...prev.images, ...uploadedUrls] }));
        toast.success(`${uploadedUrls.length} image${uploadedUrls.length > 1 ? 's' : ''} uploaded`);
      }
    } catch (error) {
      toast.error('Failed to upload image. Please try again.');
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemoveImage = (index) => setFormData(prev => ({ ...prev, images: prev.images.filter((_, i) => i !== index) }));

  const resetForm = () => {
    setFormData({ title: '', description: '', price: '', agency_fee: '', agreement_fee: '', caution_fee: '', documentation_fee: '', other_fees: [], recurring_payment: '', inspection_fee: '', location_id: '', address: '', property_type: 'hostel', images: [], contact_name: '', contact_phone: '', owner_full_name: '', owner_phone: '', google_maps_link: '', amenities: [] });
    setEditingProperty(null);
  };

  const handleOpenDialog = (property = null) => {
    if (property) {
      setEditingProperty(property);
      setFormData({
        title: property.title, description: property.description, price: property.price.toString(),
        agency_fee: (property.agency_fee ?? property.agent_fee) ? String(property.agency_fee ?? property.agent_fee) : '',
        agreement_fee: property.agreement_fee ? String(property.agreement_fee) : '',
        caution_fee: property.caution_fee ? property.caution_fee.toString() : '',
        documentation_fee: property.documentation_fee ? String(property.documentation_fee) : '',
        other_fees: Array.isArray(property.other_fees) ? property.other_fees.map(f => ({ name: String(f?.name || ''), amount: String(f?.amount || '') })) : [],
        recurring_payment: property.recurring_payment ? property.recurring_payment.toString() : '',
        inspection_fee: property.inspection_fee !== null && property.inspection_fee !== undefined && property.inspection_fee !== '' ? property.inspection_fee.toString() : '',
        location_id: property.location_id ? String(property.location_id) : '', address: property.address || '', property_type: property.property_type, images: property.images || [],
        contact_name: property.contact_name, contact_phone: property.contact_phone,
        owner_full_name: property.owner_full_name || '', owner_phone: property.owner_phone || '',
        google_maps_link: property.google_maps_link || '', amenities: property.amenities || [],
      });
    } else { resetForm(); }
    setShowPropertyDialog(true);
  };

  const handleSubmitProperty = async () => {
    if (submittingPropertyRef.current) return; // already saving — ignore the extra click
    if (!isAgent && !isAdmin) { toast.error('Complete verification to start listing'); return; }
    if (!formData.title || !formData.price || !formData.location_id || !formData.contact_name || !formData.contact_phone) {
      toast.error('Please fill in all required fields'); return;
    }
    if (!formData.owner_full_name || !formData.owner_phone) {
      toast.error('Please fill in the property owner\'s name and phone number.'); return;
    }
    submittingPropertyRef.current = true;
    setSubmittingProperty(true);
    try {
      const inspectionFeeVal = formData.inspection_fee === '' || formData.inspection_fee === null || formData.inspection_fee === undefined ? 0 : Math.max(0, parseInt(formData.inspection_fee, 10) || 0);
      const priceVal = parseInt(formData.price);
      const locationIdVal = parseInt(formData.location_id, 10);
      const locationName = locations.find(l => l.id === locationIdVal)?.name || '';

      // Warn if another agent already has a listing that looks like the
      // same property — same type, similar price/title/location.
      const dupRes = await propertyAPI.checkPossibleDuplicates({
        title: formData.title,
        location: locationName,
        price: priceVal,
        propertyType: formData.property_type,
        agentId: user.id,
        excludePropertyId: editingProperty?.id,
      });
      if (dupRes.data.length > 0) {
        const match = dupRes.data[0];
        const proceed = window.confirm(
          `This looks similar to an existing listing — "${match.title}" (${match.location}) posted by ${match.uploaded_by_agent_name}.\n\nIf this is a different property, click OK to continue. If it's the same house, please don't post a duplicate.`
        );
        if (!proceed) {
          submittingPropertyRef.current = false;
          setSubmittingProperty(false);
          return;
        }
      }

      const normalizeOtherFees = (Array.isArray(formData.other_fees) ? formData.other_fees : [])
        .map((fee) => ({ name: String(fee?.name || '').trim(), amount: Math.max(0, parseInt(fee?.amount || '0', 10) || 0) }))
        .filter((fee) => fee.name && fee.amount > 0);
      const agencyFeeVal = Math.max(0, parseInt(formData.agency_fee || '0', 10) || 0);
      const agreementFeeVal = Math.max(0, parseInt(formData.agreement_fee || '0', 10) || 0);
      const cautionFeeVal = Math.max(0, parseInt(formData.caution_fee || '0', 10) || 0);
      const documentationFeeVal = Math.max(0, parseInt(formData.documentation_fee || '0', 10) || 0);
      const data = {
        ...formData,
        location_id: locationIdVal,
        price: priceVal,
        agency_fee: agencyFeeVal,
        agent_fee: agencyFeeVal,
        agreement_fee: agreementFeeVal,
        caution_fee: cautionFeeVal,
        documentation_fee: documentationFeeVal,
        other_fees: normalizeOtherFees,
        recurring_payment: formData.recurring_payment ? parseInt(formData.recurring_payment) : null,
        inspection_fee: inspectionFeeVal,
        images: formData.images,
      };
      if (editingProperty) {
        // Any edit to an existing listing's details must go back through admin
        // approval — status: 'pending' is enough to pull it out of "approved"
        // (and off Browse) until reviewed. approved_by_admin_id is NOT sent
        // here — the DB only allows admins to change that column, and an
        // agent's own edit will be rejected if it's included.
        await propertyAPI.update(editingProperty.id, { ...data, status: 'pending' }, user);
        toast.success('Property updated — pending admin re-approval');
      } else {
        await propertyAPI.create(data, user);
        toast.success('Property submitted for approval');
      }
      setShowPropertyDialog(false);
      resetForm();
      fetchData();
    } catch (error) {
      toast.error(error.message || 'Failed to save property');
    } finally {
      submittingPropertyRef.current = false;
      setSubmittingProperty(false);
    }
  };

  const handleMarkCompleted = async (inspectionId) => {
    try {
      // Just marks that the physical viewing took place. Agent payout
      // already happened via the DB trigger when payment_status turned
      // 'completed' (see credit_agent_balance() in supabase_migration_v2.sql) —
      // this used to ALSO manually credit a hardcoded ₦2,100 here, which
      // double-paid the agent on every completed viewing. Removed.
      await inspectionAPI.update(inspectionId, { status: 'completed' });
      toast.success('Inspection marked as completed');
      fetchData();
    } catch (error) {
      toast.error('Failed to update viewing');
    }
  };

  const handleToggleAvailability = async (property) => {
    const isUnavailable = property.availability === 'unavailable';
    const newAvailability = isUnavailable ? 'available' : 'unavailable';
    const label = isUnavailable ? 'marked as available again' : 'marked as unavailable';
    try {
      await propertyAPI.update(property.id, { availability: newAvailability });
      toast.success(`Property ${label}.`);
      fetchData();
    } catch (err) {
      // The DB blocks reopening a property while a rent payment is held in
      // escrow for it (see trg_prevent_reopening_reserved_property) — surface
      // that reason directly rather than a generic failure message.
      toast.error(err.message || 'Failed to update property availability');
    }
  };

  const copyToClipboard = (text, label) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  };

  const formatPrice = (price) => new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 0 }).format(price);
  const getStatusBadge = (status) => ({
    pending: 'bg-yellow-100 text-yellow-800',
    approved: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-800',
    assigned: 'bg-blue-100 text-blue-800',
    completed: 'bg-green-100 text-green-800',
    failed: 'bg-red-100 text-red-800',
    held: 'bg-yellow-100 text-yellow-800',
    released: 'bg-green-100 text-green-800',
    paid: 'bg-green-100 text-green-800',
    refunded: 'bg-red-100 text-red-800',
  }[status] || 'bg-gray-100 text-gray-800');

  if (!isAuthenticated || (!isAgent && !isAdmin && !isUser)) return null;

  const handleWithdraw = async () => {
    if (!isAgent && !isAdmin) { toast.error('Complete verification to receive payouts'); return; }
    const amt = parseFloat(withdrawAmount);
    if (!amt || amt <= 0) { toast.error('Enter a valid amount'); return; }
    if (amt > balance.available) { toast.error('Amount exceeds available balance'); return; }
    if (amt < withdrawalAPI.MIN_WITHDRAWAL_AMOUNT) { toast.error(`Minimum withdrawal is ₦${withdrawalAPI.MIN_WITHDRAWAL_AMOUNT.toLocaleString('en-NG')} per request`); return; }
    if (!bankDetails?.account_number) { toast.error('Add your bank account first (Bank Details tab)'); return; }
    setSubmittingWithdrawal(true);
    try {
      await withdrawalAPI.request({
        agentId: user.id,
        agentName: user.full_name || user.email,
        agentEmail: user.email,
        amount: amt,
        bankName: bankDetails.bank_name,
        accountNumber: bankDetails.account_number,
        accountName: bankDetails.account_name,
      });
      toast.success('Withdrawal request submitted! Admin will process it shortly.');
      setShowWithdrawDialog(false);
      setWithdrawAmount('');
      fetchData();
    } catch (err) {
      toast.error(err.message || 'Failed to submit withdrawal request');
    } finally {
      setSubmittingWithdrawal(false);
    }
  };

  // Once an existing listing already has owner details filled in,
  // they're locked (mirrors the DB trigger) — only support/admin can change
  // them from here on, to protect the owner from an agent quietly
  // changing their contact information.
  const ownerDetailsLocked = !!(
    editingProperty?.owner_full_name && editingProperty?.owner_phone
  );

  return (
    <div className="container mx-auto py-6" data-testid="agent-dashboard">
      {lightbox.open && <Lightbox images={lightbox.images} startIndex={lightbox.index} onClose={closeLightbox} />}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Agent Dashboard</h1>
          <p className="text-muted-foreground mt-1 text-sm">Manage your properties and viewings</p>
        </div>
        <Button
          onClick={() => {
            if (!isAgent && !isAdmin) { toast.error('Complete verification to start listing'); return; }
            if (user?.suspended) { toast.error('Your account is suspended.'); return; }
            handleOpenDialog();
          }}
          className="gap-2" disabled={user?.suspended || (!isAgent && !isAdmin)} data-testid="add-property-btn">
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Add Property</span>
          <span className="sm:hidden">Add</span>
        </Button>
      </div>

      {isUser && (
        <div className="mb-5 p-4 rounded-xl bg-blue-50 border border-blue-200 flex items-start gap-3" data-testid="agent-verification-card">
          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0 mt-0.5">
            <Lock className="w-4 h-4 text-blue-600" />
          </div>
          <div>
            <p className="font-medium text-blue-900">
              {myAgentRequest?.status === 'pending'
                ? 'Your agent verification is under review'
                : myAgentRequest?.status === 'rejected'
                  ? 'Your agent verification was not approved'
                  : "You're exploring in read-only mode"}
            </p>
            <p className="text-sm text-blue-700 mt-0.5">
              {myAgentRequest?.status === 'pending'
                ? "We'll notify you as soon as it's reviewed. Listing, leads and payouts unlock once approved."
                : myAgentRequest?.status === 'rejected'
                  ? 'Contact support for details, or reach out for a new invite to reapply.'
                  : 'Complete verification to start listing, receive leads, and get paid out.'}
            </p>
          </div>
        </div>
      )}

      {user?.suspended && (
        <div className="mb-5 p-4 rounded-xl bg-red-50 border border-red-200 flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center shrink-0 mt-0.5">
            <XCircle className="w-4 h-4 text-red-600" />
          </div>
          <div>
            <p className="font-semibold text-red-800 text-sm">Account Suspended</p>
            <p className="text-xs text-red-600 mt-0.5">Your account has been suspended. Contact support for more information.</p>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Card className="p-4"><p className="text-2xl font-bold">{properties.length}</p><p className="text-sm text-muted-foreground">Total Properties</p></Card>
        <Card className="p-4"><p className="text-2xl font-bold text-green-600">{properties.filter(p => p.status === 'approved').length}</p><p className="text-sm text-muted-foreground">Approved</p></Card>
        <Card className="p-4"><p className="text-2xl font-bold text-yellow-600">{properties.filter(p => p.status === 'pending').length}</p><p className="text-sm text-muted-foreground">Pending</p></Card>
        <Card className="p-4"><p className="text-2xl font-bold">{viewings.length}</p><p className="text-sm text-muted-foreground">Viewing Requests</p></Card>
      </div>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => {
          setActiveTab(v);
          try {
            const url = new URL(window.location.href);
            url.searchParams.set('tab', v);
            window.history.replaceState({}, '', url.toString());
          } catch {}
        }}
      >
        <TabsList className="mb-5 w-full grid grid-cols-5">
          <TabsTrigger value="properties" className="gap-1.5 text-xs sm:text-sm"><Building2 className="w-4 h-4 shrink-0" /><span className="hidden sm:inline">My </span><span className="hidden sm:inline">Properties</span></TabsTrigger>
          <TabsTrigger value="inspections" className="gap-1.5 text-xs sm:text-sm"><Calendar className="w-4 h-4 shrink-0" /><span className="hidden sm:inline">Assigned Viewing Requests</span></TabsTrigger>
          <TabsTrigger value="rent-payments" className="gap-1.5 text-xs sm:text-sm"><Lock className="w-4 h-4 shrink-0" /><span className="hidden sm:inline">Rent </span><span className="hidden sm:inline">Payments</span></TabsTrigger>
          <TabsTrigger value="bank" className="gap-1.5 text-xs sm:text-sm"><CreditCard className="w-4 h-4 shrink-0" /><span className="hidden sm:inline">Bank Details</span></TabsTrigger>
          <TabsTrigger value="earnings" className="gap-1.5 text-xs sm:text-sm"><Wallet className="w-4 h-4 shrink-0" /><span className="hidden sm:inline">Earnings</span></TabsTrigger>
        </TabsList>


        {/* ── Properties Tab ── */}
        <TabsContent value="properties">
          {loading ? (
            <div className="space-y-3">
              {[1,2,3].map(i => (
                <Card key={i} className="overflow-hidden">
                  <div className="flex" style={{ height: '110px' }}>
                    <div className="w-28 bg-muted animate-pulse flex-shrink-0" />
                    <div className="flex-1 p-3 space-y-2">
                      <div className="h-4 bg-muted rounded animate-pulse w-3/4" />
                      <div className="h-3 bg-muted rounded animate-pulse w-1/2" />
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : properties.length > 0 ? (
            <div className="space-y-3">
              {properties.map((property) => {
                const paidRecord = rentPaymentsByProperty[property.id];
                return (
                <Card key={property.id} className="overflow-hidden">
                  <div className="flex">
                    <div className="relative group flex-shrink-0 w-28 sm:w-32" style={{ minHeight: '110px' }}>
                      {property.images?.[0] ? (
                        <>
                          <img src={property.images[0]} alt="" className="absolute inset-0 w-full h-full object-cover cursor-pointer" onClick={() => openLightbox(property.images, 0)} loading="lazy" decoding="async" width="800" height="600" />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/25 flex items-end justify-center pb-2 transition-all cursor-pointer" onClick={() => openLightbox(property.images, 0)}>
                            <span className="text-white text-xs font-medium bg-black/60 px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                              <Expand className="w-3 h-3" /> View
                            </span>
                          </div>
                          {property.images.length > 1 && (
                            <span className="absolute top-2 left-2 bg-black/60 text-white text-xs px-1.5 py-0.5 rounded font-medium pointer-events-none">+{property.images.length - 1}</span>
                          )}
                        </>
                      ) : (
                        <div className="absolute inset-0 bg-muted flex items-center justify-center">
                          <Image className="w-7 h-7 text-muted-foreground/40" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 p-3 min-w-0 flex flex-col justify-between" style={{ minHeight: '110px' }}>
                      <div className="flex items-start gap-2">
                        <h3 className="font-semibold text-sm leading-snug line-clamp-2 flex-1 min-w-0">{property.title}</h3>
                        <Badge className={`${getStatusBadge(property.status)} text-xs capitalize shrink-0 whitespace-nowrap`}>{property.status}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-1">{property.location}</p>
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-primary font-bold text-sm truncate">{formatPrice(property.price)}<span className="text-xs font-normal text-muted-foreground">/yr</span></p>
                        <div className="flex gap-1.5 shrink-0 items-center">
                          <Button variant="outline" size="sm"
                            onClick={() => {
                              if (user?.suspended) { toast.error('Your account is suspended.'); return; }
                              if (paidRecord) { toast.error('This property has been taken and can no longer be edited. Contact support@rentora.com.ng if a change is genuinely needed.'); return; }
                              handleOpenDialog(property);
                            }}
                            disabled={user?.suspended || !!paidRecord} className="h-7 px-2.5 text-xs gap-1">
                            <Edit className="w-3 h-3" /> Edit
                          </Button>
                          {paidRecord?.status === 'refunded' ? (
                            <Badge
                              variant="secondary"
                              className="h-7 px-2.5 text-xs gap-1 bg-red-100 text-red-700 hover:bg-red-100 cursor-help"
                              title={`Refunded to the student${paidRecord.refund_reason ? ` (reason: ${paidRecord.refund_reason})` : ''} — the listing was removed and no payout was made to you for this booking. Contact support@rentora.com.ng with questions.`}
                            >
                              <Lock className="w-3 h-3" />
                              Refunded
                            </Badge>
                          ) : paidRecord ? (
                            <Badge
                              variant="secondary"
                              className="h-7 px-2.5 text-xs gap-1 bg-green-100 text-green-700 hover:bg-green-100 cursor-help"
                              title={paidRecord.status === 'held'
                                ? "Payment held in escrow — awaiting the renter's move-in confirmation. This listing is locked, can't be edited or reopened until then."
                                : "Rent has been paid and released — this property is taken and permanently locked from editing. Contact support@rentora.com.ng if it needs to be relisted."}
                            >
                              <Lock className="w-3 h-3" />
                              {paidRecord.status === 'held' ? 'Payment Held' : 'Taken (Paid)'}
                            </Badge>
                          ) : (
                            <Button variant="outline" size="sm"
                              onClick={() => handleToggleAvailability(property)}
                              disabled={user?.suspended}
                              className={`h-7 px-2.5 text-xs gap-1 ${property.availability === 'unavailable' ? 'text-green-600 border-green-300 hover:bg-green-50' : 'text-orange-600 border-orange-300 hover:bg-orange-50'}`}>
                              {property.availability === 'unavailable'
                                ? <><Eye className="w-3 h-3" /> Available</>
                                : <><EyeOff className="w-3 h-3" /> Unavailable</>
                              }
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
                );
              })}
            </div>

          ) : (
            <Card className="p-10 text-center">
              <Building2 className="w-12 h-12 mx-auto text-muted-foreground/40 mb-4" />
              <h3 className="font-semibold">No Properties Yet</h3>
              <p className="text-sm text-muted-foreground mt-1 mb-4">Add your first property listing to get started</p>
              <Button onClick={() => { if (user?.suspended) { toast.error('Account suspended.'); return; } handleOpenDialog(); }} disabled={user?.suspended} className="gap-2">
                <Plus className="w-4 h-4" /> Add Property
              </Button>
            </Card>
          )}
        </TabsContent>

        {/* ── Viewing Requests Tab ── */}
        <TabsContent value="inspections">
          {viewings.length > 0 ? (
            <div className="space-y-3">
              {viewings.map((viewing) => (
                <Card key={viewing.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold line-clamp-1">{viewing.property_title}</h3>
                      <p className="text-sm text-muted-foreground mt-0.5">Tenant: {viewing.user_name}</p>
                      <p className="text-sm text-muted-foreground">Date: {viewing.inspection_date}</p>
                      {(viewing.payment_status === 'completed' || viewing.payment_status === 'not_required') && viewing.user_phone && (
                        <a href={`tel:${viewing.user_phone}`}
                          className="inline-flex items-center gap-1.5 mt-2 text-primary font-semibold text-sm hover:underline">
                          <Phone className="w-3.5 h-3.5" /> {viewing.user_phone}
                        </a>
                      )}
                      {(viewing.payment_status === 'completed' || viewing.payment_status === 'not_required') && !viewing.user_phone && (
                        <p className="text-xs text-muted-foreground mt-1">User phone not available</p>
                      )}
                      {viewing.payment_status !== 'completed' && viewing.payment_status !== 'not_required' && (
                        <p className="text-xs text-yellow-600 mt-1">⏳ Awaiting payment</p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <Badge className={getStatusBadge(viewing.status)}>{viewing.status}</Badge>
                      {(viewing.payment_status === 'completed' || viewing.payment_status === 'not_required') && viewing.user_phone && (
                        <a href={`tel:${viewing.user_phone}`}>
                          <Button size="sm" variant="outline" className="gap-1.5 h-7 text-xs">
                            <Phone className="w-3 h-3" /> Call User
                          </Button>
                        </a>
                      )}
                      {viewing.status !== 'completed' && (viewing.payment_status === 'completed' || viewing.payment_status === 'not_required') && (
                        <Button size="sm" onClick={() => handleMarkCompleted(viewing.id)} className="gap-1.5 h-7 text-xs">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Done
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="p-10 text-center">
              <Calendar className="w-12 h-12 mx-auto text-muted-foreground/40 mb-4" />
              <h3 className="font-semibold">No Viewing Requests Assigned</h3>
              <p className="text-sm text-muted-foreground mt-1">Viewing Requests assigned to you will appear here</p>
            </Card>
          )}
        </TabsContent>

        {/* ── Bank Details Tab ── */}
        <TabsContent value="bank">
          <Card className="p-4 sm:p-6">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <CreditCard className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold">Payout Bank Account</h3>
                  <p className="text-xs text-muted-foreground">Used to receive viewing fee payouts</p>
                </div>
              </div>
              {!editingBank && !pendingBankDetails && (
                <Button variant="outline" size="sm" className="gap-1.5 h-8 shrink-0" onClick={() => {
                  setBankForm(bankDetails || { bank_code: '', bank_name: '', account_number: '', account_name: '' });
                  setEditingBank(true);
                }}>
                  <Pencil className="w-3.5 h-3.5" /> {bankDetails ? 'Edit' : 'Add'}
                </Button>
              )}
            </div>

            {/* Pending change notice */}
            {pendingBankDetails && !editingBank && (
              <div className="mb-4 p-3 rounded-lg bg-yellow-50 border border-yellow-200">
                <p className="text-xs font-semibold text-yellow-800 mb-2">⏳ Change Pending Admin Approval</p>
                <div className="space-y-1 text-xs text-yellow-700">
                  <p><span className="font-medium">Bank:</span> {pendingBankDetails.bank_name}</p>
                  <p><span className="font-medium">Account:</span> {pendingBankDetails.account_number}</p>
                  <p><span className="font-medium">Name:</span> {pendingBankDetails.account_name}</p>
                </div>
              </div>
            )}

            {!editingBank ? (
              bankDetails?.bank_name ? (
                <div className="space-y-3 p-4 rounded-xl bg-blue-50 border border-blue-200">
                  <p className="text-xs font-semibold text-blue-600 mb-1">Current Approved Details</p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground font-medium">Bank</span>
                    <span className="text-sm font-semibold">{bankDetails.bank_name}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground font-medium">Account Number</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-bold">{bankDetails.account_number}</span>
                      <button onClick={() => copyToClipboard(bankDetails.account_number, 'Account number')} className="text-muted-foreground hover:text-primary transition-colors">
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between border-t border-blue-200 pt-3">
                    <span className="text-xs text-muted-foreground font-medium">Account Name</span>
                    <span className="text-sm font-bold text-blue-800">{bankDetails.account_name}</span>
                  </div>
                  {!pendingBankDetails && (
                    <Button variant="outline" size="sm" className="w-full mt-2 gap-1.5" onClick={() => {
                      setBankForm(bankDetails);
                      setEditingBank(true);
                    }}>
                      <Pencil className="w-3.5 h-3.5" /> Request Change
                    </Button>
                  )}
                </div>
              ) : !pendingBankDetails ? (
                <div className="text-center py-8">
                  <CreditCard className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="font-medium text-sm">No bank details on file</p>
                  <p className="text-xs text-muted-foreground mt-1 mb-4">Add your bank account to receive viewing payouts</p>
                  <Button size="sm" onClick={() => { setBankForm({ bank_code: '', bank_name: '', account_number: '', account_name: '' }); setEditingBank(true); }} className="gap-1.5">
                    <Plus className="w-4 h-4" /> Add Bank Account
                  </Button>
                </div>
              ) : null
            ) : (
              /* ── Edit Form (manual input) ── */
              <div className="space-y-4">
                <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-xs text-blue-700">
                  Changes will be reviewed by admin before going live.
                </div>

                <div className="space-y-2">
                  <Label>Bank <span className="text-destructive">*</span></Label>
                  <Select
                    value={bankForm.bank_code}
                    onValueChange={(val) => {
                      const selected = banks.find(b => b.code === val);
                      setBankForm(prev => ({ ...prev, bank_code: val, bank_name: selected?.name || '' }));
                    }}
                    disabled={banksLoading}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={banksLoading ? 'Loading banks...' : 'Select your bank...'} />
                    </SelectTrigger>
                    <SelectContent>
                      {banks.map(bank => (
                        <SelectItem key={bank.code} value={bank.code}>{bank.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Account Number <span className="text-destructive">*</span></Label>
                  <Input
                    type="text" inputMode="numeric" maxLength={10}
                    value={bankForm.account_number}
                    onChange={(e) => setBankForm(prev => ({ ...prev, account_number: e.target.value.replace(/\D/g, '') }))}
                    placeholder="10-digit account number"
                  />
                  {bankForm.account_number?.length > 0 && bankForm.account_number.length < 10 && (
                    <p className="text-xs text-muted-foreground">{10 - bankForm.account_number.length} more digit{10 - bankForm.account_number.length !== 1 ? 's' : ''} needed</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Account Name <span className="text-destructive">*</span></Label>
                  <Input
                    value={bankForm.account_name}
                    onChange={(e) => setBankForm(prev => ({ ...prev, account_name: e.target.value }))}
                    placeholder="Enter your account name exactly as on the account"
                  />
                  <p className="text-xs text-muted-foreground">Type the name as it appears on your bank account</p>
                </div>

                <div className="flex gap-2 pt-1">
                  <Button variant="outline" className="flex-1" onClick={() => {
                    setEditingBank(false);
                    setBankForm({ bank_code: '', bank_name: '', account_number: '', account_name: '' });
                  }}>Cancel</Button>
                  <Button className="flex-1" onClick={handleSaveBankDetails} disabled={savingBank}>
                    {savingBank ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Submitting...</> : 'Submit for Approval'}
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </TabsContent>

        {/* ── Earnings Tab ── */}
        <TabsContent value="earnings">
          {/* Balance Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
            <Card className="p-5 bg-gradient-to-br from-green-500 to-green-700 text-white col-span-1 sm:col-span-1">
              <div className="flex items-center gap-2 mb-1">
                <Wallet className="w-4 h-4 opacity-80" />
                <p className="text-sm opacity-90">Available Balance</p>
              </div>
              <p className="text-3xl font-bold">₦{balance.available.toLocaleString('en-NG')}</p>
            </Card>
            <Card className="p-5">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="w-4 h-4 text-green-600" />
                <p className="text-sm text-muted-foreground">Total Earned</p>
              </div>
              <p className="text-2xl font-bold">₦{balance.total_earned.toLocaleString('en-NG')}</p>
            </Card>
            <Card className="p-5">
              <div className="flex items-center gap-2 mb-1">
                <ArrowDownCircle className="w-4 h-4 text-blue-600" />
                <p className="text-sm text-muted-foreground">Total Withdrawn</p>
              </div>
              <p className="text-2xl font-bold">₦{balance.total_withdrawn.toLocaleString('en-NG')}</p>
            </Card>
          </div>

          {/* Withdraw button */}
          <div className="flex justify-end mb-4">
            <Button
              onClick={() => setShowWithdrawDialog(true)}
              disabled={balance.available <= 0}
              className="gap-2"
            >
              <ArrowDownCircle className="w-4 h-4" /> Request Withdrawal
            </Button>
          </div>

          {/* Earnings history */}
          <Card className="p-4 sm:p-6 mb-6">
            <h3 className="font-semibold mb-4">Earnings History</h3>
            {earningsHistory.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No earnings yet — completed viewings, released rent agent fees, and tips will show up here</p>
            ) : (
              <div className="space-y-3">
                {earningsHistory.map((e) => (
                  <div key={e.id} className="flex items-center justify-between p-3 rounded-lg border bg-muted/30 gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className={
                          e.type === 'inspection' ? 'text-blue-600 border-blue-300'
                          : e.type === 'tip' ? 'text-purple-600 border-purple-300'
                          : 'text-green-600 border-green-300'
                        }>
                          {e.label}
                        </Badge>
                        <p className="font-medium text-sm truncate">{e.property_title}</p>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {e.type === 'tip' && e.tipper_name ? `From ${e.tipper_name} · ` : ''}
                        {e.date ? new Date(e.date).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                      </p>
                    </div>
                    <p className="font-bold text-green-600 shrink-0">+₦{e.amount.toLocaleString('en-NG')}</p>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Withdrawal history */}
          <Card className="p-4 sm:p-6">
            <h3 className="font-semibold mb-4">Withdrawal History</h3>
            {withdrawalRequests.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No withdrawal requests yet</p>
            ) : (
              <div className="space-y-3">
                {withdrawalRequests.map(req => (
                  <div key={req.id} className="flex items-center justify-between p-3 rounded-lg border bg-muted/30 gap-3">
                    <div>
                      <p className="font-medium text-sm">₦{Number(req.amount).toLocaleString('en-NG')}</p>
                      <p className="text-xs text-muted-foreground">{new Date(req.requested_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge className={`capitalize ${req.status === 'paid' ? 'bg-green-100 text-green-800' : req.status === 'rejected' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`}>
                        {req.status}
                      </Badge>
                      <Button
                        size="sm" variant="outline" className="gap-1 h-8 px-2"
                        onClick={() => downloadReceiptPNG({
                          title: 'Withdrawal Receipt',
                          reference: req.id,
                          date: new Date(req.requested_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' }),
                          status: req.status,
                          rows: [
                            { label: 'Amount Requested', value: `₦${Number(req.amount).toLocaleString('en-NG')}` },
                            { label: 'Withdrawal Fee', value: `-₦${Number(req.fee_amount || 0).toLocaleString('en-NG')}` },
                          ],
                          total: { label: 'Paid Out', value: `₦${Number(req.net_amount || (req.amount - (req.fee_amount || 0))).toLocaleString('en-NG')}` },
                          filename: `rentora-withdrawal-receipt-${req.id}.png`,
                        })}
                      >
                        <Download className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>

        {/* ── Rent Payments Tab ── */}
        <TabsContent value="rent-payments">
          {(() => {
            const held = rentPaymentsList.filter(p => p.status === 'held');
            const released = rentPaymentsList.filter(p => p.status === 'released');
            const refunded = rentPaymentsList.filter(p => p.status === 'refunded');
            const sum = (arr, k) => arr.reduce((s, r) => s + Number(r[k] || 0), 0);
            const totalHeldByRentora = sum(held, 'total_amount');
            const totalReleased = sum(released, 'total_amount');
            const totalRefunded = sum(refunded, 'total_amount');
            const heldRent = sum(held, 'rent_amount');
            const heldAgentFee = sum(held, 'agent_fee');
            const heldCaution = sum(held, 'caution_fee');
            return (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                  <Card className="p-4 bg-yellow-50 border-yellow-200">
                    <p className="text-xs text-yellow-800 font-medium flex items-center gap-1"><Lock className="w-3 h-3" /> Held by Rentora</p>
                    <p className="text-2xl font-bold text-yellow-900 mt-1">₦{totalHeldByRentora.toLocaleString('en-NG')}</p>
                    <p className="text-xs text-yellow-700 mt-0.5">{held.length} active payment{held.length === 1 ? '' : 's'}</p>
                  </Card>
                  <Card className="p-4">
                    <p className="text-xs text-muted-foreground font-medium">Rent (Held)</p>
                    <p className="text-xl font-bold mt-1">₦{heldRent.toLocaleString('en-NG')}</p>
                  </Card>
                  <Card className="p-4">
                    <p className="text-xs text-muted-foreground font-medium">Agent Fee (Held)</p>
                    <p className="text-xl font-bold mt-1">₦{heldAgentFee.toLocaleString('en-NG')}</p>
                  </Card>
                  <Card className="p-4">
                    <p className="text-xs text-muted-foreground font-medium">Caution (Held)</p>
                    <p className="text-xl font-bold mt-1">₦{heldCaution.toLocaleString('en-NG')}</p>
                  </Card>
                </div>

                <Card className="p-4 mb-5 bg-blue-50 border-blue-200">
                  <p className="text-sm text-blue-900">
                    <strong>How this works:</strong> When a student pays rent, Rentora holds the full amount
                    (rent + agent fee + caution fee) in escrow. It's released to your Rentora balance once
                    the student confirms move-in, or automatically after 5 days.
                  </p>
                  <p className="text-xs text-blue-800 mt-2">
                    Total released to date: <strong>₦{totalReleased.toLocaleString('en-NG')}</strong> across {released.length} payment{released.length === 1 ? '' : 's'}.
                  </p>
                  {refunded.length > 0 && (
                    <p className="text-xs text-red-700 mt-2">
                      Refunded to students: <strong>₦{totalRefunded.toLocaleString('en-NG')}</strong> across {refunded.length} payment{refunded.length === 1 ? '' : 's'} — these were held in escrow but never paid out to you, so nothing was ever deducted from your balance.
                    </p>
                  )}
                </Card>

                {loading ? (
                  <div className="space-y-3">
                    {[1,2].map(i => <Card key={i} className="p-4 h-24 animate-pulse bg-muted" />)}
                  </div>
                ) : rentPaymentsList.length === 0 ? (
                  <Card className="p-8 text-center">
                    <Lock className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">No rent payments yet.</p>
                    <p className="text-xs text-muted-foreground mt-1">When a student pays rent for one of your properties, it will show up here.</p>
                  </Card>
                ) : (
                  <div className="space-y-3">
                    {rentPaymentsList.map((p) => {
                      const propTitle = p.property?.title || 'Property';
                      const locName = p.property?.locations?.name || '';
                      const student = p.student || {};
                      const isHeld = p.status === 'held';
                      const isRefunded = p.status === 'refunded';
                      const releaseAt = p.auto_release_at ? new Date(p.auto_release_at) : null;
                      const paidAt = p.held_at ? new Date(p.held_at) : (p.created_at ? new Date(p.created_at) : null);
                      const borderClass = isHeld ? 'border-yellow-300' : isRefunded ? 'border-red-300' : 'border-green-300';
                      const totalLabel = isHeld ? 'Total Held' : isRefunded ? 'Total Refunded' : 'Total Released';
                      const totalColorClass = isHeld ? 'text-yellow-700' : isRefunded ? 'text-red-700' : 'text-green-700';
                      return (
                        <Card key={p.id} className={`p-4 ${borderClass}`}>
                          <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
                            <div className="min-w-0">
                              <p className="font-semibold truncate">{propTitle}</p>
                              {locName && <p className="text-xs text-muted-foreground">{locName}</p>}
                            </div>
                            <Badge className={isHeld ? 'bg-yellow-100 text-yellow-800' : isRefunded ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}>
                              {isHeld
                                ? <><Lock className="w-3 h-3 mr-1 inline" /> Held by Rentora</>
                                : isRefunded
                                  ? <><Lock className="w-3 h-3 mr-1 inline" /> Refunded to Student</>
                                  : <><CheckCircle2 className="w-3 h-3 mr-1 inline" /> Released</>}
                            </Badge>
                          </div>

                          {isRefunded && (
                            <div className="mb-3 p-2 rounded bg-red-50 border border-red-200 text-xs text-red-800">
                              This booking was cancelled and the payment was refunded to the student{p.refund_reason ? ` (reason: ${p.refund_reason})` : ''}. No payout was ever made to you for it, and the listing was removed.
                              {p.admin_note && <> Admin note: {p.admin_note}</>}
                            </div>
                          )}

                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mb-3">
                            <div><p className="text-xs text-muted-foreground">Rent</p><p className="font-semibold">₦{Number(p.rent_amount || 0).toLocaleString('en-NG')}</p></div>
                            <div><p className="text-xs text-muted-foreground">Agency Fee</p><p className="font-semibold">₦{Number(p.agent_fee || 0).toLocaleString('en-NG')}</p></div>
                            <div><p className="text-xs text-muted-foreground">Caution Fee</p><p className="font-semibold">₦{Number(p.caution_fee || 0).toLocaleString('en-NG')}</p></div>
                            <div><p className="text-xs text-muted-foreground">{totalLabel}</p><p className={`font-bold ${totalColorClass}`}>₦{Number(p.total_amount || 0).toLocaleString('en-NG')}</p></div>
                          </div>
                          {(Number(p.agreement_fee || 0) > 0 || Number(p.inspection_fee || 0) > 0 || Number(p.documentation_fee || 0) > 0 || Number(p.other_fees_total || 0) > 0) && (
                            <div className="mb-3 rounded-md border bg-muted/20 p-3 text-xs grid grid-cols-2 md:grid-cols-4 gap-2">
                              {Number(p.agreement_fee || 0) > 0 && <div><span className="text-muted-foreground">Agreement:</span> ₦{Number(p.agreement_fee).toLocaleString('en-NG')}</div>}
                              {Number(p.inspection_fee || 0) > 0 && <div><span className="text-muted-foreground">Inspection:</span> ₦{Number(p.inspection_fee).toLocaleString('en-NG')}</div>}
                              {Number(p.documentation_fee || 0) > 0 && <div><span className="text-muted-foreground">Documentation:</span> ₦{Number(p.documentation_fee).toLocaleString('en-NG')}</div>}
                              {Array.isArray(p.other_fees) && p.other_fees.map((f, i) => <div key={i}><span className="text-muted-foreground">{f.name}:</span> ₦{Number(f.amount || 0).toLocaleString('en-NG')}</div>)}
                            </div>
                          )}

                          <div className="border-t pt-3 grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-muted-foreground">
                            <div>
                              <span className="font-medium text-foreground">Student:</span>{' '}
                              {student.full_name || 'Rentora user'}
                              {student.email && <> · <a href={`mailto:${student.email}`} className="text-blue-600">{student.email}</a></>}
                              {student.phone && <> · <a href={`tel:${student.phone}`} className="text-blue-600">{student.phone}</a></>}
                            </div>
                            <div className="md:text-right">
                              {paidAt && <>Paid: {paidAt.toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}</>}
                              {isHeld && releaseAt && <> · Auto-release: {releaseAt.toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })}</>}
                              {!isHeld && !isRefunded && p.released_at && <> · Released: {new Date(p.released_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}</>}
                              {isRefunded && p.refunded_at && <> · Refunded: {new Date(p.refunded_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}</>}
                            </div>
                            {p.reference && (
                              <div className="md:col-span-2 font-mono text-[11px] break-all">Ref: {p.reference}</div>
                            )}
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </>
            );
          })()}
        </TabsContent>
      </Tabs>


      {/* Withdrawal Dialog */}
      <Dialog open={showWithdrawDialog} onOpenChange={setShowWithdrawDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Withdrawal</DialogTitle>
            <DialogDescription>
              Funds will be sent to your registered bank account with no withdrawal fee. Admin will process within 1–2 business days.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {bankDetails ? (
              <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-sm">
                <p className="font-medium text-blue-800">{bankDetails.bank_name}</p>
                <p className="text-blue-600">{bankDetails.account_number} — {bankDetails.account_name}</p>
              </div>
            ) : (
              <div className="p-3 rounded-lg bg-yellow-50 border border-yellow-200 text-sm text-yellow-800">
                No bank account set up. Go to Bank Details tab to add one.
              </div>
            )}
            <div>
              <Label>Amount (₦)</Label>
              <Input
                type="number"
                min={withdrawalAPI.MIN_WITHDRAWAL_AMOUNT}
                placeholder={`Min ₦${withdrawalAPI.MIN_WITHDRAWAL_AMOUNT.toLocaleString('en-NG')}`}
                value={withdrawAmount}
                onChange={e => setWithdrawAmount(e.target.value)}
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Minimum ₦{withdrawalAPI.MIN_WITHDRAWAL_AMOUNT.toLocaleString('en-NG')} per request — available balance: ₦{balance.available.toLocaleString('en-NG')}.
              </p>
            </div>
            {withdrawAmount > 0 && (
              <div className="p-3 rounded-lg bg-muted text-sm space-y-1">
                <div className="flex justify-between"><span className="text-muted-foreground">Withdrawal fee</span><span>₦0</span></div>
                <div className="flex justify-between font-semibold pt-1 border-t"><span>You'll receive</span><span>₦{Number(withdrawAmount || 0).toLocaleString('en-NG')}</span></div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowWithdrawDialog(false)}>Cancel</Button>
            <Button onClick={handleWithdraw} disabled={submittingWithdrawal || !bankDetails}>
              {submittingWithdrawal ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Submitting...</> : 'Submit Request'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Property Dialog */}
      <Dialog open={showPropertyDialog} onOpenChange={setShowPropertyDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingProperty ? 'Edit Property' : 'Add New Property'}</DialogTitle>
            <DialogDescription>Fill in the details below to {editingProperty ? 'update your' : 'list a new'} property.</DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            {/* ── Basic Information ── */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-primary uppercase tracking-wide border-b pb-2">Basic Information</h3>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Title *</Label><Input value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} placeholder="Cozy Student Hostel" /></div>
                <div className="space-y-2"><Label>Property Type *</Label>
                  <Select value={formData.property_type} onValueChange={(value) => setFormData({ ...formData, property_type: value })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hostel"><Home className="w-4 h-4 inline mr-2" />Hostel</SelectItem>
                      <SelectItem value="apartment"><Building className="w-4 h-4 inline mr-2" />Apartment</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Location *</Label>
                <Select value={formData.location_id ? String(formData.location_id) : ''} onValueChange={(v) => setFormData({ ...formData, location_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select a location" /></SelectTrigger>
                  <SelectContent>
                    {locations.map(loc => (
                      <SelectItem key={loc.id} value={String(loc.id)}>{loc.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Address<span className="text-xs text-muted-foreground font-normal ml-1">exact street address / house number / landmark</span></Label>
                <Input
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="e.g. 12 Ogbomoso Road, behind LAUTECH gate"
                />
              </div>
              <div className="space-y-2">
                <Label>Google Maps Link<span className="text-xs text-muted-foreground font-normal ml-1">so students can get directions</span></Label>
                <Input
                  value={formData.google_maps_link}
                  onChange={(e) => setFormData({ ...formData, google_maps_link: e.target.value })}
                  placeholder="Paste the share link from Google Maps"
                />
                <p className="text-xs text-muted-foreground">
                  Open the location in Google Maps, tap Share, and paste the link here.
                </p>
              </div>
              <div className="space-y-2"><Label>Description</Label><Textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="Describe the property..." rows={4} /></div>
            </div>

            {/* ── Pricing & Fees ── */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-primary uppercase tracking-wide border-b pb-2">Pricing &amp; Fees</h3>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Price (₦/year) *</Label><Input type="number" min="0" value={formData.price} onChange={(e) => setFormData({ ...formData, price: e.target.value })} placeholder="120000" /></div>
                <div className="space-y-2"><Label>Agency Fee (₦)</Label><Input type="number" min="0" value={formData.agency_fee} onChange={(e) => setFormData({ ...formData, agency_fee: e.target.value })} placeholder="e.g. 50000" /></div>
                <div className="space-y-2"><Label>Agreement Fee (₦)</Label><Input type="number" min="0" value={formData.agreement_fee} onChange={(e) => setFormData({ ...formData, agreement_fee: e.target.value })} placeholder="e.g. 10000" /></div>
                <div className="space-y-2"><Label>Caution Fee (₦)</Label><Input type="number" min="0" value={formData.caution_fee} onChange={(e) => setFormData({ ...formData, caution_fee: e.target.value })} placeholder="e.g. 50000" /></div>
                <div className="space-y-2"><Label>Documentation Fee (₦)</Label><Input type="number" min="0" value={formData.documentation_fee} onChange={(e) => setFormData({ ...formData, documentation_fee: e.target.value })} placeholder="e.g. 5000" /></div>
                <div className="space-y-2"><Label>Inspection Fee (₦)</Label><Input type="number" min="0" value={formData.inspection_fee} onChange={(e) => setFormData({ ...formData, inspection_fee: e.target.value })} placeholder="e.g. 3000" /><p className="text-xs text-muted-foreground">Amount students pay to request an inspection for this property.</p></div>
                <div className="space-y-2"><Label>Recurring Payment (₦/year)</Label><Input type="number" min="0" value={formData.recurring_payment} onChange={(e) => setFormData({ ...formData, recurring_payment: e.target.value })} placeholder="e.g. 200000" /><p className="text-xs text-muted-foreground">Not collected by Rentora.</p></div>
              </div>
              <div className="space-y-3 rounded-lg border p-3">
                <div className="flex items-center justify-between gap-3"><div><Label>Other Fees</Label><p className="text-xs text-muted-foreground">Add a clear name and amount for each legitimate additional charge.</p></div><Button type="button" variant="outline" size="sm" onClick={() => setFormData(prev => ({ ...prev, other_fees: [...(prev.other_fees || []), { name: '', amount: '' }] }))}><Plus className="h-4 w-4 mr-1" />Add Fee</Button></div>
                {(formData.other_fees || []).map((fee, i) => <div key={i} className="grid grid-cols-[minmax(0,1fr)_140px_auto] gap-2 items-end"><Input value={fee.name} onChange={(e) => setFormData(prev => ({ ...prev, other_fees: prev.other_fees.map((f, j) => j === i ? { ...f, name: e.target.value } : f) }))} placeholder="Fee name" /><Input type="number" min="0" value={fee.amount} onChange={(e) => setFormData(prev => ({ ...prev, other_fees: prev.other_fees.map((f, j) => j === i ? { ...f, amount: e.target.value } : f) }))} placeholder="Amount" /><Button type="button" variant="ghost" size="icon" onClick={() => setFormData(prev => ({ ...prev, other_fees: prev.other_fees.filter((_, j) => j !== i) }))}><X className="h-4 w-4" /></Button></div>)}
              </div>
            </div>

            {/* ── Amenities ── */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-primary uppercase tracking-wide border-b pb-2">Amenities</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {AMENITY_OPTIONS.map((item) => {
                  const checked = formData.amenities.includes(item);
                  return (
                    <label key={item} className="flex items-center gap-2 text-sm p-2 rounded-md border cursor-pointer hover:bg-muted/50">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          setFormData({
                            ...formData,
                            amenities: checked
                              ? formData.amenities.filter((a) => a !== item)
                              : [...formData.amenities, item],
                          });
                        }}
                      />
                      {item}
                    </label>
                  );
                })}
              </div>
            </div>

            {/* ── Contact Information ── */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-primary uppercase tracking-wide border-b pb-2">Contact Information</h3>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Contact Name *<span className="text-xs text-muted-foreground font-normal ml-1"></span></Label><Input value={formData.contact_name} onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })} placeholder="John Doe" /></div>
                <div className="space-y-2"><Label>Contact Phone *</Label><Input value={formData.contact_phone} onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })} placeholder="+234..." /></div>
              </div>
            </div>

            {/* ── Property Owner — Payout Details ── */}
            <div className="space-y-4">
              <div className="border-b pb-2">
                <h3 className="text-sm font-semibold text-primary uppercase tracking-wide">Property Owner Details</h3>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Owner Full Name *</Label><Input disabled={ownerDetailsLocked} value={formData.owner_full_name} onChange={(e) => setFormData({ ...formData, owner_full_name: e.target.value })} placeholder="Landlord's full name" /></div>
                <div className="space-y-2"><Label>Owner Phone *</Label><Input disabled={ownerDetailsLocked} value={formData.owner_phone} onChange={(e) => setFormData({ ...formData, owner_phone: e.target.value })} placeholder="+234..." /></div>
              </div>
            </div>

            {/* ── Property Images ── */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-primary uppercase tracking-wide border-b pb-2">Property Images</h3>
              <Label className="text-muted-foreground text-xs font-normal">Max 3 images, up to 5MB each</Label>
              <div onClick={() => !uploadingImage && fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${uploadingImage ? 'opacity-50 cursor-not-allowed border-muted' : 'border-muted-foreground/25 hover:border-primary hover:bg-muted/30'}`}>
                <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFileSelect} />
                {uploadingImage ? (
                  <div className="flex flex-col items-center gap-2"><Loader2 className="w-8 h-8 text-primary animate-spin" /><p className="text-sm text-muted-foreground">Uploading...</p></div>
                ) : (
                  <div className="flex flex-col items-center gap-2"><Upload className="w-8 h-8 text-muted-foreground" /><p className="text-sm font-medium">Click to upload images</p><p className="text-xs text-muted-foreground">JPG, PNG, WEBP supported</p></div>
                )}
              </div>
              {formData.images.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {formData.images.map((img, index) => (
                    <div key={index} className="relative group aspect-square">
                      <img src={img} alt={`Property ${index + 1}`} className="w-full h-full rounded-lg object-cover cursor-pointer" onClick={() => openLightbox(formData.images, index)} loading="lazy" decoding="async" width="800" height="600" />
                      <button type="button" onClick={() => handleRemoveImage(index)}
                        className="absolute top-1 right-1 w-5 h-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-md">
                        <XCircle className="w-3.5 h-3.5" />
                      </button>
                      {index === 0 && <span className="absolute bottom-1 left-1 text-xs bg-black/60 text-white px-1 rounded pointer-events-none">Cover</span>}
                    </div>
                  ))}
                  {formData.images.length < 3 && (
                    <div onClick={() => fileInputRef.current?.click()}
                      className="aspect-square rounded-lg border-2 border-dashed border-muted-foreground/25 flex items-center justify-center cursor-pointer hover:border-primary hover:bg-muted/30 transition-colors">
                      <Plus className="w-6 h-6 text-muted-foreground" />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowPropertyDialog(false); resetForm(); }}>Cancel</Button>
            <Button onClick={handleSubmitProperty} disabled={uploadingImage || submittingProperty}>
              {uploadingImage ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Uploading...</>
                : submittingProperty ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{editingProperty ? 'Updating' : 'Submitting'}...</>
                : <>{editingProperty ? 'Update' : 'Create'} Property</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default AgentDashboard;
