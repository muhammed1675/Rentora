// api/image-proxy.js — Vercel serverless function
//
// WHY THIS EXISTS
// property-images is a public Supabase Storage bucket, so every uploaded
// photo has a permanent, unauthenticated URL like:
//   https://<project>.supabase.co/storage/v1/object/public/property-images/<file>.webp
// Until now the app rendered that raw URL directly in every <img src>, so
// anyone who opened devtools, long-pressed an image, or grabbed a shared
// link preview could see and reshare the bare Supabase URL — exposing the
// project ref and handing out a link that works forever, completely outside
// the app.
//
// THE FIX
// The frontend now asks for property photos via THIS endpoint
// (/api/image-proxy?path=<filename>) instead of the Supabase URL directly.
// This function fetches the bytes from Storage with the service role key
// and streams them back under the rentora.com.ng domain — the Supabase
// project host never appears anywhere the browser shows: not in the DOM,
// not in the network tab, not in a copied/forwarded link.
//
// WHAT THIS IS NOT
// This does not make the bucket private — property-images stays public
// under the hood, so the raw Supabase URL would still work *if* someone
// already had it from before this change, or reconstructed it. This is
// link hygiene (hide the origin, refuse to serve files that aren't
// attached to a real listing), not revocable access control. If you later
// want a rejected/deleted property's photos to actually stop being
// servable, that needs the bucket switched to private + short-lived
// signed URLs — a separate, bigger change.
//
// Uses the service role key (server-side only, same pattern as the other
// functions in this folder) to look up the owning property before serving
// anything.

import { createClient } from '@supabase/supabase-js';

const BUCKET = 'property-images';

// Our uploader only ever writes `<uuid>.<ext>` into this bucket (see
// storageAPI.uploadImage in src/lib/api.js). Anything else — path
// separators, `..`, query-like junk — is not a file we created, so reject
// it before it's ever used to build a URL.
const SAFE_PATH = /^[A-Za-z0-9][A-Za-z0-9._-]{0,140}$/;

export default async function handler(req, res) {
  const path = (req.query.path || '').toString().trim();

  if (!path || path.includes('..') || !SAFE_PATH.test(path)) {
    res.status(400).send('Bad request');
    return;
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    res.status(500).send('Server misconfigured');
    return;
  }

  // Same shape getPublicUrl() has always produced — we build it ourselves
  // server-side so the browser never has to be told what it is.
  const upstreamUrl = `${supabaseUrl}/storage/v1/object/public/${BUCKET}/${path}`;

  try {
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Only serve files that actually belong to a real property listing.
    // This stops the endpoint being used to pull arbitrary/guessed
    // filenames out of the bucket even though the bucket itself is public.
    const { data: owner } = await supabase
      .from('properties')
      .select('id')
      .contains('images', [upstreamUrl])
      .limit(1)
      .maybeSingle();

    if (!owner) {
      res.status(404).send('Not found');
      return;
    }

    const upstream = await fetch(upstreamUrl, { signal: AbortSignal.timeout(8000) });
    if (!upstream.ok) {
      res.status(upstream.status === 404 ? 404 : 502).send('Not found');
      return;
    }

    const contentType = upstream.headers.get('content-type') || 'image/webp';
    const buffer = Buffer.from(await upstream.arrayBuffer());

    res.setHeader('Content-Type', contentType);
    // Long client/CDN cache: the filename is a random UUID and never
    // reused, so a cached copy is never stale.
    res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=604800, immutable');
    res.status(200).send(buffer);
  } catch {
    res.status(502).send('Upstream error');
  }
}
