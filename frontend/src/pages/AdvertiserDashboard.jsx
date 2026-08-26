import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Megaphone, Plus, RefreshCw } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { Card } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';

const formatPrice = (price) => new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 0 }).format(price || 0);

const statusBadge = (status) => ({
  pending: 'bg-yellow-100 text-yellow-800',
  pending_review: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  active: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  failed: 'bg-red-100 text-red-800',
  paid: 'bg-green-100 text-green-800',
  completed: 'bg-green-100 text-green-800',
}[status] || 'bg-gray-100 text-gray-600');

const durationLabel = (ad) => {
  if (!ad.starts_at || !ad.ends_at) return '—';
  const days = Math.round((new Date(ad.ends_at) - new Date(ad.starts_at)) / 86400000);
  return `${days} day${days === 1 ? '' : 's'}`;
};

export function AdvertiserDashboard() {
  const { user } = useAuth();
  const [ads, setAds] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!user?.id) return;
    setLoading(true);
    const { data } = await supabase
      .from('ads')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    setAds(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <main className="mx-auto max-w-6xl px-5 py-12 sm:px-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-[-0.03em] text-foreground">My campaigns</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage your Rentora advertising campaigns.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={loading} className="gap-1.5">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
          <Link to="/advertise/create">
            <Button size="sm" className="gap-1.5"><Plus className="h-3.5 w-3.5" /> Create campaign</Button>
          </Link>
        </div>
      </div>

      {loading ? (
        <Card className="mt-8 p-12 text-center border-border/60"><RefreshCw className="w-6 h-6 mx-auto animate-spin text-foreground/30" /></Card>
      ) : ads.length === 0 ? (
        <Card className="mt-8 p-12 text-center border-border/60">
          <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
            <Megaphone className="w-7 h-7 text-foreground/30" />
          </div>
          <h3 className="font-semibold">No campaigns yet</h3>
          <p className="text-sm text-foreground/55 mt-1">Create your first campaign to start reaching renters on Rentora.</p>
          <Link to="/advertise/create">
            <Button className="mt-5 gap-1.5"><Plus className="h-4 w-4" /> Create campaign</Button>
          </Link>
        </Card>
      ) : (
        <div className="mt-8 space-y-3">
          {/* Mobile cards */}
          <div className="sm:hidden space-y-3">
            {ads.map((ad) => (
              <Card key={ad.id} className="p-4">
                <div className="flex gap-3">
                  {ad.image_url && <img src={ad.image_url} alt="" className="w-20 h-14 rounded-md object-cover shrink-0 border border-border/50" />}
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm truncate">{ad.slot}</p>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      <Badge className={`${statusBadge(ad.status)} text-xs`}>{ad.status}</Badge>
                      <Badge className={`${statusBadge(ad.payment_status)} text-xs`}>{ad.payment_status}</Badge>
                    </div>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-y-1 text-xs text-muted-foreground">
                  <span>Duration: <span className="text-foreground">{durationLabel(ad)}</span></span>
                  <span>Amount: <span className="text-foreground">{formatPrice(ad.amount_paid || ad.price)}</span></span>
                  <span>Clicks: <span className="text-foreground">{ad.clicks ?? 0}</span></span>
                  <span>Created: {ad.created_at ? new Date(ad.created_at).toLocaleDateString() : '—'}</span>
                </div>
              </Card>
            ))}
          </div>

          {/* Desktop table */}
          <Card className="hidden sm:block overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Creative</TableHead>
                  <TableHead>Slot</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Clicks</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ads.map((ad) => (
                  <TableRow key={ad.id}>
                    <TableCell>
                      {ad.image_url ? <img src={ad.image_url} alt="" className="w-16 h-10 rounded object-cover border border-border/50" /> : <span className="text-xs text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-sm">{ad.slot}</TableCell>
                    <TableCell className="text-sm">{durationLabel(ad)}</TableCell>
                    <TableCell className="text-sm">{formatPrice(ad.amount_paid || ad.price)}</TableCell>
                    <TableCell><Badge className={statusBadge(ad.payment_status)}>{ad.payment_status}</Badge></TableCell>
                    <TableCell><Badge className={statusBadge(ad.status)}>{ad.status}</Badge></TableCell>
                    <TableCell className="text-sm">{ad.clicks ?? 0}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{ad.created_at ? new Date(ad.created_at).toLocaleDateString() : '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </div>
      )}
    </main>
  );
}

export default AdvertiserDashboard;
