import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Megaphone } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { advertisingAPI, safeExternalUrl } from '../lib/advertising';

export function AdSlot({ slot, className = '' }) {
  const [ad, setAd] = useState(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const now = new Date().toISOString();
      const { data } = await supabase
        .from('advertisements')
        .select('id, advertiser_name, creative_url, destination_url, headline, description, starts_at, ends_at')
        .eq('slot', slot)
        .eq('status', 'approved')
        .eq('payment_status', 'paid')
        .lte('starts_at', now)
        .gte('ends_at', now)
        .limit(1)
        .maybeSingle();
      if (active) { setAd(data || null); setLoaded(true); }
    };
    load();
    return () => { active = false; };
  }, [slot]);

  const destination = safeExternalUrl(ad?.destination_url);
  const content = ad ? (
    <a href={destination || '#'} target="_blank" rel="noopener noreferrer" onClick={() => advertisingAPI.incrementClick(ad.id)} className="group block overflow-hidden rounded-2xl border border-border/70 bg-card transition hover:border-primary/40 hover:shadow-md">
      <div className="relative aspect-[3/1] overflow-hidden bg-muted">
        <img src={ad.creative_url} alt={ad.headline || `${ad.advertiser_name} advertisement`} className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.02]" loading="lazy" />
        <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-background/90 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Sponsored <ArrowUpRight className="h-3 w-3" /></span>
      </div>
      {(ad.headline || ad.description) && <div className="p-4"><p className="font-semibold text-foreground">{ad.headline || ad.advertiser_name}</p>{ad.description && <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">{ad.description}</p>}</div>}
    </a>
  ) : (
    <Link to="/advertise" className="flex min-h-24 items-center justify-between rounded-2xl border border-dashed border-border bg-muted/30 px-5 py-4 transition hover:border-primary/50 hover:bg-muted/50">
      <span className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary"><Megaphone className="h-4 w-4" /></span><span><span className="block text-sm font-semibold text-foreground">Advertise here</span><span className="block text-xs text-muted-foreground">Reach students looking for their next home.</span></span></span><ArrowUpRight className="h-4 w-4 text-muted-foreground" />
    </Link>
  );

  return <aside aria-label={`${slot} advertising`} className={`mx-auto max-w-7xl px-5 sm:px-8 ${className}`}>{loaded ? content : <div className="min-h-24 animate-pulse rounded-2xl bg-muted/40" />}</aside>;
}

export default AdSlot;
