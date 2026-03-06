import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { verificationAPI, storageAPI } from '../lib/api';
import { supabase } from '../lib/supabase';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Label } from '../components/ui/label';
import { Shield, Upload, ArrowLeft, CheckCircle2, FileText, Download, Loader2, X, ImageIcon, Building2, CreditCard, User } from 'lucide-react';
import { toast } from 'sonner';

const NIGERIAN_BANKS = [
  { code: '044', name: 'Access Bank' },
  { code: '063', name: 'Access Bank (Diamond)' },
  { code: '035A', name: 'ALAT by Wema' },
  { code: '050', name: 'Ecobank Nigeria' },
  { code: '070', name: 'Fidelity Bank' },
  { code: '011', name: 'First Bank of Nigeria' },
  { code: '214', name: 'First City Monument Bank' },
  { code: '058', name: 'Guaranty Trust Bank' },
  { code: '030', name: 'Heritage Bank' },
  { code: '301', name: 'Jaiz Bank' },
  { code: '082', name: 'Keystone Bank' },
  { code: '526', name: 'Kuda Bank' },
  { code: '090405', name: 'Moniepoint MFB' },
  { code: '076', name: 'Polaris Bank' },
  { code: '101', name: 'Providus Bank' },
  { code: '221', name: 'Stanbic IBTC Bank' },
  { code: '068', name: 'Standard Chartered Bank' },
  { code: '232', name: 'Sterling Bank' },
  { code: '032', name: 'Union Bank of Nigeria' },
  { code: '033', name: 'United Bank for Africa' },
  { code: '215', name: 'Unity Bank' },
  { code: '035', name: 'Wema Bank' },
  { code: '057', name: 'Zenith Bank' },
  { code: '120001', name: 'PalmPay' },
  { code: '999992', name: 'OPay' },
  { code: '090110', name: 'VFD Microfinance Bank' },
];

