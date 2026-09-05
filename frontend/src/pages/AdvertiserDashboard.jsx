import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  BadgeDollarSign, Megaphone, MousePointerClick, Clock3,
  Plus, RefreshCw, ImageIcon,
} from 'lucide-react';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { AD_SLOT_SPECS, advertisingAPI } from '../lib/advertising';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';

const formatPrice = (price) => new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 0 }).format(price || 0);

const SLOT_COLORS = ['#0062AE', '#3B93D6', '#9FCBEA'];

const statusBadge = (status) => ({
  pending: 'bg-amber-100 text-amber-700',
  pending_review: 'bg-amber-100 text-amber-700',
  approved: 'bg-emerald-100 text-emerald-700',
  active: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-rose-100 text-rose-700',
  failed: 'bg-rose-100 text-rose-700',
  paid: 'bg-emerald-100 text-emerald-700',
  completed: 'bg-slate-100 text-slate-600',
  cancelled: 'bg-slate-100 text-slate-600',
}[status] || 'bg-slate-100 text-slate-600');

const statusLabel = (status) => ({
  pending: 'Payment pending',
  pending_review: 'Under review',
  approved: 'Approved',
  active: 'Live',
  rejected: 'Rejected',
  failed: 'Payment failed',
  cancelled: 'Cancelled',
}[status] || status || 'Unknown');

const statusMessage = (ad) => {
  if (ad.status === 'pending_review') return 'Your ad was submitted and is awaiting admin review.';
  if (['approved', 'active'].includes(ad.status)) return 'Your ad has been approved and is live or scheduled.';
  if (ad.status === 'rejected') return ad.admin_note || ad.rejection_reason || 'This ad was rejected. Please contact support for details.';
  if (ad.payment_status === 'pending') return 'Complete payment before your ad can be reviewed.';
  return '';
};

const durationLabel = (ad) => {
  if (!ad.starts_at || !ad.ends_at) return '—';
  const days = Math.round((new Date(ad.ends_at) - new Date(ad.starts_at)) / 86400000);
  return `${days} day${days === 1 ? '' : 's'}`;
};

const MS_DAY = 86400000;
const EXPIRING_SOON_WINDOW_DAYS = 3;

// Tells the advertiser at a glance whether a campaign hasn't started yet,
// is running normally, is about to run out, or has already ended — derived
// purely from starts_at/ends_at so it stays correct without any cron job.
const getExpiryInfo = (ad) => {
  if (!ad.ends_at || ad.status === 'cancelled') return null;
  const now = new Date();
  const ends = new Date(ad.ends_at);
  const starts = ad.starts_at ? new Date(ad.starts_at) : null;
  const isLive = ['approved', 'active'].includes(ad.status);

  if (starts && now < starts) {
    const daysToStart = Math.max(1, Math.ceil((starts - now) / MS_DAY));
    return {
      key: 'scheduled',
      label: 'Scheduled',
      badgeClass: 'bg-sky-100 text-sky-700',
      detail: `Starts in ${daysToStart} day${daysToStart === 1 ? '' : 's'}`,
    };
  }

  if (now > ends) {
    const daysAgo = Math.floor((now - ends) / MS_DAY);
    return {
      key: 'expired',
      label: 'Expired',
      badgeClass: 'bg-rose-100 text-rose-700',
      detail: daysAgo <= 0 ? 'Expired today' : `Expired ${daysAgo} day${daysAgo === 1 ? '' : 's'} ago`,
    };
  }

  const daysLeft = Math.ceil((ends - now) / MS_DAY);
  if (isLive && daysLeft <= EXPIRING_SOON_WINDOW_DAYS) {
    return {
      key: 'expiring',
      label: 'Expiring soon',
      badgeClass: 'bg-amber-100 text-amber-700',
      detail: daysLeft <= 0 ? 'Expires today' : `Expires in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`,
    };
  }

  return {
    key: 'healthy',
    label: 'Active',
    badgeClass: 'bg-emerald-100 text-emerald-700',
    detail: `Runs until ${ends.toLocaleDateString()}`,
  };
};

const amountOf = (ad) => Number(ad.amount_paid ?? ad.price ?? 0);

