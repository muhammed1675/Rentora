// api/og-image.js — Vercel Edge Function
//
// WHY THIS EXISTS
// api/og-property.js points every property's og:image at
// `${SITE_URL}/api/og-image?id=...` (see the `cardImage` helper there), but
// this file never existed — so that request 404'd and WhatsApp/Telegram/
// iMessage had no image to show. This is that missing file.
//
// It renders a single 1200x630 PNG: the property's own first photo, with the
// "RENTORA SKYLINE HOUSING SOLUTIONS" brand baked into the pixels (a tiled
// diagonal watermark, matching the on-site <ImageWatermark/> overlay) plus
// the title, price, and location along the bottom. Because the brand is
// drawn into the image itself (not a DOM overlay), it survives however the
// recipient saves or forwards it — long-pressing the WhatsApp preview,
// screenshotting, downloading, whatever.
//
// THINGS THAT WILL SILENTLY BREAK THIS IF YOU EDIT IT — all three bit us
// once already, verified by actually rendering this file locally with
// @vercel/og before shipping:
//   1. satori (what @vercel/og uses to render) supports a narrower set of
//      CSS values than a real browser. `justifyContent: 'space-evenly'` is
//      NOT supported (only center/flex-start/flex-end/space-between/
//      space-around) and throws — the very first version of this file used
//      it and every single render failed as a result, with no error visible
//      to any crawler. If you add flex styles here, they need testing.
//   2. The default font only ships at normal (400) weight. `fontWeight: 700`
//      without also passing a `fonts: [...]` option to ImageResponse throws.
//      Use size/letterSpacing for emphasis instead.
//   3. The default font's glyph set doesn't cover ₦ — Intl.NumberFormat's
//      NGN currency symbol renders as a missing-glyph box. Prices here are
//      formatted as plain "NGN 1,234" text, not the ₦ symbol.
//   4. React.Fragment silently drops its children in satori — don't wrap an
//      element in <>...</> (or React.createElement(React.Fragment, ...)) just
//      to attach a `key` for a children array; set the key directly on the
//      real element instead.
//   5. On any render failure we return real fallback IMAGE BYTES with a 200,
//      never a redirect — WhatsApp's crawler does not reliably follow
//      redirects on og:image URLs.
//
// Runs on the Edge runtime (required by @vercel/og's ImageResponse), so it
// takes a Web Request and returns a Web Response — different shape from the
// Node-style (req, res) functions elsewhere in this folder.

import { ImageResponse } from '@vercel/og';
import { createClient } from '@supabase/supabase-js';
import React from 'react';

export const config = { runtime: 'edge' };

const SITE_URL = 'https://www.rentora.com.ng';
const FALLBACK_IMAGE = `${SITE_URL}/rentora-og.png`;
const BRAND = 'RENTORA';
const IMAGE_HEADERS = {
  'Content-Type': 'image/png',
  'Cache-Control': 'public, max-age=300, s-maxage=900, stale-while-revalidate=86400',
};

// Deliberately NOT Intl.NumberFormat(..., { style: 'currency', currency: 'NGN' })
// — that produces the ₦ glyph, which the renderer can't draw. See note (3).
function formatPrice(price) {
  const n = Number(price || 0);
  if (!Number.isFinite(n) || n <= 0) return '';
  return `NGN ${n.toLocaleString('en-NG')}`;
}

