import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, XCircle, Save, RefreshCw, MousePointerClick, Wallet, Megaphone } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Input } from './ui/input';

const slots = [
  ['header_billboard', 'Header Billboard'],
  ['mid_page_content', 'Mid-Page Content'],
  ['in_feed_banner', 'In-Feed Banner'],
];
const money = (value) => new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(value || 0);

export function AdsAdminPanel() {
  const [ads, setAds] = useState([]);
  const [configs, setConfigs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: adRows }, { data: configRows }] = await Promise.all([
      supabase.from('ads').select('*').order('created_at', { ascending: false }),
      supabase.from('ad_slot_config').select('*').order('slot'),
    ]);
    setAds(adRows || []);
    setConfigs(configRows || []);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const review = async (id, status) => {
    const { error } = await supabase.rpc(status === 'approved' ? 'approve_ad' : 'reject_ad', { p_ad_id: id });
    if (!error) load();
  };
  const saveConfig = async (config) => {
    setSaving(config.slot);
    await supabase.from('ad_slot_config').update({ max_concurrent_ads: Number(config.max_concurrent_ads), weekly_price: Number(config.weekly_price), monthly_price: Number(config.monthly_price), updated_at: new Date().toISOString() }).eq('slot', config.slot);
    setSaving(null);
    load();
  };

  const totalRevenue = ads.filter(a => ['paid', 'approved', 'active'].includes(a.payment_status) || a.status === 'approved').reduce((sum, a) => sum + Number(a.amount_paid || a.price || 0), 0);
  const pending = ads.filter(a => a.status === 'pending' || a.status === 'pending_review').length;
  const clicks = ads.reduce((sum, a) => sum + Number(a.clicks || a.click_count || 0), 0);

  return <div className="flex flex-col gap-6">
    <div className="grid gap-4 sm:grid-cols-3">
      <Card className="p-5"><Wallet className="mb-3 h-5 w-5 text-primary" /><p className="text-xs text-muted-foreground">Ad revenue</p><p className="mt-1 text-2xl font-bold">{money(totalRevenue)}</p></Card>
      <Card className="p-5"><Megaphone className="mb-3 h-5 w-5 text-primary" /><p className="text-xs text-muted-foreground">Active ads</p><p className="mt-1 text-2xl font-bold">{ads.filter(a => a.status === 'approved' || a.status === 'active').length}</p></Card>
      <Card className="p-5"><MousePointerClick className="mb-3 h-5 w-5 text-primary" /><p className="text-xs text-muted-foreground">Total clicks</p><p className="mt-1 text-2xl font-bold">{clicks} <span className="text-sm font-normal text-muted-foreground">· {pending} pending</span></p></Card>
    </div>
    <div className="flex items-center justify-between"><h3 className="text-lg font-semibold">Ad review queue</h3><Button variant="outline" size="sm" onClick={load} disabled={loading}><RefreshCw className={loading ? 'animate-spin' : ''} data-icon="inline-start" /> Refresh</Button></div>
    <Card className="overflow-hidden"><div className="divide-y">
      {ads.length === 0 && <p className="p-6 text-sm text-muted-foreground">No ads submitted yet.</p>}
      {ads.map(ad => <div key={ad.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0"><p className="font-semibold">{ad.business_name || ad.full_name || 'Unnamed advertiser'}</p><p className="text-sm text-muted-foreground">{ad.slot} · {ad.whatsapp_number || 'No WhatsApp'} · {money(ad.amount_paid || ad.price)}</p></div>
        <div className="flex items-center gap-2"><Badge variant={ad.status === 'approved' || ad.status === 'active' ? 'default' : 'secondary'}>{ad.status || 'pending'}</Badge>{(ad.status === 'pending' || ad.status === 'pending_review') && <><Button size="sm" onClick={() => review(ad.id, 'approved')}><CheckCircle2 data-icon="inline-start" /> Approve</Button><Button size="sm" variant="outline" onClick={() => review(ad.id, 'rejected')}><XCircle data-icon="inline-start" /> Reject</Button></>}</div>
      </div>)}
    </div></Card>
    <h3 className="text-lg font-semibold">Slot configuration</h3>
    <div className="grid gap-4 lg:grid-cols-3">{slots.map(([slot, label]) => { const config = configs.find(c => c.slot === slot) || { slot, max_concurrent_ads: 5, weekly_price: 1000, monthly_price: slot === 'header_billboard' ? 9000 : slot === 'mid_page_content' ? 6000 : 4500 }; return <Card key={slot} className="flex flex-col gap-3 p-5"><h4 className="font-semibold">{label}</h4><label className="text-xs text-muted-foreground">Max concurrent ads<Input type="number" value={config.max_concurrent_ads} onChange={e => setConfigs(cs => cs.map(c => c.slot === slot ? { ...c, max_concurrent_ads: e.target.value } : c).concat(cs.some(c => c.slot === slot) ? [] : [{ ...config, max_concurrent_ads: e.target.value }]))} /></label><label className="text-xs text-muted-foreground">Price / week (₦)<Input type="number" value={config.weekly_price} onChange={e => setConfigs(cs => cs.map(c => c.slot === slot ? { ...c, weekly_price: e.target.value } : c))} /></label><label className="text-xs text-muted-foreground">Price / month (₦)<Input type="number" value={config.monthly_price} onChange={e => setConfigs(cs => cs.map(c => c.slot === slot ? { ...c, monthly_price: e.target.value } : c))} /></label><Button onClick={() => saveConfig(config)} disabled={saving === slot}><Save data-icon="inline-start" /> {saving === slot ? 'Saving…' : 'Save'}</Button></Card>; })}</div>
  </div>;
}
export default AdsAdminPanel;
