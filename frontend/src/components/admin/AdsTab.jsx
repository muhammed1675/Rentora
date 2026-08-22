import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { adsAPI } from '../../lib/api';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../ui/table';
import {
  CheckCircle2, XCircle, Pause, Play, Ban, PlusCircle, Wallet, MousePointerClick,
  Megaphone, Loader2, RefreshCw,
} from 'lucide-react';

const SLOT_LABELS = {
  header_billboard: 'Header Billboard',
  mid_page_content: 'Mid-Page Content',
  in_feed_banner: 'In-Feed Banner',
};

const STATUS_STYLES = {
  pending_payment: 'bg-slate-100 text-slate-600',
  pending_review: 'bg-amber-100 text-amber-800',
  pending_queue: 'bg-blue-100 text-blue-800',
  active: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  expired: 'bg-slate-100 text-slate-500',
  paused: 'bg-orange-100 text-orange-700',
};

const formatNaira = (n) => `₦${Number(n || 0).toLocaleString('en-NG')}`;

export function AdsTab() {
  const [ads, setAds] = useState([]);
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  const [filterSlot, setFilterSlot] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [search, setSearch] = useState('');

  const [rejectingId, setRejectingId] = useState(null);
  const [rejectReason, setRejectReason] = useState('');

  const [extendingId, setExtendingId] = useState(null);
  const [extendDays, setExtendDays] = useState('7');

  const [houseAdOpen, setHouseAdOpen] = useState(false);
  const [houseAdForm, setHouseAdForm] = useState({ slotType: 'header_billboard', businessName: '', contactName: '', whatsappNumber: '', imageUrl: '', durationType: 'week' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: adsData }, { data: slotsData }] = await Promise.all([
        adsAPI.adminListAds(),
        adsAPI.getSlots(),
      ]);
      setAds(adsData);
      setSlots(slotsData);
    } catch (e) {
      toast.error(e.message || 'Failed to load ads');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const pendingReview = ads.filter((a) => a.status === 'pending_review');

  const filteredAds = ads.filter((a) => {
    if (filterSlot !== 'all' && a.slot_type !== filterSlot) return false;
    if (filterStatus !== 'all' && a.status !== filterStatus) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      if (!a.business_name?.toLowerCase().includes(q) && !a.whatsapp_number?.includes(q)) return false;
    }
    return true;
  });

  const revenue = {
    total: ads.filter((a) => a.payment_status === 'completed').reduce((sum, a) => sum + Number(a.amount_paid || 0), 0),
    bySlot: Object.keys(SLOT_LABELS).reduce((acc, slot) => {
      acc[slot] = ads.filter((a) => a.slot_type === slot && a.payment_status === 'completed').reduce((sum, a) => sum + Number(a.amount_paid || 0), 0);
      return acc;
    }, {}),
    activeCount: ads.filter((a) => a.status === 'active').length,
    totalClicks: ads.reduce((sum, a) => sum + Number(a.click_count || 0), 0),
  };

  const withBusy = async (id, fn) => {
    setBusyId(id);
    try {
      await fn();
      await load();
    } catch (e) {
      toast.error(e.message || 'Action failed');
    } finally {
      setBusyId(null);
    }
  };

  const handleApprove = (ad) => withBusy(ad.id, async () => {
    await adsAPI.adminApprove(ad.id, ad.duration_type);
    toast.success(`${ad.business_name}'s ad is now live`);
  });

  const handleReject = (ad) => {
    if (!rejectReason.trim()) { toast.error('Please give a reason'); return; }
    withBusy(ad.id, async () => {
      await adsAPI.adminReject(ad.id, rejectReason.trim());
      toast.success('Ad rejected');
      setRejectingId(null);
      setRejectReason('');
    });
  };

  const handleExtend = (ad) => {
    const days = Number(extendDays);
    if (!days || days <= 0) { toast.error('Enter a valid number of days'); return; }
    withBusy(ad.id, async () => {
      await adsAPI.adminExtend(ad.id, ad.end_date, days);
      toast.success(`Extended by ${days} day(s)`);
      setExtendingId(null);
    });
  };

  const handleAddHouseAd = async () => {
    if (!houseAdForm.businessName || !houseAdForm.contactName || !houseAdForm.whatsappNumber || !houseAdForm.imageUrl) {
      toast.error('Fill in all fields for the house ad');
      return;
    }
    try {
      await adsAPI.adminAddHouseAd(houseAdForm);
      toast.success('House ad added and live');
      setHouseAdOpen(false);
      setHouseAdForm({ slotType: 'header_billboard', businessName: '', contactName: '', whatsappNumber: '', imageUrl: '', durationType: 'week' });
      load();
    } catch (e) {
      toast.error(e.message || 'Failed to add house ad');
    }
  };

  const handleSlotConfigChange = (slotType, field, value) => {
    setSlots((prev) => prev.map((s) => (s.slot_type === slotType ? { ...s, [field]: value } : s)));
  };

  const saveSlotConfig = async (slot) => {
    try {
      await adsAPI.adminUpdateSlotConfig(slot.slot_type, {
        max_concurrent_ads: Number(slot.max_concurrent_ads),
        price_week: Number(slot.price_week),
        price_month: Number(slot.price_month),
      });
      toast.success(`${SLOT_LABELS[slot.slot_type]} settings saved`);
    } catch (e) {
      toast.error(e.message || 'Failed to save slot config');
    }
  };

  if (loading) {
    return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-8">
      {/* Revenue Snapshot */}
      <div>
        <h3 className="font-semibold mb-3">Revenue Snapshot</h3>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Card className="p-4">
            <Wallet className="h-5 w-5 text-primary mb-2" />
            <p className="text-xs text-muted-foreground">Total ad revenue</p>
            <p className="text-xl font-bold">{formatNaira(revenue.total)}</p>
          </Card>
          <Card className="p-4">
            <Megaphone className="h-5 w-5 text-primary mb-2" />
            <p className="text-xs text-muted-foreground">Active ads</p>
            <p className="text-xl font-bold">{revenue.activeCount}</p>
          </Card>
          <Card className="p-4">
            <MousePointerClick className="h-5 w-5 text-primary mb-2" />
            <p className="text-xs text-muted-foreground">Total clicks</p>
            <p className="text-xl font-bold">{revenue.totalClicks}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-muted-foreground mb-2">By slot</p>
            {Object.entries(revenue.bySlot).map(([slot, amt]) => (
              <p key={slot} className="text-xs flex justify-between"><span className="text-muted-foreground">{SLOT_LABELS[slot]}</span><span className="font-medium">{formatNaira(amt)}</span></p>
            ))}
          </Card>
        </div>
      </div>

      {/* Pending Review */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">Pending Review {pendingReview.length > 0 && <span className="ml-1 text-xs text-amber-700">({pendingReview.length})</span>}</h3>
          <Button size="sm" variant="outline" onClick={load} className="gap-1.5"><RefreshCw className="h-3.5 w-3.5" /> Refresh</Button>
        </div>
        {pendingReview.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing waiting on review.</p>
        ) : (
          <div className="space-y-3">
            {pendingReview.map((ad) => (
              <Card key={ad.id} className="p-4 flex flex-col sm:flex-row gap-4">
                {ad.image_url && <img src={ad.image_url} alt={ad.business_name} className="w-full sm:w-40 h-24 object-cover rounded-lg" />}
                <div className="flex-1">
                  <p className="font-semibold">{ad.business_name}</p>
                  <p className="text-xs text-muted-foreground">{SLOT_LABELS[ad.slot_type]} · {ad.duration_type} · {formatNaira(ad.amount_paid)}</p>
                  <p className="text-xs text-muted-foreground mt-1">{ad.contact_name} · {ad.whatsapp_number}{ad.email ? ` · ${ad.email}` : ''}</p>

                  {rejectingId === ad.id ? (
                    <div className="mt-3 flex gap-2">
                      <Input placeholder="Rejection reason" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} className="flex-1" />
                      <Button size="sm" variant="destructive" disabled={busyId === ad.id} onClick={() => handleReject(ad)}>Confirm</Button>
                      <Button size="sm" variant="ghost" onClick={() => { setRejectingId(null); setRejectReason(''); }}>Cancel</Button>
                    </div>
                  ) : (
                    <div className="mt-3 flex gap-2">
                      <Button size="sm" className="gap-1.5" disabled={busyId === ad.id} onClick={() => handleApprove(ad)}>
                        <CheckCircle2 className="h-4 w-4" /> Approve
                      </Button>
                      <Button size="sm" variant="outline" className="gap-1.5" disabled={busyId === ad.id} onClick={() => setRejectingId(ad.id)}>
                        <XCircle className="h-4 w-4" /> Reject
                      </Button>
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* All Ads */}
      <div>
        <div className="flex flex-col sm:flex-row gap-3 mb-3">
          <h3 className="font-semibold flex-1">All Ads</h3>
          <Input placeholder="Search business / WhatsApp" value={search} onChange={(e) => setSearch(e.target.value)} className="sm:w-56" />
          <Select value={filterSlot} onValueChange={setFilterSlot}>
            <SelectTrigger className="sm:w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All slots</SelectItem>
              {Object.entries(SLOT_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="sm:w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {Object.keys(STATUS_STYLES).map((s) => <SelectItem key={s} value={s}>{s.replace(/_/g, ' ')}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <Card className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Business</TableHead>
                <TableHead>Slot</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Queue #</TableHead>
                <TableHead>Ends</TableHead>
                <TableHead>Clicks</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAds.map((ad) => (
                <TableRow key={ad.id}>
                  <TableCell>
                    <p className="font-medium">{ad.business_name}</p>
                    <p className="text-xs text-muted-foreground">{ad.whatsapp_number}</p>
                  </TableCell>
                  <TableCell className="text-xs">{SLOT_LABELS[ad.slot_type]}</TableCell>
                  <TableCell>
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[ad.status] || 'bg-slate-100 text-slate-600'}`}>
                      {ad.status.replace(/_/g, ' ')}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs">{ad.queue_position ?? '—'}</TableCell>
                  <TableCell className="text-xs">{ad.end_date ? new Date(ad.end_date).toLocaleDateString() : '—'}</TableCell>
                  <TableCell className="text-xs">{ad.click_count}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1.5 flex-wrap">
                      {ad.status === 'active' && (
                        <Button size="sm" variant="outline" className="gap-1" disabled={busyId === ad.id} onClick={() => withBusy(ad.id, () => adsAPI.adminPause(ad.id))}>
                          <Pause className="h-3.5 w-3.5" /> Pause
                        </Button>
                      )}
                      {ad.status === 'paused' && (
                        <Button size="sm" variant="outline" className="gap-1" disabled={busyId === ad.id} onClick={() => withBusy(ad.id, () => adsAPI.adminResume(ad.id))}>
                          <Play className="h-3.5 w-3.5" /> Resume
                        </Button>
                      )}
                      {(ad.status === 'active' || ad.status === 'paused') && (
                        extendingId === ad.id ? (
                          <div className="flex items-center gap-1">
                            <Input className="w-16 h-8" value={extendDays} onChange={(e) => setExtendDays(e.target.value)} />
                            <Button size="sm" disabled={busyId === ad.id} onClick={() => handleExtend(ad)}>Go</Button>
                          </div>
                        ) : (
                          <Button size="sm" variant="outline" onClick={() => setExtendingId(ad.id)}>Extend</Button>
                        )
                      )}
                      {['active', 'paused', 'pending_queue', 'pending_review'].includes(ad.status) && (
                        <Button size="sm" variant="ghost" className="gap-1 text-destructive" disabled={busyId === ad.id} onClick={() => withBusy(ad.id, () => adsAPI.adminCancel(ad.id))}>
                          <Ban className="h-3.5 w-3.5" /> Cancel
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>

      {/* Slot Config */}
      <div>
        <h3 className="font-semibold mb-3">Slot Config</h3>
        <div className="grid gap-4 sm:grid-cols-3">
          {slots.map((slot) => (
            <Card key={slot.slot_type} className="p-4">
              <p className="font-semibold text-sm mb-3">{SLOT_LABELS[slot.slot_type]}</p>
              <div className="space-y-2">
                <div>
                  <Label className="text-xs">Max concurrent ads</Label>
                  <Input type="number" value={slot.max_concurrent_ads} onChange={(e) => handleSlotConfigChange(slot.slot_type, 'max_concurrent_ads', e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Price / week (₦)</Label>
                  <Input type="number" value={slot.price_week} onChange={(e) => handleSlotConfigChange(slot.slot_type, 'price_week', e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Price / month (₦)</Label>
                  <Input type="number" value={slot.price_month} onChange={(e) => handleSlotConfigChange(slot.slot_type, 'price_month', e.target.value)} />
                </div>
                <Button size="sm" className="w-full mt-1" onClick={() => saveSlotConfig(slot)}>Save</Button>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Add Free/House Ad */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">Add Free / House Ad</h3>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setHouseAdOpen((v) => !v)}>
            <PlusCircle className="h-4 w-4" /> {houseAdOpen ? 'Close' : 'Add'}
          </Button>
        </div>
        {houseAdOpen && (
          <Card className="p-4 space-y-3 max-w-lg">
            <p className="text-xs text-muted-foreground">Skips payment entirely and goes straight to active — for Rentora's own promos.</p>
            <Select value={houseAdForm.slotType} onValueChange={(v) => setHouseAdForm((p) => ({ ...p, slotType: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(SLOT_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input placeholder="Business name" value={houseAdForm.businessName} onChange={(e) => setHouseAdForm((p) => ({ ...p, businessName: e.target.value }))} />
            <Input placeholder="Contact name" value={houseAdForm.contactName} onChange={(e) => setHouseAdForm((p) => ({ ...p, contactName: e.target.value }))} />
            <Input placeholder="WhatsApp number (+234...)" value={houseAdForm.whatsappNumber} onChange={(e) => setHouseAdForm((p) => ({ ...p, whatsappNumber: e.target.value }))} />
            <Input placeholder="Image URL (upload elsewhere, paste link here)" value={houseAdForm.imageUrl} onChange={(e) => setHouseAdForm((p) => ({ ...p, imageUrl: e.target.value }))} />
            <Select value={houseAdForm.durationType} onValueChange={(v) => setHouseAdForm((p) => ({ ...p, durationType: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="week">1 week</SelectItem>
                <SelectItem value="month">1 month</SelectItem>
              </SelectContent>
            </Select>
            <Button className="w-full" onClick={handleAddHouseAd}>Add & go live</Button>
          </Card>
        )}
      </div>
    </div>
  );
}

export default AdsTab;
