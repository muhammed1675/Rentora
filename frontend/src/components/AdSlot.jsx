import { useEffect, useState } from 'react';
import { ExternalLink, MessageCircle, Megaphone } from 'lucide-react';
import { supabase } from '../lib/supabase';

const SLOT_LABELS = {
  header_billboard: 'Header Billboard',
  mid_page_content: 'Mid-Page Content',
  in_feed_banner: 'In-Feed Banner',
};

export function AdSlot({ slot, context = '', className = '' }) {
  const [ad, setAd] = useState(null);

  useEffect(() => {
    let mounted = true;
    supabase.rpc('get_active_ad', { p_slot: slot })
      .then(({ data, error }) => {
        if (!error && mounted) setAd(Array.isArray(data) ? data[0] : data);
      })
      .catch(() => {});
    return () => { mounted = false; };
  }, [slot]);

  if (!ad) return null;

  const whatsapp = ad.whatsapp_url || `https://wa.me/${String(ad.whatsapp_number || '').replace(/\\D/g, '')}`;
  const openAd = () => {
    supabase.rpc('increment_ad_click', { p_ad_id: ad.id }).catch(() => {});
    window.open(`${whatsapp}${whatsapp.includes('?') ? '&' : '?'}text=${encodeURIComponent(`Hello ${ad.business_name || ad.full_name || ''}, I found your advert on Rentora${context ? ` while viewing ${context}` : ''}.`)}`, '_blank', 'noopener,noreferrer');
  };

  return (
    <button type="button" onClick={openAd} className={`group block w-full overflow-hidden rounded-2xl border border-border/60 bg-card text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${className}`} aria-label={`Contact ${ad.business_name || ad.full_name || 'advertiser'} on WhatsApp`}>
      <div className="flex items-center justify-between gap-3 border-b border-border/50 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5"><Megaphone className="h-3.5 w-3.5" /> Sponsored · {SLOT_LABELS[slot] || 'Advert'}</span>
        <ExternalLink className="h-3.5 w-3.5 opacity-60" />
      </div>
      <div className="flex min-h-24 items-center gap-4 p-3 sm:p-4">
        {ad.image_url && <img src={ad.image_url} alt={ad.business_name || 'Sponsored advert'} className="h-20 w-28 shrink-0 rounded-xl object-cover sm:h-24 sm:w-40" loading="lazy" />}
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold text-foreground">{ad.business_name || ad.full_name}</p>
          {ad.ad_text && <p className="mt-1 line-clamp-2 text-sm leading-6 text-muted-foreground">{ad.ad_text}</p>}
          <span className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-primary"><MessageCircle className="h-3.5 w-3.5" /> Chat on WhatsApp</span>
        </div>
      </div>
    </button>
  );
}

export default AdSlot;
