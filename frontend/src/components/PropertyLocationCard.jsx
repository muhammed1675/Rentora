import { useEffect, useState } from 'react';
import { MapPin, Navigation, ExternalLink, Loader2 } from 'lucide-react';
import { Card } from './ui/card';

// Google Maps short links (https://maps.app.goo.gl/xxxx) CANNOT be embedded
// in an iframe — Google blocks them cross-origin and the frame renders blank.
// So we embed from whatever we can resolve locally:
//   1. coordinates parsed out of the stored link, when it is a full link
//   2. otherwise the property's address + location as a text query
// and we keep the agent's original short link for the "Open in Google Maps"
// / directions buttons, where it works perfectly.
export function parseLatLng(link) {
  if (!link) return null;
  const patterns = [
    /@(-?\d+\.\d+),(-?\d+\.\d+)/,            // .../@6.5244,3.3792,17z
    /[?&]q=(-?\d+\.\d+),\s*(-?\d+\.\d+)/,     // ...?q=6.5244,3.3792
    /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/,         // ...!3d6.5244!4d3.3792
    /[?&]destination=(-?\d+\.\d+),\s*(-?\d+\.\d+)/,
  ];
  for (const re of patterns) {
    const m = link.match(re);
    if (m) return { lat: m[1], lng: m[2] };
  }
  return null;
}

export function isShortMapLink(link) {
  return !!link && /(^|\.)(maps\.app\.goo\.gl|goo\.gl)/.test(link);
}

// Google's share sheet only hands out short links, which can't be iframed and
// carry no coordinates. /api/resolve-map-link follows the redirect server-side
// and returns the real lat/lng, which we then cache in sessionStorage.
export async function resolveMapLink(link) {
  const cacheKey = `map-coords:${link}`;
  try {
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) return JSON.parse(cached);
  } catch {
    /* sessionStorage unavailable — just resolve again */
  }
  const res = await fetch(`/api/resolve-map-link?url=${encodeURIComponent(link)}`);
  if (!res.ok) throw new Error(`resolve-map-link ${res.status}`);
  const data = await res.json();
  if (typeof data?.lat !== 'number' || typeof data?.lng !== 'number') {
    throw new Error('resolve-map-link returned no coordinates');
  }
  const coords = { lat: String(data.lat), lng: String(data.lng) };
  try {
    sessionStorage.setItem(cacheKey, JSON.stringify(coords));
  } catch {
    /* ignore quota errors */
  }
  return coords;
}

export function buildMapEmbed({ link, address, location, title, coords: given }) {
  const coords = given || parseLatLng(link);
  if (coords) {
    return `https://www.google.com/maps?q=${coords.lat},${coords.lng}&z=16&output=embed`;
  }
  const query = [address, location, title].filter(Boolean).join(', ');
  if (!query) return null;
  return `https://www.google.com/maps?q=${encodeURIComponent(query)}&z=15&output=embed`;
}

export default function PropertyLocationCard({ property }) {
  const link = property?.google_maps_link || null;
  const linkCoords = parseLatLng(link);
  const [resolved, setResolved] = useState(null);
  const [resolving, setResolving] = useState(false);

  useEffect(() => {
    setResolved(null);
    if (linkCoords || !isShortMapLink(link)) return;
    let active = true;
    setResolving(true);
    resolveMapLink(link)
      .then((c) => active && setResolved(c))
      .catch(() => {})
      .finally(() => active && setResolving(false));
    return () => {
      active = false;
    };
  }, [link, linkCoords?.lat, linkCoords?.lng]);

  const coords = linkCoords || resolved;
  const embedUrl = buildMapEmbed({
    link,
    coords,
    address: property?.address,
    location: property?.location,
    title: property?.title,
  });
  const directionsUrl =
    link ||
    (coords
      ? `https://www.google.com/maps/dir/?api=1&destination=${coords.lat},${coords.lng}`
      : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
          [property?.address, property?.location].filter(Boolean).join(', '),
        )}`);

  if (!embedUrl && !link) return null;

  return (
    <Card className="max-w-full overflow-hidden p-0">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border p-4 sm:p-6">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold">Location</h2>
          <p className="mt-1 flex items-start gap-1.5 text-sm text-muted-foreground">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
            <span className="min-w-0 break-words">
              {[property?.address, property?.location].filter(Boolean).join(' · ') || 'Location on request'}
            </span>
          </p>
        </div>
        {resolving ? (
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" /> Locating
          </span>
        ) : (
          !coords && (
            <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
              Approximate area
            </span>
          )
        )}
      </div>

      {embedUrl && (
        <div className="relative aspect-[16/10] w-full bg-muted sm:aspect-[16/7]">
          <iframe
            title={`Map of ${property?.title || 'this property'}`}
            key={embedUrl}
            src={embedUrl}
            className="absolute inset-0 h-full w-full border-0"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            allowFullScreen
          />
        </div>
      )}

      <div className="flex flex-col gap-2 p-4 sm:flex-row sm:p-6">
        <a
          href={directionsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
        >
          <Navigation className="h-4 w-4 shrink-0" /> Get directions
        </a>
        {link && (
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-semibold transition-colors hover:bg-muted"
          >
            <ExternalLink className="h-4 w-4 shrink-0" /> Open in Google Maps
          </a>
        )}
      </div>
    </Card>
  );
}
