// api/og-image.js — Vercel Edge function
//
// Renders the 1200x630 link-preview card for a single property:
//   - the property's own photo fills the card
//   - a brand band across the TOP: "RENTORA SKYLINE HOUSING SOLUTIONS"
//   - the property title, price and location across the bottom
//
// og-property.js points og:image / twitter:image at this URL, so WhatsApp,
// Facebook, X, Telegram etc. show the property instead of the plain logo.
//
// Requires: yarn add @vercel/og   (or npm i @vercel/og)

import { ImageResponse } from '@vercel/og';

export const config = { runtime: 'edge' };

const SITE_URL = 'https://www.rentora.com.ng';
const BRAND = 'RENTORA SKYLINE HOUSING SOLUTIONS';
const FALLBACK_IMAGE = `${SITE_URL}/rentora-og.png`;

function formatPrice(price) {
  const n = Number(price || 0);
  if (!Number.isFinite(n) || n <= 0) return '';
  // "NGN 100,000" rather than the naira sign: the OG renderer's font
  // fallback can't always resolve the ₦ glyph and the render then fails.
  return `NGN ${new Intl.NumberFormat('en-NG', { maximumFractionDigits: 0 }).format(n)}`;
}

async function fetchProperty(id) {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!id || !supabaseUrl || !key) return null;

  // Plain REST call — the edge runtime doesn't need the JS client here.
  const url =
    `${supabaseUrl}/rest/v1/properties` +
    `?id=eq.${encodeURIComponent(id)}` +
    `&select=title,price,property_type,address,status,availability,images,locations(name)` +
    `&limit=1`;

  try {
    const res = await fetch(url, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    if (!res.ok) return null;
    const rows = await res.json();
    const property = Array.isArray(rows) ? rows[0] : null;
    if (!property || property.status !== 'approved') return null;
    return property;
  } catch {
    return null;
  }
}

export default async function handler(req) {
  const { searchParams } = new URL(req.url);
  const id = (searchParams.get('id') || '').trim();
  const property = await fetchProperty(id);

  const image = (property?.images && property.images[0]) || FALLBACK_IMAGE;
  const title = property?.title || 'Rentora';
  const location = property?.locations?.name || property?.address || 'Ogbomosho';
  const priceStr = formatPrice(property?.price);
  const type = property?.property_type || '';
  const taken = property?.availability === 'unavailable';

  return new ImageResponse(
    (
      <div
        style={{
          width: '1200px',
          height: '630px',
          display: 'flex',
          position: 'relative',
          backgroundColor: '#0b1220',
        }}
      >
        {/* Property photo */}
        <img
          src={image}
          width={1200}
          height={630}
          style={{ width: '1200px', height: '630px', objectFit: 'cover' }}
        />

        {/* Brand band on top of the image */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '1200px',
            height: '108px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(29, 78, 216, 0.94)',
          }}
        >
          <div
            style={{
              display: 'flex',
              color: '#ffffff',
              fontSize: 44,
              fontWeight: 700,
              letterSpacing: '2px',
              textAlign: 'center',
            }}
          >
            {BRAND}
          </div>
        </div>

        {/* Details at the bottom */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            width: '1200px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            padding: '40px 56px',
            backgroundColor: 'rgba(3, 7, 18, 0.72)',
          }}
        >
          <div style={{ display: 'flex', color: '#ffffff', fontSize: 56, fontWeight: 700 }}>
            {title.length > 46 ? `${title.slice(0, 46)}…` : title}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
            {priceStr ? (
              <div style={{ display: 'flex', color: '#fbbf24', fontSize: 40, fontWeight: 700 }}>
                {priceStr}/year
              </div>
            ) : null}
            <div style={{ display: 'flex', color: '#e5e7eb', fontSize: 34 }}>
              {[type, location].filter(Boolean).join(' • ')}
            </div>
            {taken ? (
              <div
                style={{
                  display: 'flex',
                  color: '#ffffff',
                  fontSize: 28,
                  fontWeight: 700,
                  padding: '6px 18px',
                  borderRadius: '999px',
                  backgroundColor: '#dc2626',
                }}
              >
                TAKEN
              </div>
            ) : null}
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: {
        'Cache-Control': 'public, max-age=300, s-maxage=900, stale-while-revalidate=86400',
      },
    }
  );
}
