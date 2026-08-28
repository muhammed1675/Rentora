import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Megaphone } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { advertisingAPI } from '../lib/advertising';

const ADVERTISE_PORTAL_URL = 'https://advertise.rentora.com.ng/';

export function AdSlot({ slot, className = '', contained = false }) {
  const [ads, setAds] = useState([]);
  const [index, setIndex] = useState(0);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const now = new Date().toISOString();
      const { data } = await supabase.from('ads').select('id, full_name, business_name, image_url, ad_text, message_body, starts_at, ends_at').eq('slot', slot).in('status', ['approved', 'active']).in('payment_status', ['paid', 'completed']).limit(12);
      const eligible = (data || []).filter((candidate) => (!candidate.starts_at || candidate.starts_at <= now) && (!candidate.ends_at || candidate.ends_at >= now));
      if (active) { setAds(eligible); setLoaded(true); }
    };
    load();
    return () => { active = false; };
  }, [slot]);

  // The house ad is always part of the rotation, so a single paid ad still
  // alternates with the “Advertise here” placement every five seconds.
  const slideCount = ads.length + 1;

  useEffect(() => {
    if (!loaded) return undefined;
    const timer = window.setInterval(() => setIndex((current) => (current + 1) % slideCount), 5000);
    return () => window.clearInterval(timer);
  }, [loaded, slideCount]);

  useEffect(() => {
    setIndex((current) => Math.min(current, Math.max(0, slideCount - 1)));
  }, [slideCount]);

  const wrapperClass = contained ? className : `mx-auto max-w-7xl px-5 sm:px-8 ${className}`;

  if (!loaded) return <aside aria-label={`${slot} advertising`} className={wrapperClass}><div className="min-h-20 animate-pulse rounded-2xl bg-muted/40" /></aside>;
  const ad = ads[index];
  const content = ad ? <Link to={`/ads/${ad.id}`} onClick={() => advertisingAPI.incrementClick(ad.id)} className="group block overflow-hidden rounded-xl border border-border/70 bg-card transition hover:border-primary/40 hover:shadow-md"><div className="relative aspect-[5/1] overflow-hidden bg-muted sm:aspect-[7/1]"><img src={ad.image_url} alt={`${ad.business_name || ad.full_name || 'Advertiser'} advertisement`} className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.02]" loading="lazy" /><span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-background/90 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Sponsored <ArrowUpRight className="h-3 w-3" /></span></div>{ad.ad_text && <div className="flex items-center justify-between gap-4 px-4 py-3"><p className="truncate text-sm font-semibold text-foreground">{ad.business_name || ad.full_name}</p><p className="hidden truncate text-sm text-muted-foreground sm:block">{ad.ad_text}</p><ArrowUpRight className="h-4 w-4 shrink-0 text-primary" /></div>}</Link> : <a href={ADVERTISE_PORTAL_URL} target="_blank" rel="noopener noreferrer" className="flex min-h-20 items-center justify-between rounded-xl border border-dashed border-border bg-muted/30 px-5 py-4 transition hover:border-primary/50 hover:bg-muted/50"><span className="flex items-center gap-3"><span className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary"><Megaphone className="h-4 w-4" /></span><span><span className="block text-sm font-semibold text-foreground">Advertise here</span><span className="block text-xs text-muted-foreground">Reach students looking for their next home.</span></span></span><ArrowUpRight className="h-4 w-4 text-muted-foreground" /></a>;
  return <aside aria-label={`${slot} advertising`} className={wrapperClass}><div key={ad?.id || 'placeholder'} className="animate-in fade-in duration-500">{content}</div><div className="mt-2 flex justify-center gap-1" aria-label={`${slideCount} advertising slides`} role="tablist">{Array.from({ length: slideCount }, (_, itemIndex) => <button key={itemIndex} type="button" role="tab" aria-label={itemIndex === ads.length ? 'Show advertise here slide' : `Show advertisement ${itemIndex + 1}`} aria-selected={itemIndex === index} onClick={() => setIndex(itemIndex)} className={`h-1.5 rounded-full transition-all ${itemIndex === index ? 'w-5 bg-primary' : 'w-1.5 bg-border'}`} />)}</div></aside>;
}

export default AdSlot;