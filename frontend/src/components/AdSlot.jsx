import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { adsAPI } from '../lib/api';

// Fixed aspect ratios per slot, matching ad_slot_config.image_width /
// image_height in supabase/schema/22_ads.sql — kept here as a fallback so
// the slot never jumps in size while the config row is still loading.
const SLOT_ASPECT = {
  header_billboard: 970 / 250,
  mid_page_content: 1000 / 200,
  in_feed_banner: 728 / 90,
};

const AUTO_ADVANCE_MS = 5000;

/**
 * <AdSlot slotType="header_billboard" />
 *
 * Renders nothing when the slot has no active ads (space collapses), a
 * static image when there's exactly one, or an auto-sliding carousel when
 * there are several. Every ad links out to a WhatsApp chat — there's no
 * advertiser dashboard anywhere in this feature.
 */
export function AdSlot({ slotType }) {
  const [ads, setAds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [index, setIndex] = useState(0);
  const touchStartX = useRef(null);
  const aspect = SLOT_ASPECT[slotType] || 970 / 250;

  useEffect(() => {
    let cancelled = false;
    adsAPI.getActiveAdsForSlot(slotType)
      .then(({ data }) => { if (!cancelled) setAds(data); })
      .catch(() => { if (!cancelled) setAds([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [slotType]);

  const goTo = useCallback((i) => {
    setIndex((prev) => {
      if (!ads.length) return prev;
      return (i + ads.length) % ads.length;
    });
  }, [ads.length]);

  // Auto-advance
  useEffect(() => {
    if (ads.length < 2) return;
    const t = setInterval(() => goTo(index + 1), AUTO_ADVANCE_MS);
    return () => clearInterval(t);
  }, [ads.length, index, goTo]);

  const handleClick = (ad) => {
    adsAPI.recordClick(ad.id); // fire-and-forget, never blocks navigation
  };

  const handleTouchStart = (e) => { touchStartX.current = e.touches[0].clientX; };
  const handleTouchEnd = (e) => {
    if (touchStartX.current === null) return;
    const delta = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(delta) > 40) goTo(index + (delta < 0 ? 1 : -1));
    touchStartX.current = null;
  };

  if (loading || !ads.length) {
    // House ad: quietly invite agents/businesses instead of collapsing to
    // nothing on an otherwise-empty page. Loading state also renders
    // nothing so the page never flashes an empty box.
    if (loading) return null;
    return (
      <div style={{ aspectRatio: aspect }} className="w-full">
        <Link
          to="/advertise"
          className="flex h-full w-full items-center justify-center rounded-xl border border-dashed border-border/70 bg-muted/30 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/50"
        >
          Advertise here
        </Link>
      </div>
    );
  }

  const ad = ads[index];
  const digitsOnly = (ad.whatsapp_number || '').replace(/\D/g, '');

  return (
    <div
      className="group relative w-full overflow-hidden rounded-xl bg-muted/20"
      style={{ aspectRatio: aspect }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <a
        href={`https://wa.me/${digitsOnly}`}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => handleClick(ad)}
        className="block h-full w-full"
      >
        <img
          src={ad.image_url}
          alt={ad.business_name}
          className="h-full w-full object-cover"
          loading="lazy"
          decoding="async"
        />
      </a>

      {ads.length > 1 && (
        <>
          <button
            type="button"
            aria-label="Previous ad"
            onClick={(e) => { e.preventDefault(); goTo(index - 1); }}
            className="absolute left-2 top-1/2 hidden -translate-y-1/2 rounded-full bg-black/40 p-1.5 text-white opacity-0 transition-opacity group-hover:opacity-100 sm:block"
          >
            ‹
          </button>
          <button
            type="button"
            aria-label="Next ad"
            onClick={(e) => { e.preventDefault(); goTo(index + 1); }}
            className="absolute right-2 top-1/2 hidden -translate-y-1/2 rounded-full bg-black/40 p-1.5 text-white opacity-0 transition-opacity group-hover:opacity-100 sm:block"
          >
            ›
          </button>
          <div className="absolute inset-x-0 bottom-2 flex justify-center gap-1.5">
            {ads.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Show ad ${i + 1}`}
                onClick={(e) => { e.preventDefault(); goTo(i); }}
                className={`h-1.5 rounded-full transition-all ${i === index ? 'w-4 bg-white' : 'w-1.5 bg-white/60'}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default AdSlot;
