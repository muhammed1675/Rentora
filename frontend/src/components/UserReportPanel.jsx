import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { HoverCard, HoverCardContent, HoverCardTrigger } from './ui/hover-card';
import { Download, FileJson, Loader2, Mail, Phone, ShieldCheck, User as UserIcon } from 'lucide-react';
import { downloadUserReportPdf, downloadUserReportJson } from '../lib/userReportPdf';

const NGN = (n) => `\u20a6${Number(n || 0).toLocaleString()}`;
const fmtDate = (d) => (d ? new Date(d).toLocaleString() : '\u2014');

/**
 * Wrap a user's name with this to get:
 *  - hover: a quick-glance card (email, phone, role, status, joined)
 *  - click: opens the full activity report dialog
 * Usage: <UserNamePopover user={u}>{u.full_name}</UserNamePopover>
 */
export function UserNamePopover({ user, children }) {
  const [reportOpen, setReportOpen] = useState(false);

  return (
    <>
      <HoverCard openDelay={150} closeDelay={80}>
        <HoverCardTrigger asChild>
          <button
            type="button"
            onClick={() => setReportOpen(true)}
            className="text-left font-medium underline-offset-2 hover:underline focus:outline-none focus:underline"
          >
            {children}
          </button>
        </HoverCardTrigger>
        <HoverCardContent className="w-72">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden shrink-0">
              {user?.avatar_url ? (
                <img src={user.avatar_url} alt={user.full_name} className="w-full h-full object-cover" />
              ) : (
                <UserIcon className="w-5 h-5 text-primary" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-sm truncate">{user?.full_name || 'Unnamed user'}</p>
              <p className="text-xs text-muted-foreground truncate flex items-center gap-1"><Mail className="w-3 h-3" />{user?.email || '\u2014'}</p>
              <p className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="w-3 h-3" />{user?.phone || 'No phone recorded'}</p>
              <div className="flex items-center gap-2 mt-2">
                <Badge variant="outline" className="text-[10px] capitalize">{user?.role || 'user'}</Badge>
                <Badge variant={user?.suspended ? 'destructive' : 'outline'} className="text-[10px]">{user?.suspended ? 'Suspended' : 'Active'}</Badge>
              </div>
              <p className="text-[11px] text-muted-foreground mt-2">Joined {fmtDate(user?.created_at)}</p>
            </div>
          </div>
          <Button size="sm" variant="outline" className="w-full mt-3 h-7 text-xs" onClick={() => setReportOpen(true)}>
            View full activity report
          </Button>
        </HoverCardContent>
      </HoverCard>

      <UserActivityReportDialog user={user} open={reportOpen} onOpenChange={setReportOpen} />
    </>
  );
}

const Section = ({ title, count, children }) => (
  <div className="space-y-2">
    <div className="flex items-center gap-2">
      <h4 className="text-sm font-semibold">{title}</h4>
      {typeof count === 'number' && <Badge variant="secondary" className="text-[10px]">{count}</Badge>}
    </div>
    {children}
  </div>
);

const MiniTable = ({ cols, rows, emptyText = 'No records found.' }) => {
  if (!rows || rows.length === 0) {
    return <p className="text-xs text-muted-foreground italic py-2">{emptyText}</p>;
  }
  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-xs">
        <thead className="bg-muted/50">
          <tr>{cols.map((c) => <th key={c} className="text-left font-semibold px-3 py-2 whitespace-nowrap">{c}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t">
              {r.map((cell, j) => <td key={j} className="px-3 py-2 whitespace-nowrap">{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export function UserActivityReportDialog({ user, open, onOpenChange }) {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open || !user?.id) return;
    let active = true;
    setLoading(true);
    setError(null);
    supabase.rpc('get_admin_user_report', { target_user_id: user.id })
      .then(({ data, error: rpcError }) => {
        if (rpcError) throw rpcError;
        if (active) setReport(data);
      })
      .catch((e) => { if (active) setError(e.message || 'Failed to load report'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [open, user?.id]);

  const totals = useMemo(() => {
    if (!report) return null;
    const rentTotal = (report.rent_payments || []).reduce((s, p) => s + Number(p.total_amount || 0), 0);
    const viewingTotal = (report.viewing_payments || []).reduce((s, v) => s + Number(v.amount || 0), 0);
    const tipsGiven = (report.tips_given || []).reduce((s, t) => s + Number(t.amount || 0), 0);
    const tokenTotal = (report.token_transactions || []).reduce((s, t) => s + Number(t.amount || 0), 0);
    return { rentTotal, viewingTotal, tipsGiven, tokenTotal, grandTotal: rentTotal + viewingTotal + tipsGiven + tokenTotal };
  }, [report]);

  const isAgentish = user?.role === 'agent' || (report?.properties_listed?.length || 0) > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <DialogTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5" />Account activity report</DialogTitle>
              <DialogDescription>Full activity record — for school, compliance, or legal review. Pulled live, not from a stored log.</DialogDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={!report} onClick={() => downloadUserReportJson(report)}>
                <FileJson className="w-4 h-4 mr-1" /> JSON
              </Button>
              <Button size="sm" disabled={!report} onClick={() => downloadUserReportPdf(report)}>
                <Download className="w-4 h-4 mr-1" /> Download PDF
              </Button>
            </div>
          </div>
        </DialogHeader>

        {loading && (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading account activity…
          </div>
        )}

        {!loading && error && (
          <p className="text-sm text-red-600 py-8 text-center">{error}</p>
        )}

        {!loading && !error && report && (
          <div className="space-y-6">
            <div className="flex items-start justify-between gap-4 border-b pb-4 flex-wrap">
              <div>
                <p className="text-lg font-semibold">{report.account?.full_name || 'Unnamed user'}</p>
                <p className="text-sm text-muted-foreground">{report.account?.email}</p>
                <p className="text-sm text-muted-foreground">{report.account?.phone || 'No phone recorded'}</p>
              </div>
              <div className="text-right text-sm">
                <Badge variant="outline" className="capitalize">{report.account?.role || 'user'}</Badge>
                <p className="mt-2 text-muted-foreground">Joined {fmtDate(report.account?.joined_at)}</p>
                <p className="text-muted-foreground">Last login {fmtDate(report.account?.last_login_at)}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-lg bg-muted/50 p-3"><p className="text-xs text-muted-foreground">Rent paid</p><p className="text-lg font-semibold">{NGN(totals.rentTotal)}</p></div>
              <div className="rounded-lg bg-muted/50 p-3"><p className="text-xs text-muted-foreground">Viewing fees paid</p><p className="text-lg font-semibold">{NGN(totals.viewingTotal)}</p></div>
              <div className="rounded-lg bg-muted/50 p-3"><p className="text-xs text-muted-foreground">Tips sent</p><p className="text-lg font-semibold">{NGN(totals.tipsGiven)}</p></div>
              <div className="rounded-lg bg-muted/50 p-3"><p className="text-xs text-muted-foreground">Total paid</p><p className="text-lg font-semibold">{NGN(totals.grandTotal)}</p></div>
            </div>

            <Section title="Rent Payments (Escrow)" count={report.rent_payments?.length || 0}>
              <MiniTable
                cols={['Date', 'Property', 'Agent', 'Amount', 'Status']}
                rows={(report.rent_payments || []).map((p) => [fmtDate(p.created_at), p.property?.title || '\u2014', p.agent?.full_name || '\u2014', NGN(p.total_amount), <Badge key="s" variant="outline" className="text-[10px] capitalize">{p.status}</Badge>])}
              />
            </Section>

            <Section title="Viewing / Inspection Payments" count={report.viewing_payments?.length || 0}>
              <MiniTable
                cols={['Date', 'Property', 'Agent', 'Amount', 'Status']}
                rows={(report.viewing_payments || []).map((v) => [fmtDate(v.created_at), v.property_title || '\u2014', v.agent_name || '\u2014', NGN(v.amount), v.status])}
              />
            </Section>

            <Section title="Agent Tips Sent" count={report.tips_given?.length || 0}>
              <MiniTable
                cols={['Date', 'Agent', 'Amount', 'Status']}
                rows={(report.tips_given || []).map((t) => [fmtDate(t.created_at), t.agent?.full_name || '\u2014', NGN(t.amount), t.status])}
              />
            </Section>

            <Section title="Wallet / Token Transactions" count={report.token_transactions?.length || 0}>
              <MiniTable
                cols={['Date', 'Reference', 'Amount', 'Status']}
                rows={(report.token_transactions || []).map((t) => [fmtDate(t.created_at), t.reference || '\u2014', NGN(t.amount), t.status])}
              />
            </Section>

            <Section title="Properties Unlocked" count={report.property_unlocks?.length || 0}>
              <MiniTable
                cols={['Date', 'Property']}
                rows={(report.property_unlocks || []).map((u) => [fmtDate(u.unlocked_at), u.property?.title || '\u2014'])}
              />
            </Section>

            <Section title="Reports Filed by This User" count={report.reports_filed?.length || 0}>
              <MiniTable
                cols={['Date', 'Property', 'Reason', 'Status']}
                rows={(report.reports_filed || []).map((r) => [fmtDate(r.created_at), r.property_title || '\u2014', r.reason || '\u2014', r.status])}
              />
            </Section>

            {isAgentish && (
              <>
                <div className="border-t pt-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold mb-3">As agent</p>
                </div>
                <Section title="Properties Listed" count={report.properties_listed?.length || 0}>
                  <MiniTable
                    cols={['Title', 'Location', 'Status', 'Availability']}
                    rows={(report.properties_listed || []).map((p) => [p.title, p.location_text || '\u2014', p.status, p.availability])}
                  />
                </Section>
                <Section title="Rent Payments Received" count={report.rent_payments_received?.length || 0}>
                  <MiniTable
                    cols={['Date', 'Tenant', 'Property', 'Agent fee', 'Status']}
                    rows={(report.rent_payments_received || []).map((p) => [fmtDate(p.created_at), p.tenant?.full_name || '\u2014', p.property?.title || '\u2014', NGN(p.agent_fee), p.status])}
                  />
                </Section>
                <Section title="Tips Received" count={report.tips_received?.length || 0}>
                  <MiniTable
                    cols={['Date', 'From', 'Amount', 'Status']}
                    rows={(report.tips_received || []).map((t) => [fmtDate(t.created_at), t.tenant?.full_name || '\u2014', NGN(t.amount), t.status])}
                  />
                </Section>
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-lg bg-muted/50 p-3"><p className="text-xs text-muted-foreground">Total earned</p><p className="text-lg font-semibold">{NGN(report.agent_earnings?.total_earned)}</p></div>
                  <div className="rounded-lg bg-muted/50 p-3"><p className="text-xs text-muted-foreground">Total withdrawn</p><p className="text-lg font-semibold">{NGN(report.agent_earnings?.total_withdrawn)}</p></div>
                  <div className="rounded-lg bg-muted/50 p-3"><p className="text-xs text-muted-foreground">Balance</p><p className="text-lg font-semibold">{NGN(report.agent_earnings?.balance)}</p></div>
                </div>
                <Section title="Withdrawal Requests" count={report.withdrawals?.length || 0}>
                  <MiniTable
                    cols={['Date', 'Amount', 'Bank', 'Account', 'Status']}
                    rows={(report.withdrawals || []).map((w) => [fmtDate(w.requested_at), NGN(w.amount), w.bank_name || '\u2014', w.account_number || '\u2014', w.status])}
                  />
                </Section>
              </>
            )}

            <Section title="Ads Run" count={report.ads?.length || 0}>
              <MiniTable
                cols={['Slot', 'Business', 'Amount', 'Status', 'Clicks']}
                rows={(report.ads || []).map((a) => [a.slot, a.business_name || '\u2014', NGN(a.price), a.status, a.clicks ?? 0])}
              />
            </Section>

            <p className="text-xs text-muted-foreground pt-2 border-t">
              Generated {fmtDate(report.generated_at)} by Rentora admin system for compliance, dispute resolution, or legal proceedings. Data is read live from the current database — nothing here is a stored/cached copy.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
