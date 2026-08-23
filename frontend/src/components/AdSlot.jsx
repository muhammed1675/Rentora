import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { adsAPI } from '../lib/api';
import { normalizeNgPhone } from '../lib/utils';

// Fixed aspect ratios per slot, matching ad_slot_config.image_width /
// image_height in supabase/schema/22_ads.sql — kept here as a fallback so
// the slot never jumps in size while the config row is still loading.
const SLOT_ASPECT = {
  header_billboard: 970 / 250,
  mid_page_content: 1000 / 200,
  in_feed_banner: 728 / 90,
};

const AUTO_ADVANCE_MS = 5000;
const SLIDE_TRANSITION_MS = 500;

/**
 * <AdSlot slotType="header_billboard" />
 *
 * Renders a static "Advertise here" invite when the slot has no active
 * ads, or an auto-sliding carousel when there are one or more — the
 * invite always stays in the rotation as the last slide, so it never
 * disappears once real ads start filling the slot. Every real ad links
 * out to a WhatsApp chat — there's no advertiser dashboard anywhere in
 * this feature.
 *
 * Slides are laid out in a horizontal track and moved with a CSS
 * transform, so switching slides is a genuine slide-in/slide-out motion
 * rather than one slide disappearing and the next popping in.
 */
export function AdSlot({ slotType }) {
  const [ads, setAds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [index, setIndex] = useState(0);
  const touchStartX = useRef(null);
  const aspect = SLOT_ASPECT[slotType] || 970 / 250;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    adsAPI.getActiveAdsForSlot(slotType)
      .then(({ data }) => { if (!cancelled) setAds(data); })
      .catch((err) => {
        // Fail open: even if the query errors (network blip, RLS hiccup),
        // still show the "advertise here" invite rather than nothing —
        // an empty slot with no explanation looks like a bug, not ads.
        console.error(`AdSlot(${slotType}): failed to load active ads`, err);
        if (!cancelled) setAds([]);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [slotType]);

  // Real ads first, then a permanent "advertise here" slide so the invite
  // never gets crowded out entirely once a slot fills up.
  const slides = [...ads.map((ad) => ({ type: 'ad', ad })), { type: 'house' }];

  const goTo = useCallback((i) => {
    setIndex((prev) => {
      if (!slides.length) return prev;
      return (i + slides.length) % slides.length;
    });
  }, [slides.length]);

  // Auto-advance
  useEffect(() => {
    if (slides.length < 2) return;
    const t = setInterval(() => goTo(index + 1), AUTO_ADVANCE_MS);
    return () => clearInterval(t);
  }, [slides.length, index, goTo]);

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

  if (loading) return null; // avoid a flash of empty/placeholder before the first fetch resolves

  const safeIndex = index % slides.length;

  return (
    <div
      className="group relative w-full overflow-hidden rounded-xl bg-muted/20"
      style={{ aspectRatio: aspect }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Sliding track — holds every slide side by side and moves as a
          whole, so advancing feels like a slide-in rather than a swap. */}
      <div
        className="flex h-full w-full"
        style={{
          transform: `translateX(-${safeIndex * 100}%)`,
          transition: `transform ${SLIDE_TRANSITION_MS}ms ease-out`,
        }}
      >
        {slides.map((slide, i) => (
          <div key={i} className="h-full w-full shrink-0 overflow-hidden">
            {slide.type === 'house' ? (
              <Link
                to="/advertise"
                className="flex h-full w-full items-center justify-center border border-dashed border-border/70 bg-muted/30 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/50"
              >
                Advertise here
              </Link>
            ) : (
              <a
                href={`https://wa.me/${normalizeNgPhone(slide.ad.whatsapp_number)}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => handleClick(slide.ad)}
                className="block h-full w-full overflow-hidden"
              >
                <img
                  src={slide.ad.image_url}
                  alt={slide.ad.business_name}
                  className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-110 group-active:scale-110"
                  loading="lazy"
                  decoding="async"
                />
              </a>
            )}
          </div>
        ))}
      </div>

      {slides.length > 1 && (
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
            {slides.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Show slide ${i + 1}`}
                onClick={(e) => { e.preventDefault(); goTo(i); }}
                className={`h-1.5 rounded-full transition-all ${i === safeIndex ? 'w-4 bg-white' : 'w-1.5 bg-white/60'}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default AdSlot;