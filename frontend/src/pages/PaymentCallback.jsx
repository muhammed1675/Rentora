import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { paymentAPI } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';

export function PaymentCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { refreshUser } = useAuth();
  
  const [status, setStatus] = useState('loading');
  const [paymentDetails, setPaymentDetails] = useState(null);

  useEffect(() => {
    const verifyPayment = async (attempts = 0) => {
      // Korapay returns ?reference= on redirect
      const reference = searchParams.get('reference') || searchParams.get('trxref');
      
      if (!reference) {
        setStatus('failed');
        return;
      }

      try {
        const response = await paymentAPI.verify(reference);
        setPaymentDetails(response.data);
        
        if (response.data.status === 'completed') {
          setStatus('success');
          await refreshUser();
        } else if (response.data.status === 'pending' && attempts < 4) {
          // Retry up to 4 times with 2s delay
          setTimeout(() => verifyPayment(attempts + 1), 2000);
        } else if (response.data.status === 'pending') {
          setStatus('pending');
        } else {
          setStatus('failed');
        }
      } catch (error) {
        console.error('Payment verification failed:', error);
        setStatus('failed');
      }
    };

    verifyPayment();
  }, [searchParams, refreshUser]);

  const formatPrice = (price) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
    }).format(price);
  };

  return (
    <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center p-4" data-testid="payment-callback-page">
      <Card className="w-full max-w-md p-8 text-center">
        {status === 'loading' && (
          <>
            <Loader2 className="w-16 h-16 mx-auto text-primary animate-spin mb-4" />
            <h2 className="text-xl font-semibold">Verifying Payment...</h2>
            <p className="text-muted-foreground mt-2">Please wait while we confirm your payment</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-10 h-10 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-green-600 mb-2">Payment Successful!</h2>
            {paymentDetails && (
              <div className="text-left bg-muted rounded-lg p-4 my-4">
                <p className="text-sm text-muted-foreground">Type</p>
                <p className="font-medium capitalize mb-2">
                  {paymentDetails.type === 'token_purchase' ? 'Token Purchase' : 'Inspection Fee'}
                </p>
                <p className="text-sm text-muted-foreground">Amount</p>
                <p className="font-medium mb-2">{formatPrice(paymentDetails.amount)}</p>
                {paymentDetails.tokens && (
                  <>
                    <p className="text-sm text-muted-foreground">Tokens Added</p>
                    <p className="font-medium">{paymentDetails.tokens}</p>
                  </>
                )}
              </div>
            )}
            <div className="flex gap-3 mt-4">
              <Button variant="outline" className="flex-1" onClick={() => navigate('/profile')}>
                View Profile
              </Button>
              <Button className="flex-1" onClick={() => navigate('/browse')}>
                Browse Properties
              </Button>
            </div>
          </>
        )}

        {status === 'pending' && (
          <>
            <div className="w-16 h-16 rounded-full bg-yellow-100 flex items-center justify-center mx-auto mb-4">
              <Loader2 className="w-10 h-10 text-yellow-600 animate-spin" />
            </div>
            <h2 className="text-2xl font-bold text-yellow-600 mb-2">Payment Pending</h2>
            <p className="text-muted-foreground mb-4">
              Your payment is being processed. This may take a few moments.
            </p>
            <Button onClick={() => window.location.reload()}>
              Check Again
            </Button>
          </>
        )}

        {status === 'failed' && (
          <>
            <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <XCircle className="w-10 h-10 text-red-600" />
            </div>
            <h2 className="text-2xl font-bold text-red-600 mb-2">Payment Failed</h2>
            <p className="text-muted-foreground mb-4">
              We couldn't verify your payment. Please try again or contact support.
            </p>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => navigate('/profile')}>
                Go to Profile
              </Button>
              <Button onClick={() => navigate('/buy-tokens')}>
                Try Again
              </Button>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}

export default PaymentCallback;
