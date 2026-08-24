import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { verificationAPI, storageAPI } from '../lib/api';
import { supabase } from '../lib/supabase';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Shield, Upload, ArrowLeft, CheckCircle2, FileText, Download, Loader2, X, ImageIcon, Building2 } from 'lucide-react';
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
  { code: '232', name: 'Sterling Bank' }, { code: '032', name: 'Union Bank of Nigeria' },
  { code: '033', name: 'United Bank for Africa (UBA)' }, { code: '035', name: 'Wema Bank' },
  { code: '057', name: 'Zenith Bank' },
];

export function BecomeAgent() {
  const { guard } = useSubmitGuard();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAuthenticated, isUser } = useAuth();
  const inviteCode = new URLSearchParams(location.search).get('invite');

  // Keep this page out of search results — it's invite-only and should
  // never surface for anyone who lands here without a link.
  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);
    return () => { document.head.removeChild(meta); };
  }, []);

  const idCardRef = useRef(null);
  const selfieRef = useRef(null);
  const agreementRef = useRef(null);

  const [idCardFile, setIdCardFile] = useState(null);
  const [idCardPreview, setIdCardPreview] = useState(null);
  const [selfieFile, setSelfieFile] = useState(null);
  const [selfiePreview, setSelfiePreview] = useState(null);
  const [agreementFile, setAgreementFile] = useState(null);
  const [address, setAddress] = useState('');
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Bank state
  const [banks, setBanks] = useState(FALLBACK_BANKS);
  const [banksLoading, setBanksLoading] = useState(true);
  const [bankCode, setBankCode] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');

  // Load bank list via the Korapay-backed edge function
  useEffect(() => {
    const loadBanks = async () => {
      try {
        const url = `${process.env.REACT_APP_SUPABASE_URL}/functions/v1/resolve-bank?list=true`;
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${process.env.REACT_APP_SUPABASE_ANON_KEY}` },
        });
        const json = await res.json();
        if (json.status && Array.isArray(json.data)) {
          const sorted = json.data
            .filter((b) => b.name && b.code)
            .sort((a, b) => a.name.localeCompare(b.name));
          setBanks(sorted);
        }
      } catch (e) {
        // keep fallback
      } finally {
        setBanksLoading(false);
      }
    };
    loadBanks();
  }, []);

  const handleBankChange = (value) => {
    const selected = banks.find(b => b.code === value);
    setBankCode(value);
    setBankName(selected?.name || '');
  };

  const handleImageSelect = (e, setFile, setPreview) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Please select an image file'); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error('Image must be under 5MB'); return; }
    setFile(file);
    setPreview(URL.createObjectURL(file));
  };

  const handleAgreementSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.type !== 'application/pdf') { toast.error('Please upload a PDF file'); return; }
    if (file.size > 10 * 1024 * 1024) { toast.error('PDF must be under 10MB'); return; }
    setAgreementFile(file);
    toast.success('Agreement PDF selected');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!idCardFile) { toast.error('Please upload your ID card photo'); return; }
    if (!selfieFile) { toast.error('Please upload your selfie with ID'); return; }
    if (!agreementFile) { toast.error('Please upload the signed agreement PDF'); return; }
    if (!address.trim()) { toast.error('Please enter your address'); return; }
    if (!bankCode) { toast.error('Please select your bank'); return; }
    if (accountNumber.length !== 10) { toast.error('Please enter a valid 10-digit account number'); return; }
    if (!accountName.trim()) { toast.error('Please enter your account name'); return; }

    setUploading(true);
    try {
      // Re-check the invite right before we act on it — it may have been
      // used, revoked, or expired since the page loaded.
      const { data: redeemed, error: redeemError } = await supabase.rpc('redeem_agent_invite', { p_code: inviteCode });
      if (redeemError || !redeemed) {
        toast.error('This invite link is no longer valid. Please ask for a new one.');
        setUploading(false);
        return;
      }

      toast.loading('Uploading documents...', { id: 'upload' });
      const [idCardResult, selfieResult, agreementResult] = await Promise.all([
        storageAPI.uploadFile(idCardFile, 'verification/id-cards'),
        storageAPI.uploadFile(selfieFile, 'verification/selfies'),
        storageAPI.uploadFile(agreementFile, 'verification/agreements'),
      ]);
      toast.dismiss('upload');
      setUploading(false);
      setLoading(true);
      await verificationAPI.request({
        id_card_url: idCardResult.data.url,
        selfie_url: selfieResult.data.url,
        agreement_url: agreementResult.data.url,
        address,
        bank_code: bankCode,
        bank_name: bankName,
        account_number: accountNumber,
        account_name: accountName.trim().toUpperCase(),
      }, user);
      toast.success('Verification request submitted!');
      setSubmitted(true);
    } catch (error) {
      toast.dismiss('upload');
      toast.error(error.message || 'Failed to submit. Please try again.');
    } finally {
      setUploading(false);
      setLoading(false);
    }
  };

  if (!isAuthenticated) { navigate('/login'); return null; }
  if (!isUser) { navigate('/'); return null; }
  if (!inviteCode) { navigate('/', { replace: true }); return null; }

  if (submitted) {
    return (
      <div className="container mx-auto py-6">
        <div className="max-w-lg mx-auto">
          <Card className="p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8 text-green-600" />
            </div>
            <h1 className="text-2xl font-bold mb-2">Request Submitted!</h1>
            <p className="text-foreground/60 mb-6">Your agent verification request has been submitted including your bank account details. Our admin team will review your documents and get back to you soon.</p>
            <Button onClick={() => navigate('/profile')}>Back to Profile</Button>
          </Card>
        </div>
      </div>
    );
  }

  const isLoading = uploading || loading;

  return (
    <div className="container mx-auto py-6" data-testid="become-agent-page">
      <Button variant="ghost" onClick={() => navigate('/profile')} className="mb-4 gap-2">
        <ArrowLeft className="w-4 h-4" /> Back to Profile
      </Button>

      <div className="max-w-lg mx-auto">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Shield className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Become an Agent</h1>
          <p className="text-foreground/60 mt-2">Submit your verification documents to become a property agent</p>
        </div>

        <Card className="p-5 mb-4 border-primary/30 bg-primary/5">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center shrink-0 text-white font-bold text-sm">1</div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold">Download & Sign Agreement</h3>
              <p className="text-sm text-foreground/60 mt-1 mb-3">Download the agent agreement, read it carefully, sign it, and upload the signed copy below.</p>
              <a href="/agent-agreement.pdf" download="Rentora-Agent-Agreement.pdf"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors">
                <Download className="w-4 h-4" /> Download Agent Agreement PDF
              </a>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <form onSubmit={guard(handleSubmit)} className="space-y-6">

            {/* ID Card */}
            <div className="space-y-2">
              <Label>ID Card Photo <span className="text-destructive">*</span></Label>
              <p className="text-xs text-foreground/55">National ID, Voter's card, Driver's license, or International passport</p>
              <input ref={idCardRef} type="file" accept="image/*" className="hidden"
                onChange={(e) => handleImageSelect(e, setIdCardFile, setIdCardPreview)} />
              {idCardPreview ? (
                <div className="relative group">
                  <img src={idCardPreview} alt="ID Card" className="w-full max-h-44 object-contain rounded-lg border bg-muted/30" loading="lazy" decoding="async" width="800" height="600" />
                  <button type="button" onClick={() => { setIdCardFile(null); setIdCardPreview(null); if (idCardRef.current) idCardRef.current.value = ''; }}
                    className="absolute top-2 right-2 w-7 h-7 bg-destructive text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow">
                    <X className="w-4 h-4" />
                  </button>
                  <p className="text-xs text-green-600 font-medium mt-1.5 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> {idCardFile?.name}
                  </p>
                </div>
              ) : (
                <div onClick={() => idCardRef.current?.click()}
                  className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center cursor-pointer hover:border-primary hover:bg-muted/20 transition-colors">
                  <ImageIcon className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                  <p className="text-sm font-medium">Click to upload ID card</p>
                  <p className="text-xs text-muted-foreground mt-1">JPG, PNG up to 5MB</p>
                </div>
              )}
            </div>

            {/* Selfie */}
            <div className="space-y-2">
              <Label>Selfie Holding ID Card <span className="text-destructive">*</span></Label>
              <p className="text-xs text-foreground/55">A clear photo of you holding your ID card</p>
              <input ref={selfieRef} type="file" accept="image/*" className="hidden"
                onChange={(e) => handleImageSelect(e, setSelfieFile, setSelfiePreview)} />
              {selfiePreview ? (
                <div className="relative group">
                  <img src={selfiePreview} alt="Selfie" className="w-full max-h-44 object-contain rounded-lg border bg-muted/30" loading="lazy" decoding="async" width="800" height="600" />
                  <button type="button" onClick={() => { setSelfieFile(null); setSelfiePreview(null); if (selfieRef.current) selfieRef.current.value = ''; }}
                    className="absolute top-2 right-2 w-7 h-7 bg-destructive text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow">
                    <X className="w-4 h-4" />
                  </button>
                  <p className="text-xs text-green-600 font-medium mt-1.5 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> {selfieFile?.name}
                  </p>
                </div>
              ) : (
                <div onClick={() => selfieRef.current?.click()}
                  className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center cursor-pointer hover:border-primary hover:bg-muted/20 transition-colors">
                  <ImageIcon className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                  <p className="text-sm font-medium">Click to upload selfie with ID</p>
                  <p className="text-xs text-muted-foreground mt-1">JPG, PNG up to 5MB</p>
                </div>
              )}
            </div>

            {/* Agreement */}
            <div className="space-y-2">
              <Label>Signed Agreement PDF <span className="text-destructive">*</span></Label>
              <p className="text-xs text-foreground/55">Upload the signed agreement you downloaded in Step 1</p>
              <input ref={agreementRef} type="file" accept="application/pdf" className="hidden" onChange={handleAgreementSelect} />
              {agreementFile ? (
                <div className="flex items-center gap-3 p-3 rounded-lg border bg-green-50 border-green-200">
                  <FileText className="w-8 h-8 text-green-600 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-green-800 truncate">{agreementFile.name}</p>
                    <p className="text-xs text-green-600">{(agreementFile.size / 1024).toFixed(0)} KB</p>
                  </div>
                  <button type="button" onClick={() => { setAgreementFile(null); if (agreementRef.current) agreementRef.current.value = ''; }}
                    className="w-7 h-7 bg-destructive text-white rounded-full flex items-center justify-center shrink-0">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div onClick={() => agreementRef.current?.click()}
                  className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center cursor-pointer hover:border-primary hover:bg-muted/20 transition-colors">
                  <FileText className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                  <p className="text-sm font-medium">Click to upload signed PDF</p>
                  <p className="text-xs text-muted-foreground mt-1">PDF only, up to 10MB</p>
                </div>
              )}
            </div>

            {/* Address */}
            <div className="space-y-2">
              <Label>Home Address <span className="text-destructive">*</span></Label>
              <Textarea value={address} onChange={(e) => setAddress(e.target.value)}
                placeholder="Your full address..." rows={3} data-testid="address-input" />
            </div>

            {/* Bank Details */}
            <div className="space-y-4 pt-2">
              <div className="flex items-center gap-2 pb-1 border-b">
                <Building2 className="w-4 h-4 text-primary" />
                <h3 className="font-semibold text-sm">Bank Account Details</h3>
              </div>
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
                ⚠ Your account name <strong>must match</strong> the name on your ID card. Payments will not be sent to mismatched accounts.
              </p>

              <div className="space-y-2">
                <Label>Bank <span className="text-destructive">*</span></Label>
                <Select value={bankCode} onValueChange={handleBankChange} disabled={banksLoading}>
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
                <Input type="text" inputMode="numeric" maxLength={10}
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ''))}
                  placeholder="10-digit account number" />
                {accountNumber.length > 0 && accountNumber.length < 10 && (
                  <p className="text-xs text-muted-foreground">{10 - accountNumber.length} more digit{10 - accountNumber.length !== 1 ? 's' : ''} needed</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Account Name <span className="text-destructive">*</span></Label>
                <Input
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  placeholder="e.g. JOHN ADEYEMI OKAFOR"
                />
                <p className="text-xs text-muted-foreground">Enter exactly as it appears on your bank account — must match your ID card name</p>
              </div>
            </div>

            <Button type="submit" disabled={isLoading || !accountName.trim()} className="w-full h-12" data-testid="submit-verification-btn">
              {uploading ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Uploading documents...</>
              ) : loading ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Submitting request...</>
              ) : (
                <><Upload className="w-4 h-4 mr-2" /> Submit Verification Request</>
              )}
            </Button>
          </form>
        </Card>

        <p className="text-center text-sm text-foreground/55 mt-4">
          Once approved, you'll be able to list properties and manage viewings.
        </p>
      </div>
    </div>
  );
}

export default BecomeAgent;