export function BecomeAgent() {
  const navigate = useNavigate();
  const { user, isAuthenticated, isUser } = useAuth();

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

  // Bank details
  const [bankCode, setBankCode] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');
  const [verifyingAccount, setVerifyingAccount] = useState(false);
  const [accountVerified, setAccountVerified] = useState(false);

  useEffect(() => {
    if (accountNumber.length === 10 && bankCode) {
      verifyAccountNumber();
    } else {
      setAccountName('');
      setAccountVerified(false);
    }
  }, [accountNumber, bankCode]); // eslint-disable-line react-hooks/exhaustive-deps

  const verifyAccountNumber = async () => {
    setVerifyingAccount(true);
    setAccountName('');
    setAccountVerified(false);
    try {
      const { data, error } = await supabase.functions.invoke('resolve-bank', {
        body: { account_number: accountNumber, bank_code: bankCode },
      });

      if (error) throw new Error(error.message);

      if (data?.success && data?.account_name) {
        setAccountName(data.account_name);
        setAccountVerified(true);
        toast.success('Account verified!');
      } else {
        toast.error(data?.message || 'Could not verify account. Check the number and bank.');
      }
    } catch (err) {
      console.error('Bank verify error:', err);
      toast.error('Account verification failed. Please check details.');
    } finally {
      setVerifyingAccount(false);
    }
  };

  const handleBankChange = (e) => {
    const selected = NIGERIAN_BANKS.find(b => b.code === e.target.value);
    setBankCode(e.target.value);
    setBankName(selected?.name || '');
    setAccountName('');
    setAccountVerified(false);
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
    if (!accountNumber || accountNumber.length !== 10) { toast.error('Please enter a valid 10-digit account number'); return; }
    if (!accountVerified) { toast.error('Please wait for account verification'); return; }

    setUploading(true);
    try {
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
        account_name: accountName,
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

  if (submitted) {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="max-w-lg mx-auto">
          <Card className="p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8 text-green-600" />
            </div>
            <h1 className="text-2xl font-bold mb-2">Request Submitted!</h1>
            <p className="text-foreground/60 mb-6">
              Your agent verification request has been submitted. Our admin team will review your documents and get back to you soon.
            </p>
            <Button onClick={() => navigate('/profile')}>Back to Profile</Button>
          </Card>
        </div>
      </div>
    );
  }

  const isLoading = uploading || loading;

  return (
    <div className="container mx-auto px-4 py-6" data-testid="become-agent-page">
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
              <p className="text-sm text-foreground/60 mt-1 mb-3">
                Download the agent agreement, read it carefully, sign it, and upload the signed copy below.
              </p>
              <a href="/agent-agreement.pdf" download="Rentora-Agent-Agreement.pdf"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors">
                <Download className="w-4 h-4" /> Download Agent Agreement PDF
              </a>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <form onSubmit={handleSubmit} className="space-y-6">

            {/* ID Card */}
            <div className="space-y-2">
              <Label>ID Card Photo <span className="text-destructive">*</span></Label>
              <p className="text-xs text-foreground/55">National ID, Voter's card, Driver's license, or International passport</p>
              <input ref={idCardRef} type="file" accept="image/*" className="hidden"
                onChange={(e) => handleImageSelect(e, setIdCardFile, setIdCardPreview)} />
              {idCardPreview ? (
                <div className="relative group">
                  <img src={idCardPreview} alt="ID Card" className="w-full max-h-44 object-contain rounded-lg border bg-muted/30" />
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
              <p className="text-xs text-foreground/55">A clear photo of you holding your ID card so your face and ID are both visible</p>
              <input ref={selfieRef} type="file" accept="image/*" className="hidden"
                onChange={(e) => handleImageSelect(e, setSelfieFile, setSelfiePreview)} />
              {selfiePreview ? (
                <div className="relative group">
                  <img src={selfiePreview} alt="Selfie" className="w-full max-h-44 object-contain rounded-lg border bg-muted/30" />
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
                placeholder="Your full address in Ogbomosho..." rows={3} data-testid="address-input" />
            </div>

            {/* Bank Details */}
            <div className="space-y-4 pt-2">
              <div className="flex items-center gap-2 pb-1 border-b">
                <Building2 className="w-4 h-4 text-primary" />
                <h3 className="font-semibold text-sm">Bank Account Details</h3>
              </div>
              <p className="text-xs text-foreground/55 -mt-2">
                Required for receiving inspection payouts. Your account name will be verified automatically.
              </p>

              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5" /> Bank <span className="text-destructive">*</span>
                </Label>
                <select value={bankCode} onChange={handleBankChange}
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                  <option value="">Select your bank...</option>
                  {NIGERIAN_BANKS.map(bank => (
                    <option key={bank.code} value={bank.code}>{bank.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5" /> Account Number <span className="text-destructive">*</span>
                </Label>
                <Input type="text" inputMode="numeric" maxLength={10}
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ''))}
                  placeholder="10-digit account number" />
                {accountNumber.length > 0 && accountNumber.length < 10 && (
                  <p className="text-xs text-muted-foreground">{10 - accountNumber.length} more digit{10 - accountNumber.length !== 1 ? 's' : ''} needed</p>
                )}
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5" /> Account Name
                </Label>
                <div className="relative">
                  <Input readOnly value={accountName}
                    placeholder={verifyingAccount ? 'Verifying...' : 'Auto-detected after entering account number'}
                    className={`pr-10 ${accountVerified ? 'border-green-500 bg-green-50 text-green-800 font-medium' : 'bg-muted/40'}`} />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {verifyingAccount && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
                    {accountVerified && <CheckCircle2 className="w-4 h-4 text-green-600" />}
                  </div>
                </div>
                {accountVerified && (
                  <p className="text-xs text-green-600 font-medium flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Account verified successfully
                  </p>
                )}
              </div>
            </div>

            <Button type="submit" disabled={isLoading || !accountVerified} className="w-full h-12" data-testid="submit-verification-btn">
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
          Once approved, you'll be able to list properties and manage inspections.
        </p>
      </div>
    </div>
  );
}

export default BecomeAgent;
