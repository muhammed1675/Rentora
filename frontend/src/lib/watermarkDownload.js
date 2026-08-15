// Bakes the Rentora brand into a photo's actual pixels, then triggers a
// download of that composited PNG.
//
// WHY THIS EXISTS
// <ImageWatermark/> draws "RENTORA SKYLINE HOUSING SOLUTIONS" as a DOM
// overlay on top of the <img> — it looks branded on the site, but it is NOT
// part of the image file. Anyone who long-presses/right-clicks and saves the
// photo directly gets the clean, unbranded original. This draws the same
// image onto a <canvas>, stamps the brand into the pixels, and downloads
// THAT file instead, so the brand travels with the photo wherever it's
// shared next.
//
// Requires the image host to serve permissive CORS headers (Supabase Storage
// public buckets do by default) — a canvas can't read pixels from an opaque
// cross-origin image otherwise. If that fails, the caller gets `false` back
// and can fall back to opening the plain image.

const BRAND = 'RENTORA SKYLINE HOUSING SOLUTIONS';

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image load failed'));
    img.src = src;
  });
}

export async function downloadWatermarkedImage(imageUrl, fileNamePrefix = 'rentora-property') {
  if (!imageUrl) return false;

  let img;
  try {
    img = await loadImage(imageUrl);
  } catch {
    return false;
  }

  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth || img.width;
  canvas.height = img.naturalHeight || img.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return false;

  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  // Repeated diagonal watermark, echoing the on-site overlay.
  try {
    ctx.save();
    ctx.globalAlpha = 0.2;
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth = Math.max(2, canvas.width * 0.0018);
    const fontSize = Math.max(16, Math.round(canvas.width * 0.026));
    ctx.font = `700 ${fontSize}px Arial, sans-serif`;
    ctx.textBaseline = 'middle';
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate(-Math.PI / 9);
    const textWidth = ctx.measureText(BRAND).width;
    const stepX = textWidth + fontSize * 3;
    const stepY = fontSize * 4;
    const span = Math.max(canvas.width, canvas.height) * 1.2;
    for (let y = -span; y < span; y += stepY) {
      for (let x = -span; x < span; x += stepX) {
        ctx.strokeText(BRAND, x, y);
        ctx.fillText(BRAND, x, y);
      }
    }
    ctx.restore();
  } catch {
    // Non-fatal — fall through and still stamp the bottom strip below.
  }

  // Solid brand strip along the bottom so it reads even at a thumbnail size.
  const stripHeight = Math.max(32, Math.round(canvas.height * 0.055));
  ctx.fillStyle = 'rgba(2,6,23,0.62)';
  ctx.fillRect(0, canvas.height - stripHeight, canvas.width, stripHeight);
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.font = `700 ${Math.round(stripHeight * 0.38)}px Arial, sans-serif`;
  ctx.fillText('RENTORA  ·  rentora.com.ng', stripHeight * 0.45, canvas.height - stripHeight / 2);

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png', 0.95));
  if (!blob) return false;

  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${fileNamePrefix}.png`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 5000);
  return true;
}
