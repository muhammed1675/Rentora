import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { tokenAPI, walletAPI } from '../lib/api';
import { openKorapayCheckout } from '../lib/korapay';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Coins, Plus, Minus, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

export function BuyTokens() {
  const navigate = useNavigate();
  const { user, isAuthenticated, refreshUser } = useAuth();
  
  const [wallet, setWallet] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) { navigate('/login'); return; }
    fetchWallet();
    setEmail(user?.email || '');
  }, [isAuthenticated, user]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchWallet = async () => {
    if (!user) return;
    try {
      const response = await walletAPI.get(user.id);
      setWallet(response.data);
    } catch (error) {
      console.error('Failed to fetch wallet:', error);
    }
  };

  const handlePurchase = async () => {
    if (!email || !phone) { toast.error('Please fill in all fields'); return; }
    setLoading(true);
    try {
      const response = await tokenAPI.purchase({ quantity, email, phone_number: phone }, user.id);

      await openKorapayCheckout({
        reference: response.data.reference,
        amount: response.data.amount,
        email,
        name: user?.full_name || user?.email,
        narration: `Rentora – ${quantity} Token${quantity > 1 ? 's' : ''}`,
        onSuccess: async () => {
          await refreshUser();
          await fetchWallet();
          toast.success(`${quantity} token${quantity > 1 ? 's' : ''} added to your wallet!`);
          setLoading(false);
          navigate('/profile');
        },
        onFailed: () => {
          toast.error('Payment was not successful. Please try again.');
          setLoading(false);
        },
        onClose: () => {
          setLoading(false);
        },
      });
    } catch (error) {
      toast.error(error.message || 'Failed to initiate purchase');
      setLoading(false);
    }
  };

  const incrementQuantity = () => setQuantity((prev) => Math.min(prev + 1, 100));
  const decrementQuantity = () => setQuantity((prev) => Math.max(prev - 1, 1));
  const totalAmount = quantity * 1000;
  const formatPrice = (price) => new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 0 }).format(price);

  if (!isAuthenticated) return null;

  return (
    <div className="container mx-auto px-4 py-6" data-testid="buy-tokens-page">
      <Button variant="ghost" onClick={() => navigate('/profile')} className="mb-4 gap-2">
        <ArrowLeft className="w-4 h-4" /> Back to Profile
      </Button>

      <div className="max-w-lg mx-auto">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Coins className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Buy Tokens</h1>
          <p className="text-muted-foreground mt-2">Use tokens to unlock property owner contacts</p>
        </div>

        <Card className="p-6 mb-6 text-center bg-primary/5">
          <p className="text-sm text-muted-foreground">Current Balance</p>
          <p className="text-4xl font-bold text-primary mt-1">
            {user?.token_balance || wallet?.token_balance || 0} <span className="text-lg">tokens</span>
          </p>
        </Card>

        <Card className="p-6">
          <div className="space-y-6">
            <div>
              <Label>Number of Tokens</Label>
              <div className="flex items-center gap-4 mt-2">
                <Button variant="outline" size="icon" onClick={decrementQuantity} disabled={quantity <= 1} data-testid="decrement-qty">
                  <Minus className="w-4 h-4" />
                </Button>
                <Input
                  type="number" value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, Math.min(100, parseInt(e.target.value) || 1)))}
                  className="w-24 text-center text-xl font-bold" data-testid="quantity-input"
                />
                <Button variant="outline" size="icon" onClick={incrementQuantity} disabled={quantity >= 100} data-testid="increment-qty">
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div>
              <Label>Quick Select</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {[1, 5, 10, 20, 50].map((num) => (
                  <Button key={num} variant={quantity === num ? 'default' : 'outline'} size="sm"
                    onClick={() => setQuantity(num)} data-testid={`quick-select-${num}`}>
                    {num}
                  </Button>
                ))}
              </div>
            </div>

            <Card className="p-4 bg-muted/50">
              <div className="flex justify-between items-center mb-2">
                <span className="text-muted-foreground">Price per token</span><span>₦1,000</span>
              </div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-muted-foreground">Quantity</span><span>{quantity}</span>
              </div>
              <div className="border-t pt-2 mt-2 flex justify-between items-center">
                <span className="font-semibold">Total</span>
                <span className="text-2xl font-bold text-primary">{formatPrice(totalAmount)}</span>
              </div>
            </Card>

            <div className="space-y-4">
              <div>
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com" className="mt-1" data-testid="purchase-email" />
              </div>
              <div>
                <Label htmlFor="phone">Phone Number</Label>
                <Input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
                  placeholder="+234..." className="mt-1" data-testid="purchase-phone" />
              </div>
            </div>

            <Button onClick={handlePurchase} disabled={loading} className="w-full h-12 gap-2" data-testid="purchase-btn">
              {loading ? 'Processing...' : `Pay ${formatPrice(totalAmount)}`}
            </Button>
          </div>
        </Card>

        <div className="mt-6 text-center text-sm text-muted-foreground">
          <p>Tokens are non-refundable and can only be used to unlock property contacts.</p>
          <p className="mt-1">1 token = 1 property contact unlock</p>
        </div>
      </div>
    </div>
  );
}

export default BuyTokens;
