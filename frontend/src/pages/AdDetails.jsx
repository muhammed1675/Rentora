import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ExternalLink, Globe, MessageCircle, Megaphone } from 'lucide-react';
import { advertisingAPI, safeExternalUrl } from '../lib/advertising';

export default function AdDetails() {
  const { id } = useParams();
  const [ad, setAd] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    advertisingAPI.getPublicAd(id).then((result) => {
      if (mounted) { setAd(result); setLoading(false); }
    }).catch(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [id]);

  if (loading) return <main className="mx-auto flex min-h-[60vh] max-w-3xl items-center justify-center px-5"><div className="h-12 w-full animate-pulse rounded-2xl bg-muted" /></main>;
  if (!ad) return <main className="mx-auto flex min-h-[60vh] max-w-3xl flex-col items-center justify-center gap-4 px-5 text-center"><Megaphone className="h-10 w-10 text-primary" /><h1 className="text-2xl font-semibold">This ad is no longer available</h1><Link to="/" className="text-sm font-semibold text-primary hover:underline">Return to Rentora</Link></main>;

  const website = safeExternalUrl(ad.link_url);
  const whatsappDigits = String(ad.whatsapp_number || '').replace(/\D/g, '');
  const whatsapp = whatsappDigits ? `https://wa.me/${whatsappDigits}` : '';
  const displayText = ad.ad_text?.split(' — ') || [];

  return <main className="mx-auto max-w-5xl px-5 py-8 sm:px-8 md:py-14">
    <Link to="/" className="mb-7 inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-primary"><ArrowLeft className="h-4 w-4" /> Back to Rentora</Link>
    <article className="overflow-hidden rounded-[28px] border border-border/70 bg-card shadow-sm">
      <div className="relative aspect-[16/7] min-h-56 bg-muted sm:min-h-72"><img src={ad.image_url} alt={`${ad.business_name || ad.full_name || 'Advertiser'} advertisement`} className="h-full w-full object-cover" /><span className="absolute right-4 top-4 rounded-full bg-background/90 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Sponsored</span></div>
      <div className="grid gap-8 p-6 sm:p-10 md:grid-cols-[1fr_auto] md:items-end">
        <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">{ad.business_name || 'Rentora advertiser'}</p><h1 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-foreground sm:text-4xl">{displayText[0] || 'Featured advertisement'}</h1>{displayText[1] && <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">{displayText.slice(1).join(' — ')}</p>}<p className="mt-5 text-sm text-muted-foreground">Connect directly with this advertiser to learn more.</p></div>
        <div className="flex flex-wrap gap-3">{whatsapp && <a href={whatsapp} target="_blank" rel="noopener noreferrer" onClick={() => advertisingAPI.incrementClick(ad.id)} className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90"><MessageCircle className="h-4 w-4" /> WhatsApp</a>}{website && <a href={website} target="_blank" rel="noopener noreferrer" onClick={() => advertisingAPI.incrementClick(ad.id)} className="inline-flex items-center gap-2 rounded-full border border-border px-5 py-3 text-sm font-semibold text-foreground hover:border-primary/50"><Globe className="h-4 w-4" /> Visit website <ExternalLink className="h-3.5 w-3.5" /></a>}</div>
      </div>
    </article>
  </main>;
}

export { AdDetails };
