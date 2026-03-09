import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { walletAPI, unlockAPI, inspectionAPI, transactionAPI, verificationAPI, paymentAPI } from '../lib/api';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { 
  User, 
  Coins, 
  Unlock, 
  Calendar, 
  Receipt, 
  Shield,
  Building2,
  Plus,
  ExternalLink,
  Phone
} from 'lucide-react';
import { toast } from 'sonner';

export function Profile() {
  const navigate = useNavigate();
  const { user, isAuthenticated, refreshUser, isUser } = useAuth();
  
  const [wallet, setWallet] = useState(null);
  const [unlocks, setUnlocks] = useState([]);
  const [inspections, setInspections] = useState([]);
  const [transactions, setTransactions] = useState({ token_transactions: [], inspection_transactions: [] });
  const [verificationRequest, setVerificationRequest] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    fetchData();

    // Auto-confirm payment if redirected back from Korapay
    const params = new URLSearchParams(window.location.search);
    const reference = params.get('reference') || params.get('trxref');
    if (reference) {
      paymentAPI.confirmPayment(reference).then(async (res) => {
        if (res?.data?.type === 'token_purchase') {
          await refreshUser();
          await fetchData();
          toast.success(`${res.data.tokens_added} token(s) added to your wallet!`);
        } else if (res?.data?.type === 'inspection') {
          await fetchData();
          toast.success('Inspection payment confirmed!');
        }
        window.history.replaceState({}, '', window.location.pathname);
      }).catch(() => {});
    }
  }, [isAuthenticated, user]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [walletRes, unlocksRes, inspectionsRes, txRes] = await Promise.all([
        walletAPI.get(user.id),
        unlockAPI.getMyUnlocks(user.id),
        inspectionAPI.getMyInspections(user.id),
        transactionAPI.getMyTransactions(user.id),
      ]);
      
      setWallet(walletRes.data);
      setUnlocks(unlocksRes.data);
      setInspections(inspectionsRes.data);
      setTransactions(txRes.data);

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
    };
    return variants[status] || 'bg-gray-100 text-gray-800';
  };

  if (!isAuthenticated) return null;

  return (
    <div className="container mx-auto px-4 py-6" data-testid="profile-page">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">My Profile</h1>
        <p className="text-muted-foreground mt-1">Manage your account and view your activity</p>
      </div>

      {/* User Info & Wallet */}
      <div className="grid md:grid-cols-3 gap-6 mb-8">
        {/* User Card */}
        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="w-8 h-8 text-primary" />
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
            </div>
          </div>
        </Card>

        {/* Token Balance */}
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Token Balance</p>
              <p className="text-4xl font-bold text-primary mt-1">
                {user?.token_balance || wallet?.token_balance || 0}
              </p>
            </div>
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
              <Coins className="w-7 h-7 text-primary" />
            </div>
          </div>
          <Link to="/buy-tokens">
            <Button className="w-full mt-4 gap-2" data-testid="buy-tokens-btn">
              <Plus className="w-4 h-4" />
              Buy Tokens
            </Button>
          </Link>
        </Card>

        {/* Quick Stats */}
        <Card className="p-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold">{unlocks.length}</p>
              <p className="text-xs text-muted-foreground">Unlocked</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold">{inspections.length}</p>
              <p className="text-xs text-muted-foreground">Inspections</p>
            </div>
          </div>
          
          {/* Agent Verification CTA */}
          {isUser && !verificationRequest && (
            <Link to="/become-agent">
              <Button variant="outline" className="w-full mt-4 gap-2" data-testid="become-agent-btn">
                <Shield className="w-4 h-4" />
                Become an Agent
              </Button>
            </Link>
          )}
          
          {verificationRequest && (
            <div className="mt-4 p-3 rounded-lg bg-muted">
              <p className="text-sm font-medium">Agent Verification</p>
              <Badge className={`mt-1 ${getStatusBadge(verificationRequest.status)}`}>
                {verificationRequest.status}
              </Badge>
            </div>
          )}
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="unlocks" className="w-full">
        <TabsList className="grid w-full grid-cols-4 mb-6">
          <TabsTrigger value="unlocks" className="gap-2" data-testid="tab-unlocks">
            <Unlock className="w-4 h-4" />
            <span className="hidden sm:inline">Unlocked</span>
          </TabsTrigger>
          <TabsTrigger value="inspections" className="gap-2" data-testid="tab-inspections">
            <Calendar className="w-4 h-4" />
            <span className="hidden sm:inline">Inspections</span>
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

        {/* Unlocked Properties */}
        <TabsContent value="unlocks">
          {loading ? (
            <div className="space-y-4">
              {[1, 2].map(i => (
                <Card key={i} className="p-4 animate-pulse">
                  <div className="h-20 bg-muted rounded" />
                </Card>
              ))}
            </div>
          ) : unlocks.length > 0 ? (
            <div className="space-y-4">
              {unlocks.map((unlock) => (
                <Card key={unlock.id} className="p-4">
                  <div className="flex gap-4">
                    <img
                      src={unlock.property?.images?.[0] || 'https://images.pexels.com/photos/3754595/pexels-photo-3754595.jpeg'}
                      alt=""
                      className="w-24 h-24 rounded-lg object-cover"
                    />
                    <div className="flex-1">
                      <h3 className="font-semibold">{unlock.property?.title}</h3>
                      <p className="text-sm text-muted-foreground">{unlock.property?.location}</p>
                      <div className="flex items-center gap-4 mt-2">
                        <span className="text-primary font-bold">
                          {formatPrice(unlock.property?.price || 0)}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          Contact: {unlock.property?.contact_phone}
                        </span>
                      </div>
                    </div>
                    <Link to={`/property/${unlock.property_id}`}>
                      <Button variant="outline" size="sm">
                        <ExternalLink className="w-4 h-4" />
                      </Button>
                    </Link>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="p-8 text-center">
              <Unlock className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-semibold">No Unlocked Properties</h3>
              <p className="text-sm text-muted-foreground mt-2">
                Properties you unlock will appear here
              </p>
              <Link to="/browse">
                <Button className="mt-4">Browse Properties</Button>
              </Link>
            </Card>
          )}
        </TabsContent>

        {/* Inspections */}
        <TabsContent value="inspections">
          {loading ? (
            <div className="space-y-4">
              {[1, 2].map(i => (
                <Card key={i} className="p-4 animate-pulse">
                  <div className="h-20 bg-muted rounded" />
                </Card>
              ))}
            </div>
          ) : inspections.length > 0 ? (
            <div className="space-y-4">
              {inspections.map((inspection) => (
                <Card key={inspection.id} className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold">{inspection.property_title}</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        Scheduled: {inspection.inspection_date}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Agent: {inspection.agent_name || 'To be assigned'}
                      </p>
                    </div>
                    <div className="text-right">
                      <Badge className={getStatusBadge(inspection.status)}>
                        {inspection.status}
                      </Badge>
                      <Badge className={`ml-2 ${getStatusBadge(inspection.payment_status)}`}>
                        Payment: {inspection.payment_status}
                      </Badge>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="p-8 text-center">
              <Calendar className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-semibold">No Inspections</h3>
              <p className="text-sm text-muted-foreground mt-2">
                Request inspections from property detail pages
              </p>
            </Card>
          )}
        </TabsContent>

        {/* Transactions */}
        <TabsContent value="transactions">
          <div className="space-y-6">
            <div>
              <h3 className="font-semibold mb-4">Token Purchases</h3>
              {transactions.token_transactions.length > 0 ? (
                <div className="space-y-3">
                  {transactions.token_transactions.map((tx) => (
                    <Card key={tx.id} className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{tx.tokens_added} Tokens</p>
                          <p className="text-sm text-muted-foreground">{tx.reference}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-primary">{formatPrice(tx.amount)}</p>
                          <Badge className={getStatusBadge(tx.status)}>{tx.status}</Badge>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card className="p-4 text-center text-muted-foreground">
                  No token purchases yet
                </Card>
              )}
            </div>

            <div>
              <h3 className="font-semibold mb-4">Inspection Payments</h3>
              {transactions.inspection_transactions.length > 0 ? (
                <div className="space-y-3">
                  {transactions.inspection_transactions.map((tx) => (
                    <Card key={tx.id} className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">Inspection Fee</p>
                          <p className="text-sm text-muted-foreground">{tx.reference}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-primary">{formatPrice(tx.amount)}</p>
                          <Badge className={getStatusBadge(tx.status)}>{tx.status}</Badge>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card className="p-4 text-center text-muted-foreground">
                  No inspection payments yet
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
                <p className="text-sm text-muted-foreground">Full Name</p>
                <p className="font-medium">{user?.full_name}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Email</p>
                <p className="font-medium">{user?.email}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Phone Number</p>
                {user?.phone ? (
                  <a href={`tel:${user.phone}`} className="font-medium text-primary hover:underline flex items-center gap-1.5">
                    <Phone className="w-4 h-4" /> {user.phone}
                  </a>
                ) : (
                  <p className="text-sm text-muted-foreground italic">Not provided</p>
                )}
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
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default Profile;
