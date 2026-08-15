// api/og-image.js — Vercel Edge Function
//
// WHY THIS EXISTS
// api/og-property.js points every property's og:image at
// `${SITE_URL}/api/og-image?id=...` (see the `cardImage` helper there), but
// this file never existed — so that request 404'd, WhatsApp/Telegram/iMessage
// had no image to show, and the "generic Rentora logo" fallback wasn't even
// reached because the URL itself was broken. This is that missing file.
//
// It renders a single 1200x630 PNG: the property's own first photo, with the
// "RENTORA SKYLINE HOUSING SOLUTIONS" brand baked into the pixels (a repeated
// watermark, matching the on-site <ImageWatermark/> overlay) plus the title,
// price, and location along the bottom. Because the brand is drawn into the
// image itself (not a DOM overlay), it survives however the recipient saves
// or forwards it — long-pressing the WhatsApp preview, screenshotting,
// downloading, whatever.
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
const BRAND = 'RENTORA SKYLINE HOUSING SOLUTIONS';

function formatPrice(price) {
  const n = Number(price || 0);
  if (!Number.isFinite(n) || n <= 0) return '';
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 0 }).format(n);
}

export default async function handler(req) {
  const { searchParams } = new URL(req.url);
  const id = (searchParams.get('id') || '').toString().trim();

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
    } catch (err) {
      // Fall through to the generic fallback card below.
    }
  }

  const watermarkRow = (key) =>
    React.createElement(
      'div',
      {
        key,
        style: {
          display: 'flex',
          width: '1500px',
          justifyContent: 'space-between',
          transform: 'rotate(-28deg)',
          opacity: 0.16,
        },
      },
      Array.from({ length: 4 }).map((_, i) =>
        React.createElement(
          'span',
          {
            key: i,
            style: {
              color: '#ffffff',
              fontSize: 26,
              fontWeight: 700,
              letterSpacing: 6,
              whiteSpace: 'nowrap',
            },
          },
          BRAND
        )
      )
    );

  const watermarkLayer = React.createElement(
    'div',
    {
      style: {
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-evenly',
        alignItems: 'center',
      },
    },
    Array.from({ length: 6 }).map((_, i) => watermarkRow(i))
  );

  const children = [
    // Background photo (or a plain brand-navy background if we have none).
    photo
      ? React.createElement('img', {
          key: 'bg',
          src: photo,
          width: 1200,
          height: 630,
          style: { position: 'absolute', inset: 0, width: '1200px', height: '630px', objectFit: 'cover' },
        })
      : React.createElement('div', {
          key: 'bg',
          style: { position: 'absolute', inset: 0, width: '1200px', height: '630px', backgroundColor: '#0f172a' },
        }),
    // Darken for legibility.
    React.createElement('div', {
      key: 'scrim',
      style: {
        position: 'absolute',
        inset: 0,
        display: 'flex',
        background: 'linear-gradient(180deg, rgba(2,6,23,0.15) 0%, rgba(2,6,23,0.15) 40%, rgba(2,6,23,0.92) 100%)',
      },
    }),
    // Repeated diagonal brand watermark baked into the pixels.
    React.cloneElement(watermarkLayer, { key: 'watermark' }),
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
      React.createElement(
        'span',
        {
          style: {
            color: '#ffffff',
            fontSize: 24,
            fontWeight: 700,
            letterSpacing: 4,
          },
        },
        'RENTORA'
      ),
      React.createElement(
        'span',
        {
          style: {
            color: 'rgba(255,255,255,0.75)',
            fontSize: 16,
            letterSpacing: 2,
            marginLeft: 16,
          },
        },
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
                fontWeight: 700,
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
        {
          style: {
            display: 'flex',
            color: '#ffffff',
            fontSize: 44,
            fontWeight: 700,
            lineHeight: 1.15,
            maxWidth: '1050px',
          },
        },
        title.length > 62 ? `${title.slice(0, 62)}…` : title
      ),
      React.createElement(
        'span',
        {
          style: {
            display: 'flex',
            color: 'rgba(255,255,255,0.85)',
            fontSize: 24,
            marginTop: 10,
          },
        },
        meta
      )
    ),
  ];

  try {
    return new ImageResponse(React.createElement('div', { style: { display: 'flex', width: '1200px', height: '630px', position: 'relative' } }, children), {
      width: 1200,
      height: 630,
      headers: {
        'Cache-Control': 'public, max-age=300, s-maxage=900, stale-while-revalidate=86400',
      },
    });
  } catch (err) {
    // If satori/rendering fails for any reason (bad photo URL, etc.), don't
    // 500 the WhatsApp crawler — redirect it to the static fallback image so
    // the preview still shows *something* branded.
    return Response.redirect(FALLBACK_IMAGE, 302);
  }
}
