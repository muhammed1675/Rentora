// GET /api/resolve-map-link?url=https://maps.app.goo.gl/xxxx
//
// Google Maps share sheets only ever give a short link (maps.app.goo.gl / goo.gl/maps),
// which cannot be embedded in an iframe. But the short link is just a redirect:
// following it server-side lands on a long URL that contains the real lat/lng.
// The browser can't do this itself (CORS), so we do it here and return coordinates.

const ALLOWED_HOSTS = new Set([
  'maps.app.goo.gl',
  'goo.gl',
  'maps.google.com',
  'www.google.com',
  'google.com',
]);

const PATTERNS = [
  /@(-?\d+\.\d+),(-?\d+\.\d+)/,
  /[?&]q=(-?\d+\.\d+),\s*(-?\d+\.\d+)/,
  /[?&]ll=(-?\d+\.\d+),\s*(-?\d+\.\d+)/,
  /[?&]center=(-?\d+\.\d+),\s*(-?\d+\.\d+)/,
  /[?&]destination=(-?\d+\.\d+),\s*(-?\d+\.\d+)/,
  /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/,
];

function extract(text) {
  if (!text) return null;
  for (const re of PATTERNS) {
    const m = text.match(re);
    if (m) {
      const lat = Number(m[1]);
      const lng = Number(m[2]);
      if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) return { lat, lng };
    }
  }
  return null;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const raw = req.query?.url;
  if (!raw || typeof raw !== 'string' || raw.length > 2048) {
    return res.status(400).json({ error: 'Missing or invalid url parameter' });
  }

  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    return res.status(400).json({ error: 'Not a valid URL' });
  }
  // SSRF guard: only ever follow Google Maps hosts.
  if (parsed.protocol !== 'https:' || !ALLOWED_HOSTS.has(parsed.hostname)) {
    return res.status(400).json({ error: 'Only Google Maps links are supported' });
  }

  // Already a long link? No network call needed.
  const direct = extract(raw);
  if (direct) {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    return res.status(200).json({ ...direct, source: 'url' });
  }

  try {
    let current = parsed.toString();
    let found = null;

    // Follow up to 5 redirects manually so we can read each Location header.
    for (let i = 0; i < 5; i++) {
      const r = await fetch(current, {
        method: 'GET',
        redirect: 'manual',
        headers: {
          // Google returns the consent/JS page to unknown agents.
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36',
          'Accept-Language': 'en',
        },
      });

      const next = r.headers.get('location');
      if (next) {
        current = new URL(next, current).toString();
        found = extract(current);
        if (found) break;
        continue;
      }

      // Final response — coordinates may be in the URL or the HTML payload.
      found = extract(current) || extract((await r.text()).slice(0, 200000));
      break;
    }

    if (!found) {
      // Place-style share links (…/maps?q=Business+Name,+Street) carry no
      // lat/lng — hand the text query back so the client can still embed it.
      const q = /[?&]q=([^&]+)/.exec(current);
      if (q) {
        const query = decodeURIComponent(q[1].replace(/\+/g, ' '));
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        return res.status(200).json({ query, source: 'redirect-query' });
      }
      return res.status(422).json({ error: 'Could not resolve coordinates from this link' });
    }

    // Coordinates for a share link never change, so cache hard at the edge.
    res.setHeader('Cache-Control', 'public, max-age=31536000, s-maxage=31536000, immutable');
    return res.status(200).json({ ...found, source: 'redirect' });
  } catch (err) {
    console.error('[resolve-map-link] failed:', err?.message || err);
    return res.status(502).json({ error: 'Failed to resolve link' });
  }
}
