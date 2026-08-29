// src/lib/images.js
//
// Property photos are stored in the DB as full public Supabase Storage
// URLs (https://<project>.supabase.co/storage/v1/object/public/property-images/<file>).
// This helper rewrites that into a same-origin proxy URL
// (/api/image-proxy?path=<file>, see api/image-proxy.js) so the raw
// Supabase project URL never appears in the rendered page, a saved
// image, or a shared link.
//
// Anything that isn't a property-images storage URL (the Pexels fallback
// placeholder, a blob: preview during upload, an already-relative path,
// etc.) is returned unchanged — this is a targeted rewrite, not a general
// image loader.

const MARKER = '/property-images/';

export function propertyImageSrc(url) {
  if (!url || typeof url !== 'string') return url;

  const idx = url.indexOf(MARKER);
  if (idx === -1) return url;

  const path = url.slice(idx + MARKER.length).split(/[?#]/)[0];
  if (!path || !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(path)) return url;

  return `/api/image-proxy?path=${encodeURIComponent(path)}`;
}

// Convenience for mapping a whole images array at once.
export function propertyImageSrcs(urls) {
  return Array.isArray(urls) ? urls.map(propertyImageSrc) : urls;
}
