import { createContext, useContext, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';
import { ShieldCheck, Clock } from 'lucide-react';

// Every gated action (unlock, book a viewing, pay rent, leave a review or
// report a listing) calls requireVerification(action) first. It returns
// true and does nothing when the user is allowed through; otherwise it
// opens the "Verify to continue" dialog and returns false so the caller
// bails out of its handler.
//
//   const { requireVerification } = useVerifyGate();
//   const handlePay = () => {
//     if (!requireVerification('pay')) return;
//     ... proceed ...
//   };

const VerifyGateContext = createContext(null);

const ACTION_COPY = {
  pay: {
    title: 'Verify to pay rent',
    body: 'Paying rent requires an approved student verification — no exceptions.',
  },
  unlock: {
    title: 'Verify to continue',
    body: 'Unlocking this contact requires verification.',
  },
  book: {
    title: 'Verify to book a viewing',
    body: 'Booking an inspection requires an approved student verification.',
  },
  review: {
    title: 'Verify to leave a review',
    body: 'Posting a review requires an approved student verification.',
  },
  report: {
    title: 'Verify to report a listing',
    body: 'Reporting a property requires an approved student verification.',
  },
  default: {
    title: 'Verify to continue',
    body: 'This action requires an approved student verification.',
  },
};

export function VerifyGateProvider({ children }) {
  const { isAuthenticated, verificationStatus, canPay, canUnlock } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [dialogState, setDialogState] = useState({ open: false, action: 'default' });

  // Payments are always approved-only, no exceptions. Everything else
  // (book/review/report) also requires approved. Unlock is the one
  // action allowed to proceed on 'pending' as well as 'approved'.
  const isAllowed = useCallback((action) => {
    if (!isAuthenticated) return false;
    if (action === 'unlock') return canUnlock;
    if (action === 'pay') return canPay;
    return verificationStatus === 'approved';
  }, [isAuthenticated, verificationStatus, canPay, canUnlock]);

  const requireVerification = useCallback((action = 'default') => {
    if (isAllowed(action)) return true;

    if (!isAuthenticated) {
      const next = encodeURIComponent(location.pathname + location.search);
      navigate(`/login?next=${next}`);
      return false;
    }

    setDialogState({ open: true, action });
    return false;
  }, [isAllowed, isAuthenticated, navigate, location]);

  const closeDialog = () => setDialogState((s) => ({ ...s, open: false }));

  const goVerify = () => {
    closeDialog();
    const next = encodeURIComponent(location.pathname + location.search);
    navigate(`/verify-account?next=${next}`);
  };

  const copy = ACTION_COPY[dialogState.action] || ACTION_COPY.default;
  const isPending = verificationStatus === 'pending';

  return (
    <VerifyGateContext.Provider value={{ requireVerification }}>
      {children}
      <Dialog open={dialogState.open} onOpenChange={(o) => !o && closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {isPending && dialogState.action === 'pay' ? (
                <><Clock className="h-5 w-5 text-amber-500" /> Verification under review</>
              ) : (
                <><ShieldCheck className="h-5 w-5 text-primary" /> {copy.title}</>
              )}
            </DialogTitle>
            <DialogDescription>
              {isPending && dialogState.action === 'pay'
                ? 'Your verification is under review — payments unlock once approved.'
                : copy.body}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Not now</Button>
            {!(isPending && dialogState.action !== 'pay') && (
              <Button onClick={goVerify}>
                {verificationStatus === 'rejected' ? 'Resubmit verification' : 'Verify now'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </VerifyGateContext.Provider>
  );
}

export function useVerifyGate() {
  const context = useContext(VerifyGateContext);
  if (!context) throw new Error('useVerifyGate must be used within VerifyGateProvider');
  return context;
}
