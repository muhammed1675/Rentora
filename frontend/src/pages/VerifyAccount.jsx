import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '../lib/auth';
import { studentVerificationAPI, storageAPI } from '../lib/api';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Upload, ShieldCheck, Clock, XCircle, Camera, FileText, Loader2, X, CheckCircle2 } from 'lucide-react';
import { useSubmitGuard } from '../hooks/useSubmitGuard';

const DOC_TYPES = [
  { value: 'student_id', label: 'Student ID card' },
  { value: 'admission_letter', label: 'Admission letter' },
];

// Shared drag-and-drop upload card. Handles drag state, click-to-browse,
// and a preview once a file is chosen (thumbnail for images, filename for PDFs).
function DropZone({ icon: Icon, title, description, accept, capture, file, onChange, previewShape = 'wide' }) {
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef(null);

  const handleFiles = (fileList) => {
    const f = fileList?.[0];
    if (f) onChange(f);
  };

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
      onDragLeave={(e) => { e.preventDefault(); setDragActive(false); }}
      onDrop={(e) => {
        e.preventDefault();
        setDragActive(false);
        handleFiles(e.dataTransfer.files);
      }}
      className={`rounded-xl border-2 border-dashed p-6 text-center transition-colors ${
        dragActive ? 'border-primary bg-primary/5' : file ? 'border-green-300 bg-green-50/40' : 'border-muted-foreground/25'
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        capture={capture}
        onChange={(e) => handleFiles(e.target.files)}
        className="hidden"
      />

      {!file && (
        <>
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Icon className="h-6 w-6 text-primary" />
          </div>
          <h3 className="font-semibold">{title}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          <Button type="button" variant="outline" className="mt-4 gap-2" onClick={() => inputRef.current?.click()}>
            <Upload className="h-4 w-4" /> {capture ? 'Take Selfie' : 'Upload Document'}
          </Button>
          <p className="mt-2 text-xs text-muted-foreground">or drag and drop a file here</p>
        </>
      )}

      {file && (
        <div className="flex items-center gap-3">
          {previewShape === 'round' && file.type.startsWith('image/') ? (
            <img src={URL.createObjectURL(file)} alt="Selfie preview" className="h-16 w-16 shrink-0 rounded-full object-cover" />
          ) : file.type.startsWith('image/') ? (
            <img src={URL.createObjectURL(file)} alt="Document preview" className="h-16 w-16 shrink-0 rounded-lg object-cover border" />
          ) : (
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border bg-muted">
              <FileText className="h-6 w-6 text-muted-foreground" />
            </div>
          )}
          <div className="min-w-0 flex-1 text-left">
            <p className="flex items-center gap-1.5 text-sm font-medium text-green-700">
              <CheckCircle2 className="h-4 w-4 shrink-0" /> Ready
            </p>
            <p className="truncate text-xs text-muted-foreground">{file.name}</p>
          </div>
          <Button type="button" variant="ghost" size="icon" className="shrink-0" onClick={() => { onChange(null); if (inputRef.current) inputRef.current.value = ''; }}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

export default function VerifyAccount() {
  const { guard } = useSubmitGuard();
  const { user, refreshUser, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const nextPath = new URLSearchParams(location.search).get('next') || '/browse';

  const [request, setRequest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [documentType, setDocumentType] = useState('student_id');
  const [matricNumber, setMatricNumber] = useState('');
  const [documentFile, setDocumentFile] = useState(null);
  const [selfieFile, setSelfieFile] = useState(null);

  const load = useCallback(async () => {
    if (!user?.id) return;
    try {
      const { data } = await studentVerificationAPI.getMyRequest(user.id);
      setRequest(data || null);
    } catch (e) {
      // Non-fatal: the form below still lets them submit.
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);

  // Already approved? Nothing to do here.
  useEffect(() => {
    if (user?.verification_status === 'approved') navigate(nextPath, { replace: true });
  }, [user?.verification_status, navigate, nextPath]);

  const handleSkip = () => navigate(nextPath, { replace: true });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!documentFile) { toast.error('Please upload your student ID card or admission letter'); return; }
    if (!selfieFile) { toast.error('Please upload a clear selfie'); return; }

    setSubmitting(true);
    try {
      const [{ data: doc }, { data: selfie }] = await Promise.all([
        storageAPI.uploadFile(documentFile, 'student-doc'),
        storageAPI.uploadImage(selfieFile, 'avatars', { maxWidthOrHeight: 800, maxSizeMB: 0.3 }),
      ]);

      await studentVerificationAPI.submit({
        document_type: documentType,
        document_url: doc.url,
        selfie_url: selfie.url,
        matric_number: matricNumber.trim(),
      }, user);

      toast.success('Documents submitted — we will review them shortly.');
      await refreshUser();
      await load();
    } catch (err) {
      toast.error(err.message || 'Could not submit your documents. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const status = request?.status || user?.verification_status || 'none';

  return (
    <div className="container max-w-2xl py-10 px-4">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
          <ShieldCheck className="h-7 w-7 text-primary" />
        </div>
        <h1 className="text-2xl font-bold sm:text-3xl">Verify your student account</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          We verify every student to keep Rentora a safe, scam-free community. Upload your
          school document and a selfie so we can confirm it's really you. Your selfie becomes
          your profile picture.
        </p>
        {status === 'none' && (
          <p className="mt-1 text-xs text-muted-foreground">
            You can browse Rentora without this — it's only needed to pay rent, book a
            viewing, unlock a contact, or post a review.
          </p>
        )}
      </div>

      {(status === 'none' || status === 'rejected') && (
        <div className="mb-4 flex justify-center">
          <Button type="button" variant="ghost" onClick={handleSkip} data-testid="skip-verification-btn">
            Skip for now
          </Button>
        </div>
      )}

      {status === 'pending' && (
        <Card className="p-6 text-center">
          <Clock className="mx-auto mb-3 h-8 w-8 text-amber-500" />
          <h2 className="text-lg font-semibold">Under review</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            We have received your documents. Reviews usually take a few hours — we will
            email you as soon as your account is verified.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button variant="outline" onClick={load}>Refresh status</Button>
            <Button variant="ghost" onClick={() => navigate('/contact')}>Contact support</Button>
            <Button variant="ghost" onClick={logout}>Log out</Button>
          </div>
        </Card>
      )}

      {status !== 'pending' && (
        <Card className="p-6">
          {status === 'rejected' && (
            <div className="mb-6 rounded-md border border-destructive/40 bg-destructive/5 p-4">
              <div className="flex items-center gap-2 font-medium text-destructive">
                <XCircle className="h-4 w-4" /> Your last submission was not approved
              </div>
              {request?.admin_note && (
                <p className="mt-2 text-sm text-muted-foreground">Reason: {request.admin_note}</p>
              )}
              <p className="mt-2 text-sm text-muted-foreground">
                Please fix the issue above and submit again.
              </p>
            </div>
          )}

          <form onSubmit={guard(handleSubmit)} className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium">Document type</label>
              <div className="flex flex-wrap gap-2">
                {DOC_TYPES.map((t) => (
                  <Button
                    key={t.value}
                    type="button"
                    variant={documentType === t.value ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setDocumentType(t.value)}
                  >
                    {t.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Matric number (optional)</label>
              <Input
                value={matricNumber}
                onChange={(e) => setMatricNumber(e.target.value)}
                placeholder="e.g. 20/30GC000"
              />
            </div>

            <DropZone
              icon={FileText}
              title="1. Upload School Document"
              description={`Upload your ${documentType === 'admission_letter' ? 'Admission Letter' : 'School ID Card'}. Ensure the text is clear and not blurry.`}
              accept="image/jpeg,image/png,image/webp,application/pdf"
              file={documentFile}
              onChange={setDocumentFile}
            />

            <DropZone
              icon={Camera}
              title="2. Take a Selfie"
              description="Take a clear selfie for comparison. Make sure your face is well-lit and clearly visible. This becomes your profile picture."
              accept="image/jpeg,image/png,image/webp"
              capture="user"
              file={selfieFile}
              onChange={setSelfieFile}
              previewShape="round"
            />

            <Button type="submit" className="w-full gap-2" disabled={submitting}>
              {submitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Submitting…</> : <><Upload className="h-4 w-4" /> Submit for Verification</>}
            </Button>
          </form>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t pt-4 text-sm">
            <Badge variant="secondary">Your documents are private and only seen by Rentora admins</Badge>
            <button type="button" onClick={logout} className="text-muted-foreground underline">Log out</button>
          </div>
        </Card>
      )}
    </div>
  );
}