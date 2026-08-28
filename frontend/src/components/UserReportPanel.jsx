import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { HoverCard, HoverCardContent, HoverCardTrigger } from './ui/hover-card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Download, FileJson, Loader2, Mail, Phone, ShieldCheck, User as UserIcon } from 'lucide-react';
import { downloadUserReportPdf, downloadUserReportJson } from '../lib/userReportPdf';

const NGN = (n) => `\u20a6${Number(n || 0).toLocaleString()}`;
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' }) : '\u2014');
const fmtDateTime = (d) => (d ? new Date(d).toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' }) : '\u2014');

const STATUS_TONE = {
  completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  released: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  paid: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  held: 'bg-amber-50 text-amber-700 border-amber-200',
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  refunded: 'bg-slate-100 text-slate-600 border-slate-200',
  failed: 'bg-rose-50 text-rose-700 border-rose-200',
  rejected: 'bg-rose-50 text-rose-700 border-rose-200',
};
const StatusPill = ({ status }) => (
  <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize ${STATUS_TONE[status] || 'bg-slate-100 text-slate-600 border-slate-200'}`}>
    {status || 'unknown'}
  </span>
);

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
        <HoverCardContent className="w-64 p-3">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full bg-primary/10 flex items-center justify-center">
              {user?.avatar_url ? (
                <img src={user.avatar_url} alt="" className="h-full w-full object-cover" />
              ) : (
                <UserIcon className="h-4 w-4 text-primary" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold leading-tight">{user?.full_name || 'Unnamed user'}</p>
              <p className="truncate text-xs text-muted-foreground">{user?.email || '\u2014'}</p>
            </div>
          </div>
          <div className="mt-2.5 flex items-center gap-1.5">
            <Badge variant="outline" className="text-[10px] capitalize font-normal">{user?.role || 'user'}</Badge>
            <Badge variant={user?.suspended ? 'destructive' : 'outline'} className="text-[10px] font-normal">{user?.suspended ? 'Suspended' : 'Active'}</Badge>
          </div>
          <button type="button" onClick={() => setReportOpen(true)} className="mt-3 w-full rounded-md bg-muted py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted/70">
            View full report
          </button>
        </HoverCardContent>
      </HoverCard>

      <UserActivityReportDialog user={user} open={reportOpen} onOpenChange={setReportOpen} />
    </>
  );
}

// One line of activity — used everywhere instead of a table, so nothing
// ever needs horizontal scroll on small screens.
const Row = ({ title, subtitle, amount, status, date }) => (
  <div className="flex items-center justify-between gap-3 px-3 py-2.5 sm:px-4">
    <div className="min-w-0 flex-1">
      <p className="truncate text-sm font-medium text-foreground">{title}</p>
      {subtitle && <p className="truncate text-xs text-muted-foreground">{subtitle}</p>}
    </div>
    <div className="flex shrink-0 flex-col items-end gap-1">
      {amount != null && <p className="text-sm font-semibold text-foreground">{NGN(amount)}</p>}
      <div className="flex items-center gap-1.5">
        {date && <span className="text-[11px] text-muted-foreground">{fmtDate(date)}</span>}
        {status && <StatusPill status={status} />}
      </div>
    </div>
  </div>
);

const RowList = ({ rows, emptyText = 'No records found.' }) => {
  if (!rows || rows.length === 0) {
    return <p className="px-3 py-6 text-center text-sm text-muted-foreground sm:px-4">{emptyText}</p>;
  }
  return <div className="divide-y divide-border/60 rounded-lg border border-border/60 bg-white">{rows}</div>;
};

const StatCard = ({ label, value }) => (
  <div className="rounded-xl border border-border/60 bg-white p-3.5">
    <p className="text-[11px] text-muted-foreground">{label}</p>
    <p className="mt-1 text-base font-semibold text-foreground sm:text-lg">{value}</p>
  </div>
);

const SubHeading = ({ children, count }) => (
  <div className="mb-2 flex items-center gap-2 px-0.5">
    <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{children}</h4>
    {typeof count === 'number' && count > 0 && <span className="text-[11px] text-muted-foreground">({count})</span>}
  </div>
);

export function UserActivityReportDialog({ user, open, onOpenChange }) {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open || !user?.id) return;
    let active = true;
    setLoading(true);
    setError(null);
    setReport(null);
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
    if (!report) return { rentTotal: 0, viewingTotal: 0, tipsGiven: 0, tokenTotal: 0, grandTotal: 0 };
    const rentTotal = (report.rent_payments || []).reduce((s, p) => s + Number(p.total_amount || 0), 0);
    const viewingTotal = (report.viewing_payments || []).reduce((s, v) => s + Number(v.amount || 0), 0);
    const tipsGiven = (report.tips_given || []).reduce((s, t) => s + Number(t.amount || 0), 0);
    const tokenTotal = (report.token_transactions || []).reduce((s, t) => s + Number(t.amount || 0), 0);
    return { rentTotal, viewingTotal, tipsGiven, tokenTotal, grandTotal: rentTotal + viewingTotal + tipsGiven + tokenTotal };
  }, [report]);

  const isAgentish = user?.role === 'agent' || (report?.properties_listed?.length || 0) > 0 || (report?.rent_payments_received?.length || 0) > 0;
  const acc = report?.account;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] w-[calc(100vw-1.5rem)] max-w-3xl flex-col gap-0 overflow-hidden p-0 sm:w-full">
        {/* Header */}
        <DialogHeader className="shrink-0 border-b px-4 py-4 sm:px-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <DialogTitle className="flex items-center gap-1.5 text-base sm:text-lg">
                <ShieldCheck className="h-4 w-4 shrink-0 text-primary" />
                <span className="truncate">{acc?.full_name || user?.full_name || 'Account report'}</span>
              </DialogTitle>
              <DialogDescription className="mt-0.5 text-xs">
                Live activity record for compliance or legal review
              </DialogDescription>
            </div>
            <div className="flex shrink-0 gap-1.5">
              <Button variant="outline" size="sm" className="h-8 px-2.5" disabled={!report} onClick={() => downloadUserReportJson(report)} title="Download JSON">
                <FileJson className="h-3.5 w-3.5 sm:mr-1.5" /> <span className="hidden sm:inline">JSON</span>
              </Button>
              <Button size="sm" className="h-8 px-2.5" disabled={!report} onClick={() => downloadUserReportPdf(report)} title="Download PDF">
                <Download className="h-3.5 w-3.5 sm:mr-1.5" /> <span className="hidden sm:inline">PDF</span>
              </Button>
            </div>
          </div>
        </DialogHeader>

        {loading && (
          <div className="flex flex-1 items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading account activity…
          </div>
        )}

        {!loading && error && (
          <p className="flex-1 py-16 text-center text-sm text-red-600">{error}</p>
        )}

        {!loading && !error && report && (
          <div className="flex flex-1 flex-col overflow-hidden">
            {/* Identity strip */}
            <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 border-b bg-slate-50/60 px-4 py-2.5 text-xs text-muted-foreground sm:px-6">
              <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{acc?.email || '\u2014'}</span>
              <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{acc?.phone || 'No phone recorded'}</span>
              <Badge variant="outline" className="text-[10px] font-normal capitalize">{acc?.role || 'user'}</Badge>
              <span>Joined {fmtDate(acc?.joined_at)}</span>
            </div>

            <Tabs defaultValue="overview" className="flex flex-1 flex-col overflow-hidden">
              <div className="shrink-0 overflow-x-auto border-b px-4 pt-2 sm:px-6">
                <TabsList className="h-9 w-max">
                  <TabsTrigger value="overview" className="text-xs">Overview</TabsTrigger>
                  <TabsTrigger value="payments" className="text-xs">Payments</TabsTrigger>
                  {isAgentish && <TabsTrigger value="agent" className="text-xs">As agent</TabsTrigger>}
                  <TabsTrigger value="ads" className="text-xs">Ads</TabsTrigger>
                </TabsList>
              </div>

              <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6">
                {/* ── Overview ── */}
                <TabsContent value="overview" className="mt-0 space-y-5">
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <StatCard label="Rent paid" value={NGN(totals.rentTotal)} />
                    <StatCard label="Viewing fees" value={NGN(totals.viewingTotal)} />
                    <StatCard label="Tips sent" value={NGN(totals.tipsGiven)} />
                    <StatCard label="Total paid" value={NGN(totals.grandTotal)} />
                  </div>

                  <div>
                    <SubHeading count={report.reports_filed?.length || 0}>Reports filed by this user</SubHeading>
                    <RowList rows={(report.reports_filed || []).map((r, i) => (
                      <Row key={i} title={r.reason || 'Report'} subtitle={r.property_title} status={r.status} date={r.created_at} />
                    ))} />
                  </div>

                  <p className="pt-1 text-[11px] text-muted-foreground">
                    Generated {fmtDateTime(report.generated_at)} · read live from the database, not a stored log.
                  </p>
                </TabsContent>

                {/* ── Payments ── */}
                <TabsContent value="payments" className="mt-0 space-y-5">
                  <div>
                    <SubHeading count={report.rent_payments?.length || 0}>Rent payments (escrow)</SubHeading>
                    <RowList rows={(report.rent_payments || []).map((p, i) => (
                      <Row key={i} title={p.property?.title || 'Property'} subtitle={p.agent?.full_name ? `Agent: ${p.agent.full_name}` : undefined} amount={p.total_amount} status={p.status} date={p.created_at} />
                    ))} />
                  </div>
                  <div>
                    <SubHeading count={report.viewing_payments?.length || 0}>Viewing / inspection payments</SubHeading>
                    <RowList rows={(report.viewing_payments || []).map((v, i) => (
                      <Row key={i} title={v.property_title || 'Property'} subtitle={v.agent_name ? `Agent: ${v.agent_name}` : undefined} amount={v.amount} status={v.status} date={v.created_at} />
                    ))} />
                  </div>
                  <div>
                    <SubHeading count={report.tips_given?.length || 0}>Agent tips sent</SubHeading>
                    <RowList rows={(report.tips_given || []).map((t, i) => (
                      <Row key={i} title={t.agent?.full_name || 'Agent'} amount={t.amount} status={t.status} date={t.created_at} />
                    ))} />
                  </div>
                  <div>
                    <SubHeading count={report.token_transactions?.length || 0}>Wallet / token transactions</SubHeading>
                    <RowList rows={(report.token_transactions || []).map((t, i) => (
                      <Row key={i} title={t.reference || 'Token purchase'} amount={t.amount} status={t.status} date={t.created_at} />
                    ))} />
                  </div>
                  <div>
                    <SubHeading count={report.property_unlocks?.length || 0}>Properties unlocked</SubHeading>
                    <RowList rows={(report.property_unlocks || []).map((u, i) => (
                      <Row key={i} title={u.property?.title || 'Property'} date={u.unlocked_at} />
                    ))} />
                  </div>
                </TabsContent>

                {/* ── Agent ── */}
                {isAgentish && (
                  <TabsContent value="agent" className="mt-0 space-y-5">
                    <div className="grid grid-cols-3 gap-3">
                      <StatCard label="Total earned" value={NGN(report.agent_earnings?.total_earned)} />
                      <StatCard label="Withdrawn" value={NGN(report.agent_earnings?.total_withdrawn)} />
                      <StatCard label="Balance" value={NGN(report.agent_earnings?.balance)} />
                    </div>
                    <div>
                      <SubHeading count={report.properties_listed?.length || 0}>Properties listed</SubHeading>
                      <RowList rows={(report.properties_listed || []).map((p, i) => (
                        <Row key={i} title={p.title} subtitle={p.location_text} status={p.status} date={p.created_at} />
                      ))} />
                    </div>
                    <div>
                      <SubHeading count={report.rent_payments_received?.length || 0}>Rent payments received</SubHeading>
                      <RowList rows={(report.rent_payments_received || []).map((p, i) => (
                        <Row key={i} title={p.property?.title || 'Property'} subtitle={p.tenant?.full_name ? `Tenant: ${p.tenant.full_name}` : undefined} amount={p.agent_fee} status={p.status} date={p.created_at} />
                      ))} />
                    </div>
                    <div>
                      <SubHeading count={report.tips_received?.length || 0}>Tips received</SubHeading>
                      <RowList rows={(report.tips_received || []).map((t, i) => (
                        <Row key={i} title={t.tenant?.full_name || 'Tenant'} amount={t.amount} status={t.status} date={t.created_at} />
                      ))} />
                    </div>
                    <div>
                      <SubHeading count={report.withdrawals?.length || 0}>Withdrawal requests</SubHeading>
                      <RowList rows={(report.withdrawals || []).map((w, i) => (
                        <Row key={i} title={w.bank_name || 'Bank'} subtitle={w.account_number} amount={w.amount} status={w.status} date={w.requested_at} />
                      ))} />
                    </div>
                  </TabsContent>
                )}

                {/* ── Ads ── */}
                <TabsContent value="ads" className="mt-0">
                  <SubHeading count={report.ads?.length || 0}>Ads run</SubHeading>
                  <RowList rows={(report.ads || []).map((a, i) => (
                    <Row key={i} title={a.business_name || a.slot} subtitle={`${a.slot} · ${a.clicks ?? 0} clicks`} amount={a.price} status={a.status} date={a.created_at} />
                  ))} />
                </TabsContent>
              </div>
            </Tabs>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
