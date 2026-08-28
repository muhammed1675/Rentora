import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Download, FileText, Printer, Search, ShieldCheck } from 'lucide-react';

const categoryLabels = { account: 'Account', payment: 'Payment', listing: 'Listing', booking: 'Booking', verification: 'Verification', message: 'Message', security: 'Security', admin: 'Admin' };

export function AccountActivityStatement({ account, open, onOpenChange, adminId }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [category, setCategory] = useState('all');
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!open || !account?.id) return;
    let active = true;
    setLoading(true);
    supabase.rpc('get_account_activity_statement', { target_user_id: account.id })
      .then(({ data, error }) => {
        if (error) throw error;
        if (active) setEvents(data || []);
      })
      .catch(() => { if (active) setEvents([]); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [open, account?.id]);

  const filteredEvents = useMemo(() => events.filter((event) => {
    const matchesCategory = category === 'all' || event.category === category;
    const matchesQuery = !query.trim() || `${event.description} ${event.action} ${event.reference_id || ''}`.toLowerCase().includes(query.toLowerCase());
    return matchesCategory && matchesQuery;
  }), [events, category, query]);

  const report = { report_type: 'Rentora account activity statement', generated_at: new Date().toISOString(), account: { id: account?.id, name: account?.full_name, email: account?.email, phone: account?.phone, role: account?.role, created_at: account?.created_at }, activities: filteredEvents };
  const downloadJson = () => {
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a');
    a.href = url; a.download = `rentora-activity-${account?.id}.json`; a.click(); URL.revokeObjectURL(url);
  };
  const printPdf = () => { window.print(); };
  const totalPayments = filteredEvents.filter(e => e.category === 'payment').reduce((sum, e) => sum + Number(e.amount || 0), 0);

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto print:static print:max-w-none print:max-h-none print:overflow-visible">
      <DialogHeader className="print:border-b print:pb-4">
        <div className="flex items-start justify-between gap-4">
          <div><DialogTitle className="flex items-center gap-2"><FileText className="h-5 w-5" />Account activity statement</DialogTitle><DialogDescription>Official activity record for school, compliance, or legal review.</DialogDescription></div>
          <div className="flex gap-2 print:hidden"><Button variant="outline" size="sm" onClick={downloadJson}><Download />JSON</Button><Button size="sm" onClick={printPdf}><Printer />Print / PDF</Button></div>
        </div>
      </DialogHeader>
      <div className="flex items-start justify-between gap-4 border-b pb-5">
        <div><p className="text-lg font-semibold">{account?.full_name || 'Unnamed user'}</p><p className="text-sm text-muted-foreground">{account?.email}</p><p className="text-sm text-muted-foreground">{account?.phone || 'No phone recorded'}</p></div>
        <div className="text-right text-sm"><Badge variant="outline">{account?.role || 'user'}</Badge><p className="mt-2 text-muted-foreground">Account created {account?.created_at ? new Date(account.created_at).toLocaleDateString() : '—'}</p><p className="text-muted-foreground">Generated {new Date().toLocaleString()}</p></div>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4"><div className="rounded-lg bg-muted/50 p-3"><p className="text-xs text-muted-foreground">Activities</p><p className="text-xl font-semibold">{filteredEvents.length}</p></div><div className="rounded-lg bg-muted/50 p-3"><p className="text-xs text-muted-foreground">Payments logged</p><p className="text-xl font-semibold">{filteredEvents.filter(e => e.category === 'payment').length}</p></div><div className="rounded-lg bg-muted/50 p-3"><p className="text-xs text-muted-foreground">Payment total</p><p className="text-xl font-semibold">₦{totalPayments.toLocaleString()}</p></div><div className="rounded-lg bg-muted/50 p-3"><p className="text-xs text-muted-foreground">Integrity</p><p className="flex items-center gap-1 text-sm font-semibold"><ShieldCheck className="h-4 w-4" />Append-only</p></div></div>
      <div className="flex flex-col gap-2 sm:flex-row print:hidden"><div className="relative flex-1"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search activities" className="h-9 w-full rounded-md border bg-background pl-9 pr-3 text-sm" /></div><select value={category} onChange={e => setCategory(e.target.value)} className="h-9 rounded-md border bg-background px-3 text-sm"><option value="all">All categories</option>{Object.entries(categoryLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
      <div className="overflow-hidden rounded-lg border"><div className="grid grid-cols-[1fr_2fr_1fr] gap-3 bg-muted/50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground"><span>Date</span><span>Activity</span><span>Category / reference</span></div>{loading ? <p className="p-8 text-center text-sm text-muted-foreground">Loading account activity…</p> : filteredEvents.length === 0 ? <p className="p-8 text-center text-sm text-muted-foreground">No recorded activity found.</p> : filteredEvents.map(event => <div key={event.id} className="grid grid-cols-[1fr_2fr_1fr] gap-3 border-t px-4 py-3 text-sm"><span className="text-muted-foreground">{new Date(event.created_at).toLocaleString()}</span><span><span className="font-medium">{event.description}</span>{event.amount != null && <span className="ml-2 font-semibold">₦{Number(event.amount).toLocaleString()}</span>}</span><span><Badge variant="secondary">{categoryLabels[event.category] || event.category}</Badge>{event.reference_id && <span className="mt-1 block truncate text-xs text-muted-foreground">Ref: {event.reference_id}</span>}</span></div>)}</div>
      <p className="text-xs text-muted-foreground">Prepared by Rentora administration · Report access is restricted to authorized administrators.</p>
    </DialogContent>
  </Dialog>;
}
