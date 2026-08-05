import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '../lib/auth';
import { studentVerificationAPI, storageAPI } from '../lib/api';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Upload, ShieldCheck, Clock, XCircle, Camera, FileText, Loader2 } from 'lucide-react';

const DOC_TYPES = [
  { value: 'student_id', label: 'Student ID card' },
  { value: 'admission_letter', label: 'Admission letter' },
];

export default function VerifyAccount() {
  const { user, refreshUser, logout } = useAuth();
  const navigate = useNavigate();

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
    if (user?.verification_status === 'approved') navigate('/browse', { replace: true });
  }, [user?.verification_status, navigate]);

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
          Rentora is for verified LAUTECH students only. Upload your school document and a
          selfie so we can confirm it is really you. Your selfie becomes your profile picture.
        </p>
      </div>

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

          <form onSubmit={handleSubmit} className="space-y-6">
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

            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium">
                <FileText className="h-4 w-4" /> School document (image or PDF)
              </label>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                onChange={(e) => setDocumentFile(e.target.files?.[0] || null)}
                className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-sm file:text-primary-foreground"
              />
              {documentFile && <p className="text-xs text-muted-foreground truncate">{documentFile.name}</p>}
            </div>

            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium">
                <Camera className="h-4 w-4" /> Selfie (used as your profile picture)
              </label>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                capture="user"
                onChange={(e) => setSelfieFile(e.target.files?.[0] || null)}
                className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-sm file:text-primary-foreground"
              />
              {selfieFile && (
                <img
                  src={URL.createObjectURL(selfieFile)}
                  alt="Selfie preview"
                  className="h-24 w-24 rounded-full object-cover"
                />
              )}
            </div>

            <Button type="submit" className="w-full gap-2" disabled={submitting}>
              {submitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Submitting…</> : <><Upload className="h-4 w-4" /> Submit for verification</>}
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
