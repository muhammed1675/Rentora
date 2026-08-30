// api/og-property.js — Vercel serverless function
//
// WHY THIS EXISTS
// Rentora is a client-rendered React SPA: when a real visitor loads
// /property/:id, the browser gets the same static index.html every route
// gets, then React fills in the property once it loads. That's fine for
// people, but link-preview crawlers (WhatsApp, Twitter/X, Facebook,
// Telegram, iMessage, Slack, Discord, LinkedIn...) don't run JavaScript —
// they just read the <meta> tags in whatever HTML is returned for that
// URL. Since index.html's og:image/og:title are the generic Rentora logo
// and tagline, EVERY shared property link previewed as "Rentora — Student
// Hostels..." instead of that property's own photo, title, and price.
//
// THE FIX
// vercel.json rewrites requests to /property/:id to THIS function, but
// only when the request's User-Agent matches a known link-preview bot (see
// the `has` condition on that rewrite). Real visitors never hit this file
// — they still get the normal SPA. This function fetches the one property,
// server-renders a minimal HTML page with property-specific Open Graph /
// Twitter Card tags, and meta-refreshes to the real /property/:id URL (so
// if a human DOES somehow land here directly, e.g. an older bot, they still
// end up on the real app).
//
// Uses the Supabase SERVICE ROLE key because this runs server-side only
// (same pattern as the other functions in this folder) and only ever
// SELECTs a single approved property's already-public fields.

import { createClient } from '@supabase/supabase-js';

const SITE_URL = 'https://www.rentora.com.ng';
const FALLBACK_IMAGE = `${SITE_URL}/rentora-og.png`;
// Branded, property-specific preview card rendered by api/og-image.js:
// the property's own photo with "RENTORA SKYLINE HOUSING SOLUTIONS" on top
// and the title/price/location along the bottom.
const cardImage = (id) => `${SITE_URL}/api/og-image?id=${encodeURIComponent(id)}`;
const FALLBACK_TITLE = 'Rentora — Student Hostels & Accommodation Near LAUTECH Ogbomosho';
const FALLBACK_DESCRIPTION = "Find verified hostels, self-contains, and apartments near LAUTECH, Ogbomosho. Browse listings, view agent contacts, and book free property viewings — all in one place.";

// Property links can now be either the UUID (old shared links) or the
// human-readable slug (new canonical URLs, see
// supabase/schema/31_property_slugs.sql). This function receives whatever
// segment was in the URL, so it has to detect which one it got — querying
// the `id` (uuid) column with a non-uuid string throws a Postgres type
// error instead of just returning zero rows.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function byIdOrSlug(query, idOrSlug) {
  return UUID_RE.test(idOrSlug) ? query.eq('id', idOrSlug) : query.eq('slug', idOrSlug);
}

function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatPrice(price) {
  const n = Number(price || 0);
  if (!Number.isFinite(n) || n <= 0) return '';
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 0 }).format(n);
}

function renderPage(res, { pageUrl, title, description, image }) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  // Bots re-fetch a URL every time it's shared/re-shared, so a short cache
  // avoids hammering Supabase for a popular listing without going stale
  // for long if the agent edits the property.
  res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=900, stale-while-revalidate=86400');
  res.status(200).send(`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}" />
<link rel="canonical" href="${pageUrl}" />

<meta property="og:site_name" content="Rentora" />
<meta property="og:type" content="website" />
<meta property="og:title" content="${escapeHtml(title)}" />
<meta property="og:description" content="${escapeHtml(description)}" />
<meta property="og:image" content="${escapeHtml(image)}" />
<meta property="og:image:secure_url" content="${escapeHtml(image)}" />
<meta property="og:image:type" content="image/png" />
<meta property="og:image:alt" content="${escapeHtml(title)}" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:url" content="${pageUrl}" />
<meta property="og:locale" content="en_NG" />

<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${escapeHtml(title)}" />
<meta name="twitter:description" content="${escapeHtml(description)}" />
<meta name="twitter:image" content="${escapeHtml(image)}" />

<meta http-equiv="refresh" content="0; url=${escapeHtml(pageUrl)}" />
</head>
<body>
<p>Redirecting to <a href="${escapeHtml(pageUrl)}">${escapeHtml(title)}</a> on Rentora&hellip;</p>
</body>
</html>`);
}

export default async function handler(req, res) {
  const routeParam = (req.query.id || '').toString().trim();
  const fallbackPageUrl = routeParam ? `${SITE_URL}/property/${encodeURIComponent(routeParam)}` : SITE_URL;

  const supabaseUrl = process.env.SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const fallback = () => renderPage(res, {
    pageUrl: fallbackPageUrl,
    title: FALLBACK_TITLE,
    description: FALLBACK_DESCRIPTION,
    image: FALLBACK_IMAGE,
  });

  if (!routeParam || !supabaseUrl || !serviceRoleKey) return fallback();

  try {
    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const { data: property, error } = await byIdOrSlug(
      supabase
        .from('properties')
        .select('id, slug, title, price, property_type, address, status, availability, images, locations(name)'),
      routeParam
    ).maybeSingle();

    if (error || !property || property.status !== 'approved') return fallback();

    // Prefer the canonical slug URL for og:url/canonical even if this
    // particular crawl came in on the old UUID link.
    const pageUrl = `${SITE_URL}/property/${encodeURIComponent(property.slug || property.id)}`;
    const locationName = property.locations?.name || property.address || 'Ogbomosho';
    const priceStr = formatPrice(property.price);
    const taken = property.availability === 'unavailable';
    const propertyType = property.property_type ? `${property.property_type} ` : '';
    const title = `${property.title || 'Property'} — Rentora`;
    const description = `${propertyType}near LAUTECH in ${locationName}${priceStr ? ` — ${priceStr}/year` : ''}${taken ? ' (Taken)' : ''}. View photos and details on Rentora.`;
    // Always point at the rendered card so the preview shows the property
    // photo + details with the Rentora Skyline Housing Solutions banner.
    // Pass the real id (not whatever the URL had) since og-image.mjs looks
    // this property up again itself.
    const image = cardImage(property.id);

    return renderPage(res, { pageUrl, title, description, image });
  } catch (err) {
    return fallback();
  }
}
