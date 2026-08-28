// Generates a real, multi-page PDF file for the admin "user report" and
// triggers a download — no window.print(), no browser print dialog.
// Built with jsPDF (add `jspdf` to package.json / npm install).
import { jsPDF } from 'jspdf';

const NGN = (n) => `NGN ${Number(n || 0).toLocaleString()}`;
const fmtDate = (d) => (d ? new Date(d).toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' }) : '—');

function makeLayout(doc) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const marginX = 40;
  let y = 40;

  const ensureSpace = (needed) => {
    if (y + needed > pageH - 50) {
      doc.addPage();
      y = 40;
    }
  };

  const heading = (text) => {
    ensureSpace(28);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(27, 58, 107); // navy, matches Rentora receipts
    doc.text(text, marginX, y);
    y += 6;
    doc.setDrawColor(27, 58, 107);
    doc.setLineWidth(0.75);
    doc.line(marginX, y, pageW - marginX, y);
    y += 16;
    doc.setTextColor(20, 20, 20);
  };

  const kvRow = (label, value) => {
    ensureSpace(16);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(90, 90, 90);
    doc.text(label, marginX, y);
    doc.setTextColor(20, 20, 20);
    doc.setFont('helvetica', 'bold');
    doc.text(String(value ?? '—'), marginX + 140, y);
    y += 15;
  };

  const paragraph = (text, opts = {}) => {
    const size = opts.size || 9;
    doc.setFont('helvetica', opts.bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    doc.setTextColor(...(opts.color || [20, 20, 20]));
    const lines = doc.splitTextToSize(text, pageW - marginX * 2);
    ensureSpace(lines.length * (size * 1.15) + 4);
    doc.text(lines, marginX, y);
    y += lines.length * (size * 1.15) + 4;
  };

  const tableHeaderRow = (cols) => {
    ensureSpace(20);
    doc.setFillColor(243, 244, 246);
    doc.rect(marginX, y - 10, pageW - marginX * 2, 18, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(70, 70, 70);
    let x = marginX + 4;
    cols.forEach((c) => {
      doc.text(c.label.toUpperCase(), x, y + 2);
      x += c.width;
    });
    y += 16;
    doc.setTextColor(20, 20, 20);
  };

  const tableRow = (cols, rowValues, alt) => {
    const cellLines = cols.map((c, i) => doc.splitTextToSize(String(rowValues[i] ?? '—'), c.width - 6));
    const rowHeight = Math.max(...cellLines.map((l) => l.length)) * 10 + 6;
    ensureSpace(rowHeight);
    if (alt) {
      doc.setFillColor(250, 250, 251);
      doc.rect(marginX, y - 9, pageW - marginX * 2, rowHeight, 'F');
    }
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    let x = marginX + 4;
    cols.forEach((c, i) => {
      doc.text(cellLines[i], x, y);
      x += c.width;
    });
    y += rowHeight;
  };

  const table = (title, cols, rows, emptyText = 'No records found.') => {
    heading(title);
    if (!rows || rows.length === 0) {
      paragraph(emptyText, { color: [130, 130, 130] });
      y += 6;
      return;
    }
    tableHeaderRow(cols);
    rows.forEach((r, i) => tableRow(cols, r, i % 2 === 1));
    y += 10;
  };

  const spacer = (h = 8) => { y += h; };

  return { doc, get y() { return y; }, set y(v) { y = v; }, marginX, pageW, pageH, ensureSpace, heading, kvRow, paragraph, table, spacer };
}

export function downloadUserReportPdf(report) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const L = makeLayout(doc);
  const acc = report.account || {};

  // ── Header ──
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(27, 58, 107);
  doc.text('Rentora Account Activity Report', L.marginX, L.y);
  L.y += 18;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(110, 110, 110);
  doc.text(`Generated: ${fmtDate(report.generated_at)}`, L.marginX, L.y);
  L.y += 20;
  doc.setTextColor(20, 20, 20);

  L.heading(acc.full_name || 'Unnamed user');
  L.kvRow('User ID', acc.id);
  L.kvRow('Email', acc.email);
  L.kvRow('Phone', acc.phone || 'Not recorded');
  L.kvRow('Role', acc.role);
  L.kvRow('Status', acc.suspended ? 'Suspended' : 'Active');
  L.kvRow('Joined', fmtDate(acc.joined_at));
  L.kvRow('Last login', fmtDate(acc.last_login_at));
  L.spacer(10);

  // ── Rent payments (escrow) ──
  L.table('Rent Payments (Escrow)',
    [{ label: 'Date', width: 70 }, { label: 'Property', width: 130 }, { label: 'Agent', width: 90 }, { label: 'Amount', width: 90 }, { label: 'Status', width: 70 }],
    (report.rent_payments || []).map((p) => [
      fmtDate(p.created_at), p.property?.title || '—', p.agent?.full_name || '—', NGN(p.total_amount), p.status,
    ])
  );

  // ── Viewing / inspection payments ──
  L.table('Viewing / Inspection Payments',
    [{ label: 'Date', width: 70 }, { label: 'Property', width: 140 }, { label: 'Agent', width: 100 }, { label: 'Amount', width: 80 }, { label: 'Status', width: 60 }],
    (report.viewing_payments || []).map((v) => [
      fmtDate(v.created_at), v.property_title || '—', v.agent_name || '—', NGN(v.amount), v.status,
    ])
  );

  // ── Tips given ──
  L.table('Agent Tips Sent',
    [{ label: 'Date', width: 90 }, { label: 'Agent', width: 150 }, { label: 'Amount', width: 100 }, { label: 'Status', width: 100 }],
    (report.tips_given || []).map((t) => [fmtDate(t.created_at), t.agent?.full_name || '—', NGN(t.amount), t.status])
  );

  // ── Wallet / token transactions ──
  L.table('Wallet / Token Transactions',
    [{ label: 'Date', width: 100 }, { label: 'Reference', width: 150 }, { label: 'Amount', width: 90 }, { label: 'Status', width: 100 }],
    (report.token_transactions || []).map((t) => [fmtDate(t.created_at), t.reference || '—', NGN(t.amount), t.status])
  );

  // ── Property unlocks ──
  L.table('Properties Unlocked',
    [{ label: 'Date', width: 120 }, { label: 'Property', width: 300 }],
    (report.property_unlocks || []).map((u) => [fmtDate(u.unlocked_at), u.property?.title || '—'])
  );

  // ── Reports filed ──
  L.table('Reports Filed by This User',
    [{ label: 'Date', width: 90 }, { label: 'Property', width: 130 }, { label: 'Reason', width: 130 }, { label: 'Status', width: 70 }],
    (report.reports_filed || []).map((r) => [fmtDate(r.created_at), r.property_title || '—', r.reason || '—', r.status])
  );

  // ── Agent-side sections (only meaningful if this account is an agent) ──
  const isAgentish = (report.properties_listed?.length || 0) > 0 || (report.rent_payments_received?.length || 0) > 0 || acc.role === 'agent';
  if (isAgentish) {
    L.table('Properties Listed (as Agent)',
      [{ label: 'Title', width: 160 }, { label: 'Location', width: 130 }, { label: 'Status', width: 70 }, { label: 'Availability', width: 80 }],
      (report.properties_listed || []).map((p) => [p.title, p.location_text || '—', p.status, p.availability])
    );

    L.table('Rent Payments Received (as Agent)',
      [{ label: 'Date', width: 70 }, { label: 'Tenant', width: 110 }, { label: 'Property', width: 110 }, { label: 'Agent fee', width: 80 }, { label: 'Status', width: 60 }],
      (report.rent_payments_received || []).map((p) => [
        fmtDate(p.created_at), p.tenant?.full_name || '—', p.property?.title || '—', NGN(p.agent_fee), p.status,
      ])
    );

    L.table('Tips Received (as Agent)',
      [{ label: 'Date', width: 100 }, { label: 'From', width: 150 }, { label: 'Amount', width: 100 }, { label: 'Status', width: 90 }],
      (report.tips_received || []).map((t) => [fmtDate(t.created_at), t.tenant?.full_name || '—', NGN(t.amount), t.status])
    );

    const earn = report.agent_earnings || {};
    L.heading('Agent Earnings Summary');
    L.kvRow('Total earned', NGN(earn.total_earned));
    L.kvRow('Total withdrawn', NGN(earn.total_withdrawn));
    L.kvRow('Current balance', NGN(earn.balance));
    L.spacer(10);

    L.table('Withdrawal Requests',
      [{ label: 'Date', width: 90 }, { label: 'Amount', width: 80 }, { label: 'Bank', width: 110 }, { label: 'Account', width: 100 }, { label: 'Status', width: 70 }],
      (report.withdrawals || []).map((w) => [fmtDate(w.requested_at), NGN(w.amount), w.bank_name || '—', w.account_number || '—', w.status])
    );
  }

  // ── Ads ──
  L.table('Ads Run',
    [{ label: 'Slot', width: 110 }, { label: 'Business', width: 130 }, { label: 'Amount', width: 80 }, { label: 'Status', width: 60 }, { label: 'Clicks', width: 50 }],
    (report.ads || []).map((a) => [a.slot, a.business_name || '—', NGN(a.price), a.status, String(a.clicks ?? 0)])
  );

  // ── Footer on every page ──
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i += 1) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(140, 140, 140);
    doc.text(
      `Generated by Rentora admin system on ${fmtDate(report.generated_at)} for compliance, dispute resolution, or legal proceedings. Page ${i} of ${pageCount}`,
      L.marginX, L.pageH - 25
    );
  }

  doc.save(`rentora-activity-${(acc.full_name || acc.id || 'user').toString().replace(/\s+/g, '_')}-${Date.now()}.pdf`);
}

export function downloadUserReportJson(report) {
  const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `rentora-activity-${(report.account?.full_name || report.account?.id || 'user').toString().replace(/\s+/g, '_')}-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
