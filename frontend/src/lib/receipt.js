// Generates a simple, clean PNG receipt entirely client-side and triggers
// a download. Used for token purchases, viewing payments, and rent
// payments wherever a "Download Receipt" button appears.

const NAVY = '#1B3A6B';
const GOLD = '#2E75B6';
const GREY = '#6B7280';

function wrapText(ctx, text, maxWidth) {
  const words = String(text).split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * @param {Object} opts
 * @param {string} opts.title - e.g. "Rent Payment Receipt"
 * @param {string} [opts.reference]
 * @param {string} [opts.date] - already formatted, e.g. "12 Jul 2026"
 * @param {string} [opts.status] - e.g. "Completed", "Held", "Released"
 * @param {{label:string, value:string}[]} [opts.rows] - line items
 * @param {{label:string, value:string}} [opts.total] - the big bold total
 * @param {string} [opts.footer]
 * @param {string} [opts.filename]
 */
export async function downloadReceiptPNG({
  title = 'Payment Receipt',
  reference,
  date,
  status = 'Completed',
  rows = [],
  total,
  footer = 'Rentora — Student Housing Platform, Ogbomosho, Oyo State, Nigeria. rentora.com.ng',
  filename = 'rentora-receipt.png',
}) {
  const W = 640;
  const rowHeight = 34;
  const headerHeight = 150;
  const totalHeight = total ? 90 : 20;
  const footerHeight = 70;
  const bodyHeight = rows.length * rowHeight + 40;
  const H = headerHeight + bodyHeight + totalHeight + footerHeight;

  const dpr = window.devicePixelRatio || 1;
  const canvas = document.createElement('canvas');
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  // Background + border
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = '#E5E7EB';
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, W - 1, H - 1);

  let y = 40;

  // Brand
  ctx.fillStyle = NAVY;
  ctx.font = 'bold 26px Arial, sans-serif';
  ctx.fillText('RENTORA', 32, y);
  ctx.fillStyle = GREY;
  ctx.font = '12px Arial, sans-serif';
  ctx.fillText('Verified Student Housing', 32, y + 18);

  // Status pill
  ctx.font = 'bold 12px Arial, sans-serif';
  const statusText = status.toUpperCase();
  const pillW = ctx.measureText(statusText).width + 24;
  const isPendingLike = /pend|held/i.test(status);
  ctx.fillStyle = isPendingLike ? '#FEF3C7' : '#DCFCE7';
  const pillX = W - 32 - pillW;
  ctx.fillRect(pillX, y - 20, pillW, 26);
  ctx.fillStyle = isPendingLike ? '#92400E' : '#166534';
  ctx.fillText(statusText, pillX + 12, y - 2);

  y += 46;
  ctx.strokeStyle = '#E5E7EB';
  ctx.beginPath(); ctx.moveTo(32, y); ctx.lineTo(W - 32, y); ctx.stroke();
  y += 34;

  ctx.fillStyle = '#111827';
  ctx.font = 'bold 18px Arial, sans-serif';
  ctx.fillText(title, 32, y);
  y += 28;

  ctx.font = '12px Arial, sans-serif';
  ctx.fillStyle = GREY;
  if (reference) { ctx.fillText(`Reference: ${reference}`, 32, y); y += 18; }
  if (date) { ctx.fillText(`Date: ${date}`, 32, y); y += 18; }
  y += 12;

  for (const row of rows) {
    ctx.font = '14px Arial, sans-serif';
    ctx.fillStyle = GREY;
    ctx.fillText(row.label, 32, y);
    ctx.font = 'bold 14px Arial, sans-serif';
    ctx.fillStyle = '#111827';
    const valText = String(row.value);
    const valWidth = ctx.measureText(valText).width;
    ctx.fillText(valText, W - 32 - valWidth, y);
    y += rowHeight;
  }

  y += 10;
  ctx.strokeStyle = '#E5E7EB';
  ctx.beginPath(); ctx.moveTo(32, y); ctx.lineTo(W - 32, y); ctx.stroke();
  y += 40;

  if (total) {
    ctx.fillStyle = GREY;
    ctx.font = '13px Arial, sans-serif';
    ctx.fillText(total.label, 32, y);
    ctx.fillStyle = GOLD;
    ctx.font = 'bold 26px Arial, sans-serif';
    const totalText = String(total.value);
    const totalWidth = ctx.measureText(totalText).width;
    ctx.fillText(totalText, W - 32 - totalWidth, y + 4);
    y += 50;
  }

  ctx.strokeStyle = '#E5E7EB';
  ctx.beginPath(); ctx.moveTo(32, y); ctx.lineTo(W - 32, y); ctx.stroke();
  y += 26;

  ctx.font = '11px Arial, sans-serif';
  ctx.fillStyle = GREY;
  for (const line of wrapText(ctx, footer, W - 64)) {
    ctx.fillText(line, 32, y);
    y += 16;
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) { reject(new Error('Could not generate receipt image')); return; }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      resolve();
    }, 'image/png');
  });
}