// Real 200 + image bytes, never a redirect — see note (4) above.
async function servePngFallback() {
  try {
    const res = await fetch(FALLBACK_IMAGE, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error(`fallback fetch ${res.status}`);
    const bytes = await res.arrayBuffer();
    return new Response(bytes, { status: 200, headers: IMAGE_HEADERS });
  } catch {
    // Last resort: a plain solid-colour PNG built with ImageResponse itself,
    // no external fetch involved, so this branch basically cannot fail.
    return new ImageResponse(
      React.createElement(
        'div',
        {
          style: {
            display: 'flex',
            width: '1200px',
            height: '630px',
            backgroundColor: '#1d4ed8',
            color: '#ffffff',
            fontSize: 48,
            letterSpacing: 6,
            alignItems: 'center',
            justifyContent: 'center',
          },
        },
        'RENTORA'
      ),
      { width: 1200, height: 630, headers: IMAGE_HEADERS }
    );
  }
}

// Tiled diagonal watermark, sized to fully bleed past all four edges of the
// 1200x630 frame regardless of the -22deg rotation.
function buildWatermark() {
  const row = (key, offset) =>
    React.createElement(
      'div',
      { key, style: { display: 'flex', gap: 90, marginLeft: offset } },
      Array.from({ length: 5 }).map((_, i) =>
        React.createElement(
          'span',
          { key: i, style: { display: 'flex', color: '#ffffff', fontSize: 30, letterSpacing: 8, whiteSpace: 'nowrap' } },
          BRAND
        )
      )
    );

  const layer = React.createElement(
    'div',
    {
      style: {
        position: 'absolute',
        top: -150,
        left: -300,
        display: 'flex',
        flexDirection: 'column',
        gap: 60,
        transform: 'rotate(-22deg)',
      },
    },
    Array.from({ length: 10 }).map((_, i) => row(i, i % 2 === 0 ? 0 : 160))
  );

  return React.createElement(
    'div',
    { key: 'watermark', style: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', opacity: 0.14, overflow: 'hidden' } },
    layer
  );
}

function buildCard({ title, meta, photo, taken }) {
  const children = [
    // Background photo (or a plain brand-navy background if we have none).
    photo
      ? React.createElement('img', {
          key: 'bg',
          src: photo,
          width: 1200,
          height: 630,
          style: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '1200px', height: '630px', objectFit: 'cover' },
        })
      : React.createElement('div', {
          key: 'bg',
          style: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', backgroundColor: '#0f172a' },
        }),
    // Darken for legibility.
    React.createElement('div', {
      key: 'scrim',
      style: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: 'flex',
        background: 'linear-gradient(180deg, rgba(2,6,23,0.15) 0%, rgba(2,6,23,0.15) 40%, rgba(2,6,23,0.92) 100%)',
      },
    }),
    // Tiled brand watermark baked into the pixels.
    // (Not wrapped in React.Fragment — satori silently drops Fragment-wrapped
    // children, which is why this layer disappeared during testing. The key
    // is set directly on the div inside buildWatermark() instead.)
    buildWatermark(),
    // Top brand strip.
    React.createElement(
      'div',
      {
        key: 'topbar',
        style: {
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          display: 'flex',
          alignItems: 'center',
          padding: '28px 40px',
          background: 'rgba(2,6,23,0.55)',
        },
      },
      React.createElement('span', { style: { display: 'flex', color: '#ffffff', fontSize: 26, letterSpacing: 4 } }, 'RENTORA'),
      React.createElement(
        'span',
        { style: { display: 'flex', color: 'rgba(255,255,255,0.75)', fontSize: 16, letterSpacing: 2, marginLeft: 16 } },
        'SKYLINE HOUSING SOLUTIONS'
      )
    ),
    // Bottom text block: title, meta line, optional TAKEN badge.
    React.createElement(
      'div',
      {
        key: 'bottom',
        style: {
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          display: 'flex',
          flexDirection: 'column',
          padding: '0 44px 40px 44px',
        },
      },
      taken
        ? React.createElement(
            'div',
            {
              style: {
                display: 'flex',
                alignSelf: 'flex-start',
                background: '#ef4444',
                color: '#ffffff',
                fontSize: 16,
                letterSpacing: 2,
                padding: '5px 14px',
                borderRadius: 999,
                marginBottom: 14,
              },
            },
            'TAKEN'
          )
        : null,
      React.createElement(
        'span',
        { style: { display: 'flex', color: '#ffffff', fontSize: 46, letterSpacing: 0.5, lineHeight: 1.15, maxWidth: '1050px' } },
        title.length > 62 ? `${title.slice(0, 62)}…` : title
      ),
      React.createElement(
        'span',
        { style: { display: 'flex', color: 'rgba(255,255,255,0.85)', fontSize: 24, marginTop: 10 } },
        meta
      )
    ),
  ];

  return React.createElement('div', { style: { display: 'flex', width: '1200px', height: '630px', position: 'relative' } }, children);
}

export default async function handler(req) {
  let id = '';
  try {
    const { searchParams } = new URL(req.url);
    id = (searchParams.get('id') || '').toString().trim();
  } catch {
    return servePngFallback();
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  let title = 'Rentora';
  let meta = 'Student Hostels & Accommodation Near LAUTECH Ogbomosho';
  let photo = null;
  let taken = false;

  if (id && supabaseUrl && serviceRoleKey) {
    try {
      const supabase = createClient(supabaseUrl, serviceRoleKey);
      const { data: property } = await supabase
        .from('properties')
        .select('title, price, property_type, address, status, availability, images, locations(name)')
        .eq('id', id)
        .maybeSingle();

      if (property && property.status === 'approved') {
        const locationName = property.locations?.name || property.address || 'Ogbomosho';
        const priceStr = formatPrice(property.price);
        const propertyType = property.property_type ? `${property.property_type} · ` : '';
        title = property.title || 'Property';
        meta = `${propertyType}${locationName}${priceStr ? ` · ${priceStr}/year` : ''}`;
        taken = property.availability === 'unavailable';
        if (property.images?.[0]) photo = property.images[0];
      }
    } catch {
      // Fall through with the generic Rentora title/meta set above.
    }
  }

  try {
    return new ImageResponse(buildCard({ title, meta, photo, taken }), {
      width: 1200,
      height: 630,
      headers: IMAGE_HEADERS,
    });
  } catch {
    // Rendering failed (bad/unreachable photo URL, satori quirk, etc). Try
    // again without the photo — a branded card with no picture beats no
    // image at all.
    try {
      return new ImageResponse(buildCard({ title, meta, photo: null, taken }), {
        width: 1200,
        height: 630,
        headers: IMAGE_HEADERS,
      });
    } catch {
      return servePngFallback();
    }
  }
}