// ad_text is stored as "headline — description" (see createPendingAd), so
// splitting on the same separator recovers the headline half for prefill.
const headlineOf = (ad) => (ad.ad_text ? ad.ad_text.split(' — ')[0] : '');

function MetricCard({ icon: Icon, label, value, sub, featured }) {
  return (
    <Card className={`overflow-hidden border-0 shadow-sm ${featured ? 'bg-primary text-primary-foreground' : 'bg-white'}`}>
      <CardContent className="flex h-full flex-col justify-between p-5">
        <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${featured ? 'bg-white/15 text-white' : 'bg-primary/10 text-primary'}`}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="mt-5">
          <p className={`text-xs ${featured ? 'text-white/80' : 'text-muted-foreground'}`}>{label}</p>
          <p className="mt-1 text-2xl font-semibold leading-none tracking-tight">{value}</p>
          {sub && <p className={`mt-1.5 text-[11px] ${featured ? 'text-white/70' : 'text-muted-foreground'}`}>{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

export function AdvertiserDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
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

  const [retryingId, setRetryingId] = useState(null);
  // Picks back up an ad stuck at payment_status='pending' — e.g. the person
  // closed the Korapay tab, or the amount was rejected as below the payment
  // channel's minimum. Reuses the same ad row and the same initPayment call
  // Advertise.jsx uses on first submit, so there's no risk of double-charging
  // or creating a duplicate campaign (the server checks payment_status is
  // still 'pending' before issuing a new checkout link).
  const retryPayment = async (ad) => {
    setRetryingId(ad.id);
    try {
      const payment = await advertisingAPI.initPayment(ad.id, `${window.location.origin}/payment/callback`);
      const checkoutUrl = payment?.data?.checkout_url;
      if (checkoutUrl) window.location.assign(checkoutUrl);
      else if (payment?.data?.alreadyPaid) { toast.info('This advert has already been paid for.'); load(); }
      else toast.error('Could not start payment for this advert. Please try again.');
    } catch (error) {
      toast.error(error.message || 'Could not start payment for this advert.');
    } finally {
      setRetryingId(null);
    }
  };

  // Sends everything we still know about an expired campaign to the create
  // form so the advertiser only has to re-attach the creative image (the
  // one thing that can't survive as router state) and pay again.
  const runAgain = (ad) => {
    navigate('/advertise/create', {
      state: {
        prefill: {
          slot: ad.slot,
          advertiserName: ad.full_name || '',
          whatsapp: ad.whatsapp_number || '',
          destinationUrl: ad.link_url || '',
          headline: headlineOf(ad),
          description: ad.message_body || '',
        },
      },
    });
  };

  const [cancellingId, setCancellingId] = useState(null);
  // Archives an already-ended campaign so it stops being counted as
  // "expired" — nothing flips status automatically once ends_at passes,
  // so without this an old campaign would nag on the dashboard forever.
  const cancelAd = async (ad) => {
    setCancellingId(ad.id);
    try {
      const { error } = await supabase.rpc('cancel_own_ad', { p_ad_id: ad.id });
      if (error) throw error;
      toast.success('Campaign cancelled.');
      load();
    } catch (error) {
      toast.error(error.message || 'Could not cancel this campaign.');
    } finally {
      setCancellingId(null);
    }
  };

  const stats = useMemo(() => {
    const totalSpend = ads.reduce((sum, ad) => sum + amountOf(ad), 0);
    const totalClicks = ads.reduce((sum, ad) => sum + (ad.clicks || 0), 0);
    const activeCount = ads.filter((ad) => ['active', 'approved'].includes(ad.status)).length;
    const pendingCount = ads.filter((ad) => ['pending', 'pending_review'].includes(ad.status)).length;
    const expiringSoonCount = ads.filter((ad) => getExpiryInfo(ad)?.key === 'expiring').length;
    const expiredCount = ads.filter((ad) => getExpiryInfo(ad)?.key === 'expired').length;
    return { totalSpend, totalClicks, activeCount, pendingCount, expiringSoonCount, expiredCount };
  }, [ads]);

  const placementMix = useMemo(() => {
    const bySlot = {};
    ads.forEach((ad) => {
      bySlot[ad.slot] = (bySlot[ad.slot] || 0) + amountOf(ad);
    });
    const total = Object.values(bySlot).reduce((a, b) => a + b, 0);
    return Object.keys(bySlot)
      .map((slot, i) => ({
        slot,
        label: AD_SLOT_SPECS[slot]?.label || slot,
        amount: bySlot[slot],
        pct: total ? Math.round((bySlot[slot] / total) * 100) : 0,
        color: SLOT_COLORS[i % SLOT_COLORS.length],
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [ads]);

  const topByClicks = useMemo(() => {
    const maxClicks = Math.max(1, ...ads.map((ad) => ad.clicks || 0));
    return [...ads]
      .sort((a, b) => (b.clicks || 0) - (a.clicks || 0))
      .slice(0, 5)
      .map((ad) => ({ ...ad, pct: Math.round(((ad.clicks || 0) / maxClicks) * 100) }));
  }, [ads]);

  return (
    <main className="min-h-screen bg-[#eef1f6]">
      <div className="mx-auto max-w-7xl px-5 py-10 sm:px-8 sm:py-12">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-[-0.03em] text-foreground sm:text-3xl">My campaigns</h1>
            <p className="mt-1 text-sm text-muted-foreground">Manage your Rentora advertising campaigns.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={load} disabled={loading} className="gap-1.5 bg-white">
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </Button>
            <Link to="/advertise/create">
              <Button size="sm" className="gap-1.5"><Plus className="h-3.5 w-3.5" /> Create campaign</Button>
            </Link>
          </div>
        </div>

        {loading ? (
          <Card className="mt-8 border-border/60 p-12 text-center"><RefreshCw className="mx-auto h-6 w-6 animate-spin text-foreground/30" /></Card>
        ) : ads.length === 0 ? (
          <Card className="mt-8 border-border/60 p-12 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
              <Megaphone className="h-7 w-7 text-foreground/30" />
            </div>
            <h3 className="font-semibold">No campaigns yet</h3>
            <p className="mt-1 text-sm text-foreground/55">Create your first campaign to start reaching renters on Rentora.</p>
            <Link to="/advertise/create">
              <Button className="mt-5 gap-1.5"><Plus className="h-4 w-4" /> Create campaign</Button>
            </Link>
          </Card>
        ) : (
          <>
          {(stats.expiringSoonCount > 0 || stats.expiredCount > 0) && (
            <div className="mt-6 flex flex-wrap items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <Clock3 className="h-4 w-4 shrink-0" />
              <span>
                {stats.expiringSoonCount > 0 && (
                  <>
                    {stats.expiringSoonCount} campaign{stats.expiringSoonCount === 1 ? '' : 's'} expiring within {EXPIRING_SOON_WINDOW_DAYS} days
                  </>
                )}
                {stats.expiringSoonCount > 0 && stats.expiredCount > 0 && ' · '}
                {stats.expiredCount > 0 && (
                  <>
                    {stats.expiredCount} campaign{stats.expiredCount === 1 ? '' : 's'} expired — hit "Run again" below to relaunch
                  </>
                )}
              </span>
            </div>
          )}
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-12">
            {/* Metric cards */}
            <div className="xl:col-span-3">
              <MetricCard icon={BadgeDollarSign} label="Total spend" value={formatPrice(stats.totalSpend)} sub="Across all campaigns" featured />
            </div>
            <div className="xl:col-span-3">
              <MetricCard icon={Megaphone} label="Active campaigns" value={stats.activeCount} sub={`${ads.length} total`} />
            </div>
            <div className="xl:col-span-3">
              <MetricCard icon={MousePointerClick} label="Total clicks" value={stats.totalClicks.toLocaleString('en-NG')} sub="All time" />
            </div>
            <div className="xl:col-span-3">
              <MetricCard icon={Clock3} label="Pending review" value={stats.pendingCount} sub="Awaiting approval" />
            </div>

            {/* Placement mix */}
            <div className="sm:col-span-1 xl:col-span-5">
              <Card className="h-full border-0 bg-white shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Spend by placement</CardTitle>
                  <CardDescription className="text-xs">Where your budget is going</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {placementMix.length === 0 && <p className="text-sm text-muted-foreground">No spend yet.</p>}
                  {placementMix.map((row) => (
                    <div key={row.slot}>
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="flex min-w-0 items-center gap-2 font-medium text-foreground">
                          <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: row.color }} />
                          <span className="truncate">{row.label}</span>
                        </span>
                        <span className="shrink-0 font-semibold text-foreground">{formatPrice(row.amount)}</span>
                      </div>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full" style={{ width: `${row.pct}%`, backgroundColor: row.color }} />
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            {/* Top campaigns by clicks */}
            <div className="sm:col-span-1 xl:col-span-7">
              <Card className="h-full border-0 bg-white shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Most clicked campaigns</CardTitle>
                  <CardDescription className="text-xs">Your top performers by clicks</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {topByClicks.length === 0 && <p className="text-sm text-muted-foreground">No clicks yet.</p>}
                  {topByClicks.map((ad) => (
                    <div key={ad.id}>
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="truncate font-medium text-foreground">{AD_SLOT_SPECS[ad.slot]?.label || ad.slot}</span>
                        <span className="shrink-0 font-semibold text-foreground">{(ad.clicks || 0).toLocaleString('en-NG')} clicks</span>
                      </div>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${ad.pct}%` }} />
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            {/* Campaign table */}
            <div className="sm:col-span-2 xl:col-span-12">
              <Card className="border-0 bg-white shadow-sm">
                <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
                  <div>
                    <CardTitle className="text-base">All campaigns</CardTitle>
                    <CardDescription className="mt-1 text-xs">Every campaign you've created on Rentora</CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="px-3 pb-3 pt-0 sm:px-4">
                  {/* Mobile cards */}
                  <div className="space-y-3 sm:hidden">
                    {ads.map((ad) => (
                      <div key={ad.id} className="rounded-xl border border-border/60 bg-slate-50/60 p-3">
                        <div className="flex gap-3">
                          {ad.image_url ? (
                            <img src={ad.image_url} alt="" className="h-14 w-20 shrink-0 rounded-md border border-border/50 object-cover" />
                          ) : (
                            <div className="flex h-14 w-20 shrink-0 items-center justify-center rounded-md border border-dashed border-border/60 text-muted-foreground">
                              <ImageIcon className="h-4 w-4" />
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold">{AD_SLOT_SPECS[ad.slot]?.label || ad.slot}</p>
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              <Badge className={`border-0 text-[10px] ${statusBadge(ad.status)}`}>{statusLabel(ad.status)}</Badge>
                              <Badge className={`border-0 text-[10px] ${statusBadge(ad.payment_status)}`}>{statusLabel(ad.payment_status)}</Badge>
                              {getExpiryInfo(ad) && (
                                <Badge className={`border-0 text-[10px] ${getExpiryInfo(ad).badgeClass}`}>{getExpiryInfo(ad).label}</Badge>
                              )}
                            </div>
                          </div>
                        </div>
                        <p className="mt-3 text-xs leading-5 text-muted-foreground">{statusMessage(ad)}</p>
                        {getExpiryInfo(ad) && (
                          <p className="mt-1 text-xs leading-5 text-muted-foreground">{getExpiryInfo(ad).detail}</p>
                        )}
                        {ad.payment_status === 'pending' && (
                          <Button
                            size="sm"
                            className="mt-2 h-8 w-full text-xs"
                            disabled={retryingId === ad.id}
                            onClick={() => retryPayment(ad)}
                          >
                            {retryingId === ad.id ? 'Starting payment…' : 'Retry payment'}
                          </Button>
                        )}
                        {getExpiryInfo(ad)?.key === 'expired' && (
                          <div className="mt-2 flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 flex-1 gap-1.5 text-xs"
                              onClick={() => runAgain(ad)}
                            >
                              <RefreshCw className="h-3.5 w-3.5" /> Run again
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 flex-1 text-xs text-rose-600 hover:text-rose-700"
                              disabled={cancellingId === ad.id}
                              onClick={() => cancelAd(ad)}
                            >
                              {cancellingId === ad.id ? 'Cancelling…' : 'Cancel'}
                            </Button>
                          </div>
                        )}
                        <div className="mt-3 grid grid-cols-2 gap-y-1 text-xs text-muted-foreground">
                          <span>Duration: <span className="text-foreground">{durationLabel(ad)}</span></span>
                          <span>Amount: <span className="text-foreground">{formatPrice(amountOf(ad))}</span></span>
                          <span>Clicks: <span className="text-foreground">{ad.clicks ?? 0}</span></span>
                          <span>Created: {ad.created_at ? new Date(ad.created_at).toLocaleDateString() : '—'}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Desktop table */}
                  <div className="hidden overflow-x-auto sm:block">
                    <table className="w-full min-w-[720px] text-left text-xs">
                      <thead className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        <tr>
                          <th className="px-3 py-3 font-medium">Creative</th>
                          <th className="px-3 py-3 font-medium">Slot</th>
                          <th className="px-3 py-3 font-medium">Duration</th>
                          <th className="px-3 py-3 font-medium">Expiry</th>
                          <th className="px-3 py-3 font-medium">Amount</th>
                          <th className="px-3 py-3 font-medium">Payment</th>
                          <th className="px-3 py-3 font-medium">Status</th>
                          <th className="px-3 py-3 font-medium">Clicks</th>
                          <th className="px-3 py-3 font-medium">Created</th>
                          <th className="px-3 py-3 font-medium">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ads.map((ad) => (
                          <tr key={ad.id} className="border-t border-border/60 transition-colors hover:bg-slate-50/80">
                            <td className="px-3 py-3.5">
                              {ad.image_url ? (
                                <img src={ad.image_url} alt="" className="h-10 w-16 rounded border border-border/50 object-cover" />
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </td>
                            <td className="px-3 py-3.5 font-medium text-foreground">{AD_SLOT_SPECS[ad.slot]?.label || ad.slot}</td>
                            <td className="px-3 py-3.5">{durationLabel(ad)}</td>
                            <td className="px-3 py-3.5">
                              {getExpiryInfo(ad) ? (
                                <div>
                                  <Badge className={`border-0 text-[10px] ${getExpiryInfo(ad).badgeClass}`}>{getExpiryInfo(ad).label}</Badge>
                                  <p className="mt-1 text-[11px] text-muted-foreground">{getExpiryInfo(ad).detail}</p>
                                </div>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </td>
                            <td className="px-3 py-3.5 font-medium text-foreground">{formatPrice(amountOf(ad))}</td>
                            <td className="px-3 py-3.5"><Badge className={`border-0 ${statusBadge(ad.payment_status)}`}>{statusLabel(ad.payment_status)}</Badge></td>
                            <td className="px-3 py-3.5"><Badge className={`border-0 ${statusBadge(ad.status)}`}>{statusLabel(ad.status)}</Badge></td>
                            <td className="px-3 py-3.5">{ad.clicks ?? 0}</td>
                            <td className="px-3 py-3.5 text-muted-foreground">{ad.created_at ? new Date(ad.created_at).toLocaleDateString() : '—'}</td>
                            <td className="px-3 py-3.5">
                              {ad.payment_status === 'pending' ? (
                                <Button
                                  size="sm"
                                  className="h-7 text-xs"
                                  disabled={retryingId === ad.id}
                                  onClick={() => retryPayment(ad)}
                                >
                                  {retryingId === ad.id ? 'Starting…' : 'Retry payment'}
                                </Button>
                              ) : getExpiryInfo(ad)?.key === 'expired' ? (
                                <div className="flex gap-1.5">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 gap-1.5 text-xs"
                                    onClick={() => runAgain(ad)}
                                  >
                                    <RefreshCw className="h-3.5 w-3.5" /> Run again
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-xs text-rose-600 hover:text-rose-700"
                                    disabled={cancellingId === ad.id}
                                    onClick={() => cancelAd(ad)}
                                  >
                                    {cancellingId === ad.id ? 'Cancelling…' : 'Cancel'}
                                  </Button>
                                </div>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
          </>
        )}
      </div>
    </main>
  );
}

export default AdvertiserDashboard;