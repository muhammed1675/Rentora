import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { adminAPI, userAPI, verificationAPI, propertyAPI, inspectionAPI, transactionAPI, contactAPI, withdrawalAPI, balanceAPI, rentAPI, maintenanceAPI, reportAPI } from '../lib/api';
import { supabase } from '../lib/supabase';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import {
  LayoutDashboard, Users, Shield, Building2, Calendar, Receipt,
  CheckCircle2, XCircle, Eye, Ban, UserCheck, TrendingUp,
  Search, RefreshCw, Trash2, AlertTriangle, User, FileText,
  MessageSquare, Mail, Inbox, MailOpen, UserCog, Copy, Phone, CreditCard, Clock, Wallet, ArrowDownCircle, Lock, Home,
  Menu, X, ChevronRight, CalendarCheck, Flag
} from 'lucide-react';
import { toast } from 'sonner';

export function AdminDashboard() {
  const navigate = useNavigate();
  const { user, isAuthenticated, isAdmin } = useAuth();

  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [agents, setAgents] = useState([]);
  const [verifications, setVerifications] = useState([]);
  const [properties, setProperties] = useState([]);
  const [inspections, setInspections] = useState([]);
  const [transactions, setTransactions] = useState({ inspection_transactions: [] });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [selectedVerification, setSelectedVerification] = useState(null);
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [agentSearch, setAgentSearch] = useState('');
  const [navSearch, setNavSearch] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState({ open: false, property: null, deleting: false });
  const [messages, setMessages] = useState([]);
  const [reports, setReports] = useState([]);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [bankRequests, setBankRequests] = useState([]);
  const [bankRejectNote, setBankRejectNote] = useState('');
  const [bankRejectId, setBankRejectId] = useState(null);
  const [agentBankDetails, setAgentBankDetails] = useState([]);
  const [previewProperty, setPreviewProperty] = useState(null);
  const [withdrawalRequests, setWithdrawalRequests] = useState([]);
  const [rentPayments, setRentPayments] = useState([]);
  const [agentBalances, setAgentBalances] = useState([]);
  const [rejectingWithdrawal, setRejectingWithdrawal] = useState(null);
  const [rejectNote, setRejectNote] = useState('');
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) { navigate('/login'); return; }
    if (!isAdmin) { toast.error('Access denied'); navigate('/'); return; }
    fetchData();
  }, [isAuthenticated, isAdmin]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchData = async () => {
    setLoading(true);
    await maintenanceAPI.expireStalePending().catch(() => {});
    try {
      const [statsRes, usersRes, verificationsRes, propertiesRes, inspectionsRes, txRes, messagesRes, withdrawalsRes, balancesRes, rentPaymentsRes, reportsRes] = await Promise.all([
        adminAPI.getStats(), userAPI.getAll(), verificationAPI.getAll(),
        propertyAPI.getAllAdmin(), inspectionAPI.getAll(), transactionAPI.getAll(),
        contactAPI.getAll(), withdrawalAPI.getAll(), balanceAPI.getAllBalances(),
        rentAPI.getAllForAdmin(), reportAPI.getAll(),
      ]);
      const allUsers = usersRes.data || [];
      setStats(statsRes.data);
      setUsers(allUsers);
      setAgents(allUsers.filter(u => u.role === 'agent')); // phone already on user object
      // Enrich verifications with phone from users
      const enrichedVerifs = (verificationsRes.data || []).map(v => ({
        ...v,
        user_phone: allUsers.find(u => u.id === v.user_id)?.phone || null,
      }));
      setVerifications(enrichedVerifs);
      setProperties(propertiesRes.data);
      setInspections(inspectionsRes.data);
      setTransactions(txRes.data);
      setMessages(messagesRes.data);
      if (reportsRes?.data) setReports(reportsRes.data);
      if (withdrawalsRes?.data) setWithdrawalRequests(withdrawalsRes.data);
      if (balancesRes?.data) setAgentBalances(balancesRes.data);
      if (rentPaymentsRes?.data) setRentPayments(rentPaymentsRes.data);
      // Load bank change requests (no FK join - enrich from allUsers instead)
      try {
        const { data: bankReqs, error: bankErr } = await supabase
          .from('agent_bank_change_requests')
          .select('*')
          .order('created_at', { ascending: false });
        if (bankErr) console.error('Bank requests error:', bankErr);
        // Enrich with user info from already-loaded users
        const enriched = (bankReqs || []).map(r => ({
          ...r,
          users: allUsers.find(u => u.id === r.user_id) || null,
        }));
        setBankRequests(enriched);
      } catch (e) { console.error('Bank requests fetch failed:', e); }
      // Load agent bank details (source of truth for bank display)
      try {
        const { data: bankDetails } = await supabase
          .from('agent_bank_details')
          .select('*');
        setAgentBankDetails(bankDetails || []);
      } catch (e) { console.error('agent_bank_details fetch failed:', e); }
    } catch (error) {
      console.error('Failed to fetch data:', error);
      toast.error('Failed to load dashboard data');
    } finally { setLoading(false); }
  };

  const handleUpdateRole = async (userId, role) => {
    if (userId === user.id) { toast.error('You cannot change your own role.'); return; }
    try { await userAPI.updateRole(userId, role); toast.success('Role updated'); fetchData(); }
    catch { toast.error('Failed to update role'); }
  };

  const handleSuspendUser = async (userId, suspended) => {
    if (userId === user.id) { toast.error('You cannot suspend your own account.'); return; }
    try { await userAPI.suspend(userId, suspended); toast.success(suspended ? 'User suspended' : 'User unsuspended'); fetchData(); }
    catch { toast.error('Failed to update user'); }
  };

  const handleReviewVerification = async (requestId, status, verif = null) => {
    // verif can be passed directly (from inline cards) or fall back to selectedVerification (from dialog)
    const v = verif || selectedVerification;
    try {
      await verificationAPI.review(requestId, status, user.id);
      toast.success(`Verification ${status === 'approved' ? 'approved ✓' : 'rejected'}`);
      // If approved and has bank details, write to agent_bank_details
      if (status === 'approved' && v?.bank_name) {
        await supabase
          .from('agent_bank_details')
          .upsert({
            user_id: v.user_id,
            bank_code: v.bank_code,
            bank_name: v.bank_name,
            account_number: v.account_number,
            account_name: v.account_name,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'user_id' });
      }
      // Open email client to notify agent
      if (v) {
        const isApproved = status === 'approved';
        const subject = isApproved
          ? 'Your Rentora Agent Account Has Been Approved!'
          : 'Update on Your Rentora Agent Application';
        const body = isApproved
          ? `Hi ${v.user_name},\n\nCongratulations! Your agent verification has been approved on Rentora.\n\nYou can now log in and start listing properties on the platform. Head to your Agent Dashboard to add your first property.\n\nWelcome aboard!\n\nBest regards,\nRentora Admin Team`
          : `Hi ${v.user_name},\n\nThank you for applying to become an agent on Rentora.\n\nUnfortunately, we were unable to approve your application at this time. Please review your submitted documents and feel free to reapply.\n\nIf you have any questions, reply to this email.\n\nBest regards,\nRentora Admin Team`;
        window.open(`mailto:${v.user_email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, '_blank');
      }
      setSelectedVerification(null);
      fetchData();
    } catch { toast.error('Failed to review'); }
  };

  const handleBankRequest = async (requestId, action, note = '') => {
    try {
      const { error } = await supabase
        .from('agent_bank_change_requests')
        .update({ status: action, admin_note: note || null, updated_at: new Date().toISOString() })
        .eq('id', requestId);
      if (error) throw error;

      if (action === 'approved') {
        const req = bankRequests.find(r => r.id === requestId);
        if (req) {
          // Upsert into dedicated agent_bank_details table (source of truth)
          await supabase
            .from('agent_bank_details')
            .upsert({
              user_id: req.user_id,
              bank_code: req.bank_code,
              bank_name: req.bank_name,
              account_number: req.account_number,
              account_name: req.account_name,
              updated_at: new Date().toISOString(),
            }, { onConflict: 'user_id' });
        }
        toast.success('Bank details approved — agent can now receive payments');
      } else {
        toast.success('Bank request rejected — agent has been notified');
      }
      setBankRejectNote('');
      setBankRejectId(null);
      fetchData();
    } catch (err) {
      toast.error('Failed to process request');
    }
  };

  const handleApproveProperty = async (propertyId, status) => {
    try { await propertyAPI.approve(propertyId, status, user.id); toast.success(`Property ${status}`); fetchData(); }
    catch { toast.error('Failed to update property'); }
  };

  // Reviewing a student's move-in photo: admin previews it in a dialog,
  // then either confirms (releases funds to the agent) or dismisses.
  const [moveInPreview, setMoveInPreview] = useState(null); // the rentPayment row being previewed
  const [confirmingMoveIn, setConfirmingMoveIn] = useState(false);

  const handleAdminConfirmMoveIn = async (rentPaymentId) => {
    setConfirmingMoveIn(true);
    try {
      await rentAPI.adminConfirmMoveIn(rentPaymentId, user.id);
      toast.success('Move-in confirmed — funds released to the agent.');
      setMoveInPreview(null);
      fetchData();
    } catch (e) {
      toast.error(e.message || 'Failed to confirm move-in');
    } finally {
      setConfirmingMoveIn(false);
    }
  };

  // Only admins can do this — agents are blocked from reopening a property
  // once any rent payment for it has been held or released (prevents an
  // agent double-renting an already-occupied room). Use this once a
  // tenancy has genuinely ended and the listing should go live again.
  // Opens the same property preview modal used in the Properties tab, from
  // anywhere else in the dashboard (e.g. Escrow) that only has a
  // property_id — looks it up from the already-fetched properties list.
  const openPropertyPreviewById = (propertyId) => {
    const full = properties.find((p) => p.id === propertyId);
    if (full) {
      setPreviewProperty(full);
    } else {
      toast.error('Property details not found — it may have been deleted.');
    }
  };

  const confirmDeleteProperty = (property) => setDeleteConfirm({ open: true, property, deleting: false });

  const handleDeleteProperty = async () => {
    if (!deleteConfirm.property) return;
    setDeleteConfirm(prev => ({ ...prev, deleting: true }));
    try {
      await propertyAPI.delete(deleteConfirm.property.id);
      toast.success('Property deleted successfully');
      setDeleteConfirm({ open: false, property: null, deleting: false });
      fetchData();
    } catch (error) {
      toast.error(error.message || 'Failed to delete property');
      setDeleteConfirm(prev => ({ ...prev, deleting: false }));
    }
  };

  const handleMarkRead = async (id) => {
    try {
      await contactAPI.markRead(id);
      setMessages(prev => prev.map(m => m.id === id ? { ...m, status: 'read' } : m));
      if (selectedMessage?.id === id) setSelectedMessage(prev => ({ ...prev, status: 'read' }));
    } catch { toast.error('Failed to mark as read'); }
  };

  const handleDeleteMessage = async (id) => {
    try {
      await contactAPI.delete(id);
      setMessages(prev => prev.filter(m => m.id !== id));
      if (selectedMessage?.id === id) setSelectedMessage(null);
      toast.success('Message deleted');
    } catch { toast.error('Failed to delete message'); }
  };

  const handleResolveReport = async (id, status) => {
    try {
      await reportAPI.resolve(id, status, null, user.id);
      setReports(prev => prev.map(r => r.id === id ? { ...r, status } : r));
      toast.success(status === 'resolved' ? 'Report marked resolved' : 'Report dismissed');
    } catch { toast.error('Failed to update report'); }
  };

  const handleReply = async (msg) => {
    if (!replyText.trim()) { toast.error('Please write a reply first'); return; }
    setSendingReply(true);
    try {
      const res = await fetch('/api/send-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: msg.email,
          toName: msg.name,
          subject: msg.subject,
          message: replyText.trim(),
          originalMessage: msg.message,
        }),
      });
      if (!res.ok) throw new Error('Failed to send');
      toast.success(`Reply sent to ${msg.name}!`);
      setReplyText('');
    } catch (err) {
      toast.error('Failed to send reply. Check your email config.');
    } finally {
      setSendingReply(false);
    }
  };

  const copyToClipboard = (text, label) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  };

  // Get agent's bank + verification data. Bank from agent_bank_details (source of truth),
  // other fields (address, id_card_url) from agent_verification_requests.
  const getAgentVerification = (agentId) => {
    const bankRow = agentBankDetails.find(b => b.user_id === agentId);
    const verifRow = verifications.find(v => v.user_id === agentId && v.status === 'approved')
      || verifications.find(v => v.user_id === agentId);
    // Merge: verifRow for doc URLs/address, bankRow for bank fields
    if (!verifRow && !bankRow) return null;
    return {
      ...(verifRow || {}),
      ...(bankRow ? {
        bank_code: bankRow.bank_code,
        bank_name: bankRow.bank_name,
        account_number: bankRow.account_number,
        account_name: bankRow.account_name,
      } : {}),
    };
  };

  const getAgentPropertyCount = (agentId) =>
    properties.filter(p => p.uploaded_by_agent_id === agentId).length;

  const getAgentInspectionCount = (agentId) =>
    inspections.filter(i => i.agent_id === agentId).length;

  const formatPrice = (price) => new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 0 }).format(price);

  const getStatusBadge = (status) => ({
    pending: 'bg-yellow-100 text-yellow-800',
    approved: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-800',
    completed: 'bg-green-100 text-green-800',
    assigned: 'bg-blue-100 text-blue-800',
    failed: 'bg-red-100 text-red-800',
    held: 'bg-yellow-100 text-yellow-800',
    released: 'bg-green-100 text-green-800',
    paid: 'bg-green-100 text-green-800',
    refunded: 'bg-red-100 text-red-800',
  }[status] || 'bg-gray-100 text-gray-800');

  const filteredUsers = users.filter(u =>
    !searchTerm ||
    u.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredAgents = agents.filter(a =>
    !agentSearch ||
    a.full_name?.toLowerCase().includes(agentSearch.toLowerCase()) ||
    a.email?.toLowerCase().includes(agentSearch.toLowerCase())
  );

  if (!isAuthenticated || !isAdmin) return null;

  // Sidebar navigation groups — same activeTab values used by the existing
  // TabsContent blocks below. Only the visual shell changes.
  const navGroups = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    {
      label: 'People', icon: Users, detail: 'Users · Agents · Verification',
      items: [
        { id: 'users', label: 'Users', icon: Users, count: users.length },
        { id: 'agents', label: 'Agents', icon: UserCog, count: agents.length },
        { id: 'verification', label: 'Verification', icon: Shield, count: stats?.pending_verifications, urgent: true },
      ],
    },
    { id: 'properties', label: 'Listings', icon: Building2, count: stats?.pending_properties, urgent: true },
    { id: 'inspections', label: 'Bookings', icon: CalendarCheck },
    {
      label: 'Money', icon: Wallet, detail: 'Transactions · Payouts · Escrow',
      items: [
        { id: 'transactions', label: 'Transactions', icon: Receipt },
        { id: 'payouts', label: 'Agent Payouts', icon: ArrowDownCircle, count: withdrawalRequests.filter(r => r.status === 'pending').length, urgent: true },
        { id: 'escrow', label: 'Escrow', icon: Lock, count: rentPayments.filter(p => p.status === 'held' || p.status === 'move_in_reported').length },
        { id: 'rentora-revenue', label: 'Revenue', icon: TrendingUp },
      ],
    },
    { id: 'messages', label: 'Messages', icon: MessageSquare, count: messages.filter(m => m.status === 'unread').length, urgent: true },
    { id: 'reports', label: 'Reports', icon: Flag, count: reports.filter(r => r.status === 'pending').length, urgent: true },
  ];

  const navQuery = navSearch.trim().toLowerCase();
  const filteredNavGroups = !navQuery
    ? navGroups
    : navGroups
        .map((group) => {
          if (!group.items) {
            return group.label.toLowerCase().includes(navQuery) ? group : null;
          }
          const groupMatches = group.label.toLowerCase().includes(navQuery);
          const items = group.items.filter((i) =>
            i.label.toLowerCase().includes(navQuery)
          );
          if (groupMatches) return group;
          if (items.length) return { ...group, items };
          return null;
        })
        .filter(Boolean);

  const goTo = (id) => { setActiveTab(id); setMobileNavOpen(false); };
  const activeGroupLabel = navGroups.find(g => g.id === activeTab)?.label
    || navGroups.find(g => g.items?.some(i => i.id === activeTab))?.items.find(i => i.id === activeTab)?.label
    || 'Overview';

  const NavCountBadge = ({ count, urgent, inverted }) => {
    if (!count) return null;
    const base = 'ml-auto h-5 min-w-[20px] px-1.5 text-[10px] font-semibold shrink-0 rounded-full flex items-center justify-center';
    if (urgent) return <span className={`${base} bg-rose-500 text-white`}>{count}</span>;
    return <span className={`${base} ${inverted ? 'bg-white/15 text-white' : 'bg-slate-200 text-slate-700'}`}>{count}</span>;
  };

  const firstName = (user?.full_name || 'Admin').split(' ')[0];

  return (
    <div className="min-h-screen admin-surface lg:grid lg:grid-cols-[280px_1fr]" data-testid="admin-dashboard">
      {/* Mobile nav backdrop */}
      {mobileNavOpen && (
        <button
          onClick={() => setMobileNavOpen(false)}
          className="fixed inset-0 z-40 bg-slate-900/40 lg:hidden"
          aria-label="Close admin navigation"
        />
      )}

      {/* Sidebar — light card style with dark active pill */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-[280px] bg-white border-r border-slate-200/70 flex flex-col transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${mobileNavOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        {/* Brand */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-[hsl(206,100%,26%)] flex items-center justify-center text-white shadow-sm">
              <Home className="w-4 h-4" />
            </div>
            <div className="leading-tight">
              <p className="text-[13px] font-bold text-slate-900">Rentora</p>
              <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Admin console</p>
            </div>
          </div>
          <button onClick={() => setMobileNavOpen(false)} className="lg:hidden text-slate-400 hover:text-slate-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="px-4 mb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              value={navSearch}
              onChange={(e) => setNavSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const first =
                    filteredNavGroups.find((g) => !g.items) ||
                    filteredNavGroups.find((g) => g.items?.length)?.items?.[0];
                  if (first) goTo(first.id);
                }
                if (e.key === 'Escape') setNavSearch('');
              }}
              placeholder="Search sections…"
              className="w-full pl-9 pr-3 py-2 text-xs rounded-lg bg-slate-50 border border-slate-200/70 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition"
            />
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 pb-4 space-y-1" aria-label="Admin navigation">
          {filteredNavGroups.length === 0 ? (
            <p className="px-3 py-6 text-center text-[11px] text-slate-400">
              No sections match “{navSearch}”.
            </p>
          ) : filteredNavGroups.map((group) => {
            if (!group.items) {
              const Icon = group.icon;
              const isActive = activeTab === group.id;
              return (
                <button
                  key={group.id}
                  onClick={() => goTo(group.id)}
                  className={`w-full group flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13px] text-left transition-all ${
                    isActive
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-500 group-hover:text-slate-900'}`} />
                  <span className="flex-1 font-medium">{group.label}</span>
                  <NavCountBadge count={group.count} urgent={group.urgent} inverted={isActive} />
                </button>
              );
            }
            return (
              <div key={group.label} className="pt-3">
                <p className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  {group.label}
                </p>
                <div className="space-y-0.5">
                  {group.items.map((item) => {
                    const isActive = activeTab === item.id;
                    const ItemIcon = item.icon || ChevronRight;
                    return (
                      <button
                        key={item.id}
                        onClick={() => goTo(item.id)}
                        className={`w-full group flex items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] text-left transition-all ${
                          isActive
                            ? 'bg-slate-900 text-white shadow-sm'
                            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                        }`}
                      >
                        <ItemIcon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-700'}`} />
                        <span className="flex-1 font-medium">{item.label}</span>
                        <NavCountBadge count={item.count} urgent={item.urgent} inverted={isActive} />
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        {/* Footer profile card */}
        <div className="border-t border-slate-200/60 p-3">
          <div className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-slate-50 transition">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-primary font-bold text-sm shrink-0">
              {firstName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-semibold text-slate-900 truncate">{user?.full_name || 'Admin'}</p>
              <p className="text-[10px] text-slate-500 truncate">{user?.email}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="min-w-0">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 admin-topbar px-4 py-3 sm:px-8">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => setMobileNavOpen(true)} className="lg:hidden shrink-0 w-9 h-9 rounded-lg border border-slate-200 flex items-center justify-center">
              <Menu className="w-4 h-4" />
            </button>
            <div className="min-w-0 hidden sm:block">
              <p className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">Section</p>
              <h2 className="text-sm font-semibold text-slate-800 truncate">{activeGroupLabel}</h2>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button className="h-9 w-9 rounded-full border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center relative">
              <MessageSquare className="w-4 h-4 text-slate-500" />
              {messages.filter(m => m.status === 'unread').length > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-rose-500 rounded-full border-2 border-white" />
              )}
            </button>
            <Button onClick={fetchData} variant="outline" size="sm" className="gap-2 shrink-0 rounded-full border-slate-200 bg-white hover:bg-slate-50 h-9 px-3.5">
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline text-xs font-semibold">Refresh</span>
            </Button>
          </div>
        </header>

        <div className="p-4 sm:p-8">
          {/* Greeting hero — only on Overview */}
          {activeTab === 'overview' && (
            <div className="mb-6 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                  Hello, {firstName} 👋
                </h1>
                <p className="text-sm text-slate-500 mt-1">
                  Here's what's happening on Rentora today.
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Clock className="w-3.5 h-3.5" />
                <span>{new Date().toLocaleDateString('en-NG', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
              </div>
            </div>
          )}

          <Tabs value={activeTab} onValueChange={setActiveTab}>
        {/* ── Overview ── */}
        {/* ── Overview ── */}
        <TabsContent value="overview">
          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="admin-card p-5 animate-pulse">
                  <div className="h-16 bg-slate-100 rounded-lg" />
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-6">
              {/* Hero row: featured accent card + 3 KPIs */}
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                {/* Featured — Total Revenue (like the dark/green highlighted card in refs) */}
                <div className="lg:col-span-1 admin-card admin-card-accent p-6 relative overflow-hidden">
                  <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-white/10 blur-2xl" />
                  <div className="relative">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-9 h-9 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center">
                        <TrendingUp className="w-4 h-4 text-white" />
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-white/70">Total Revenue</span>
                    </div>
                    <p className="text-3xl font-bold text-white leading-none">{formatPrice(stats?.total_revenue || 0)}</p>
                    <p className="text-[11px] text-white/70 mt-2">Rent service fee + withdrawal fee</p>
                    <button
                      onClick={() => setActiveTab('rentora-revenue')}
                      className="mt-5 inline-flex items-center gap-1.5 text-[11px] font-semibold text-white/90 hover:text-white bg-white/10 hover:bg-white/20 backdrop-blur px-3 py-1.5 rounded-full transition"
                    >
                      Analyze performance <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {/* KPI: Users */}
                <div className="admin-card p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center">
                      <Users className="w-4 h-4 text-blue-600" />
                    </div>
                  </div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Users</p>
                  <p className="text-2xl font-bold text-slate-900 mt-1">{stats?.total_users || 0}</p>
                  <p className="text-[11px] text-slate-500 mt-1.5">{stats?.total_agents || 0} agents</p>
                </div>

                {/* KPI: Properties */}
                <div className="admin-card p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center">
                      <Building2 className="w-4 h-4 text-emerald-600" />
                    </div>
                    {stats?.pending_properties > 0 && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                        {stats.pending_properties} pending
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Properties</p>
                  <p className="text-2xl font-bold text-slate-900 mt-1">{stats?.total_properties || 0}</p>
                  <p className="text-[11px] text-slate-500 mt-1.5">{stats?.approved_properties || 0} live</p>
                </div>

                {/* KPI: Inspections */}
                <div className="admin-card p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-9 h-9 rounded-xl bg-violet-50 flex items-center justify-center">
                      <CalendarCheck className="w-4 h-4 text-violet-600" />
                    </div>
                  </div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Inspections</p>
                  <p className="text-2xl font-bold text-slate-900 mt-1">{stats?.total_inspections || 0}</p>
                  <p className="text-[11px] text-slate-500 mt-1.5">{stats?.completed_inspections || 0} completed</p>
                </div>
              </div>

              {/* Escrow highlight strip */}
              <div className="admin-card p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-l-4 border-amber-400">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-amber-100 flex items-center justify-center shrink-0">
                    <Lock className="w-5 h-5 text-amber-700" />
                  </div>
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-amber-700">Escrow Held</p>
                    <p className="text-2xl font-bold text-slate-900">{formatPrice(stats?.total_escrow_held || 0)}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Across {stats?.held_rent_payments || 0} rent payment{stats?.held_rent_payments === 1 ? '' : 's'} awaiting move-in
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  className="rounded-full border-amber-300 text-amber-800 hover:bg-amber-50 gap-1.5 shrink-0"
                  onClick={() => setActiveTab('escrow')}
                >
                  <Eye className="w-3.5 h-3.5" /> View Escrow
                </Button>
              </div>

              {/* Two-column: Revenue split + Attention queue */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Revenue breakdown */}
                <div className="lg:col-span-2 admin-card p-6">
                  <div className="flex items-center justify-between mb-5">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">Rentora Revenue Breakdown</h3>
                      <p className="text-xs text-slate-500 mt-0.5">What the platform actually earns</p>
                    </div>
                    <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700">All-time</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="p-4 rounded-2xl bg-slate-50/70 border border-slate-100">
                      <div className="flex items-center gap-2 mb-2">
                        <Wallet className="w-4 h-4 text-slate-400" />
                        <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Rent Service Fee</p>
                      </div>
                      <p className="text-xl font-bold text-slate-900">{formatPrice(stats?.rent_service_fee_revenue || 0)}</p>
                      <p className="text-[10px] text-slate-400 mt-1">Added on top of rent, never a cut of it</p>
                    </div>
                    <div className="p-4 rounded-2xl bg-slate-50/70 border border-slate-100">
                      <div className="flex items-center gap-2 mb-2">
                        <ArrowDownCircle className="w-4 h-4 text-slate-400" />
                        <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Withdrawal Fee</p>
                      </div>
                      <p className="text-xl font-bold text-slate-900">{formatPrice(stats?.withdrawal_fee_revenue || 0)}</p>
                      <p className="text-[10px] text-slate-400 mt-1">1.3% of every agent withdrawal, once paid</p>
                    </div>
                    <div className="p-4 rounded-2xl bg-slate-50/70 border border-slate-100">
                      <div className="flex items-center gap-2 mb-2">
                        <Receipt className="w-4 h-4 text-slate-400" />
                        <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Inspection Fees</p>
                      </div>
                      <p className="text-xl font-bold text-slate-900">{formatPrice(stats?.inspection_fees_processed || 0)}</p>
                      <p className="text-[10px] text-slate-400 mt-1">100% goes to agents (not Rentora revenue)</p>
                    </div>
                    <div className="p-4 rounded-2xl bg-slate-50/70 border border-slate-100">
                      <div className="flex items-center gap-2 mb-2">
                        <Home className="w-4 h-4 text-slate-400" />
                        <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Rent Transactions</p>
                      </div>
                      <p className="text-xl font-bold text-slate-900">{stats?.total_rent_payments || 0}</p>
                      <p className="text-[10px] text-slate-400 mt-1">{stats?.held_rent_payments || 0} held · {stats?.released_rent_payments || 0} released</p>
                    </div>
                  </div>
                </div>

                {/* Attention queue */}
                <div className="admin-card p-6">
                  <div className="flex items-center justify-between mb-5">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">Needs Attention</h3>
                      <p className="text-xs text-slate-500 mt-0.5">Queued for admin action</p>
                    </div>
                  </div>
                  <div className="space-y-2.5">
                    {[
                      { id: 'verification', label: 'Agent verifications', count: stats?.pending_verifications || 0, icon: Shield, color: 'amber' },
                      { id: 'properties', label: 'Property approvals', count: stats?.pending_properties || 0, icon: Building2, color: 'blue' },
                      { id: 'payouts', label: 'Agent payout requests', count: withdrawalRequests.filter(r => r.status === 'pending').length, icon: ArrowDownCircle, color: 'emerald' },
                      { id: 'messages', label: 'Unread messages', count: messages.filter(m => m.status === 'unread').length, icon: MessageSquare, color: 'rose' },
                    ].map(row => {
                      const Icon = row.icon;
                      const active = row.count > 0;
                      return (
                        <button
                          key={row.id}
                          onClick={() => setActiveTab(row.id)}
                          className={`w-full flex items-center gap-3 p-3 rounded-xl border transition text-left ${
                            active
                              ? 'border-slate-200 bg-white hover:border-primary/40 hover:bg-primary/5'
                              : 'border-slate-100 bg-slate-50/50 opacity-60'
                          }`}
                        >
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center bg-${row.color}-50 shrink-0`}>
                            <Icon className={`w-4 h-4 text-${row.color}-600`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-slate-900 truncate">{row.label}</p>
                            <p className="text-[10px] text-slate-500">{active ? 'Tap to review' : 'All caught up'}</p>
                          </div>
                          {active ? (
                            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-rose-500 text-white">{row.count}</span>
                          ) : (
                            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Bottom activity summary */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="admin-card p-4">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Inspection Tx</p>
                  <p className="text-lg font-bold text-slate-900 mt-1">{transactions.inspection_transactions.length}</p>
                  <p className="text-[10px] text-emerald-600 mt-0.5">{transactions.inspection_transactions.filter(t => t.status === 'completed').length} completed</p>
                </div>
                <div className="admin-card p-4">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Pending Inspections</p>
                  <p className="text-lg font-bold text-slate-900 mt-1">{stats?.pending_inspections || 0}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">awaiting completion</p>
                </div>
                <div className="admin-card p-4">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Approved Listings</p>
                  <p className="text-lg font-bold text-slate-900 mt-1">{stats?.approved_properties || 0}</p>
                  <p className="text-[10px] text-emerald-600 mt-0.5">live on platform</p>
                </div>
                <div className="admin-card p-4">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Rent Payments</p>
                  <p className="text-lg font-bold text-slate-900 mt-1">{stats?.total_rent_payments || 0}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">{stats?.released_rent_payments || 0} released</p>
                </div>
              </div>
            </div>
          )}
        </TabsContent>


        {/* ── Users ── */}
        <TabsContent value="users">
          <div className="mb-4 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search users..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
          </div>
          <div className="sm:hidden space-y-3">
            {filteredUsers.map((u) => (
              <Card key={u.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden shrink-0">
                    {u.avatar_url ? (
                      <img src={u.avatar_url} alt={u.full_name} className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-5 h-5 text-primary" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm truncate">{u.full_name}</p>
                    <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                    <Badge variant={u.suspended ? 'destructive' : 'outline'} className="mt-2 text-xs">{u.suspended ? 'Suspended' : 'Active'}</Badge>
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <Select value={u.role} onValueChange={(value) => handleUpdateRole(u.id, value)} disabled={u.id === user.id}>
                      <SelectTrigger className="w-24 h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="user">User</SelectItem><SelectItem value="agent">Agent</SelectItem><SelectItem value="admin">Admin</SelectItem></SelectContent>
                    </Select>
                    {u.id === user.id ? (
                      <span className="text-xs text-muted-foreground italic px-1">You</span>
                    ) : (
                      <Button variant={u.suspended ? 'outline' : 'destructive'} size="sm" className="h-8 text-xs gap-1" onClick={() => handleSuspendUser(u.id, !u.suspended)}>
                        <Ban className="w-3 h-3" /> {u.suspended ? 'Unsuspend' : 'Suspend'}
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
          <Card className="hidden sm:block overflow-x-auto">
            <Table>
              <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Role</TableHead><TableHead>Status</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
              <TableBody>
                {filteredUsers.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden shrink-0">
                          {u.avatar_url ? (
                            <img src={u.avatar_url} alt={u.full_name} className="w-full h-full object-cover" />
                          ) : (
                            <User className="w-4 h-4 text-primary" />
                          )}
                        </div>
                        {u.full_name}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{u.email}</TableCell>
                    <TableCell>
                      <Select value={u.role} onValueChange={(value) => handleUpdateRole(u.id, value)} disabled={u.id === user.id}>
                        <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="user">User</SelectItem><SelectItem value="agent">Agent</SelectItem><SelectItem value="admin">Admin</SelectItem></SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell><Badge variant={u.suspended ? 'destructive' : 'outline'}>{u.suspended ? 'Suspended' : 'Active'}</Badge></TableCell>
                    <TableCell>{u.id === user.id ? <span className="text-xs text-muted-foreground italic">You</span> : <Button variant={u.suspended ? 'outline' : 'destructive'} size="sm" onClick={() => handleSuspendUser(u.id, !u.suspended)}><Ban className="w-4 h-4" /></Button>}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* ── Agents ── */}
        <TabsContent value="agents">
          {/* Pending Bank Change Requests */}
          {bankRequests.filter(r => r.status === 'pending').length > 0 && (
            <Card className="mb-5 border-orange-200 bg-orange-50/50">
              <div className="p-4 border-b border-orange-200">
                <div className="flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-orange-600" />
                  <h3 className="font-semibold text-orange-800">Pending Bank Change Requests</h3>
                  <Badge className="bg-orange-500 text-white text-xs ml-1">{bankRequests.filter(r => r.status === 'pending').length}</Badge>
                </div>
                <p className="text-xs text-orange-600 mt-0.5">Agents are requesting to update their payout bank details</p>
              </div>
              <div className="divide-y divide-orange-100">
                {bankRequests.filter(r => r.status === 'pending').map(req => {
                  const registeredName = (req.users?.full_name || '').toUpperCase().trim();
                  const acctName = (req.account_name || '').toUpperCase().trim();
                  const rWords = registeredName.split(' ').filter(Boolean);
                  const aWords = acctName.split(' ').filter(Boolean);
                  const matches = rWords.filter(w => aWords.includes(w)).length;
                  const nameMatch = matches >= 2 || (rWords.length === 1 && aWords.includes(rWords[0]));
                  return (
                    <div key={req.id} className="p-4 space-y-3">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div>
                          <p className="font-semibold text-sm">{req.users?.full_name || agents.find(a => a.id === req.user_id)?.full_name || 'Unknown Agent'}</p>
                          <p className="text-xs text-muted-foreground">{req.users?.email || agents.find(a => a.id === req.user_id)?.email} · {new Date(req.created_at).toLocaleString()}</p>
                        </div>
                        <Badge className={nameMatch ? 'bg-green-100 text-green-800 border-green-300' : 'bg-red-100 text-red-800 border-red-300'}>
                          {nameMatch ? '✓ Names match' : '⚠ Name mismatch'}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-white rounded-lg border p-3">
                        <div>
                          <span className="text-muted-foreground block">Registered Name</span>
                          <span className="font-bold">{registeredName || '—'}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block">Account Name</span>
                          <span className={`font-bold ${nameMatch ? 'text-green-700' : 'text-red-700'}`}>{req.account_name}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block">Bank · Account No.</span>
                          <span className="font-semibold">{req.bank_name}</span>
                          <span className="font-mono block">{req.account_number}</span>
                        </div>
                        <div className="flex flex-col gap-1.5 justify-center">
                          <Button size="sm" className="h-7 gap-1 bg-green-600 hover:bg-green-700 text-white text-xs"
                            onClick={() => setSelectedAgent(agents.find(a => a.id === req.user_id) || { id: req.user_id, full_name: req.users?.full_name, email: req.users?.email, verification: verifications.find(v => v.user_id === req.user_id && v.status === 'approved') })}>
                            <Eye className="w-3 h-3" /> View Agent
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}
          <div className="mb-4 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search agents..." value={agentSearch} onChange={(e) => setAgentSearch(e.target.value)} className="pl-10" />
          </div>

          {filteredAgents.length === 0 ? (
            <Card className="p-12 text-center">
              <UserCog className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="font-semibold">No agents yet</p>
              <p className="text-sm text-muted-foreground mt-1">Approved agents will appear here</p>
            </Card>
          ) : (
            <>
              {/* Mobile cards */}
              <div className="sm:hidden space-y-3">
                {filteredAgents.map((a) => {
                  const verification = getAgentVerification(a.id);
                  return (
                    <Card key={a.id} className="p-4">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-sm">{a.full_name}</p>
                          <p className="text-xs text-muted-foreground truncate">{a.email}</p>
                        </div>
                        <Button size="sm" variant="outline" className="h-7 px-2 shrink-0" onClick={() => setSelectedAgent({ ...a, verification })}>
                          <Eye className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                        <span>{getAgentPropertyCount(a.id)} properties</span>
                        <span>{getAgentInspectionCount(a.id)} inspections</span>
                        {verification?.bank_name && <span className="text-green-600 font-medium">✓ Bank linked</span>}
                      </div>
                    </Card>
                  );
                })}
              </div>

              {/* Desktop table */}
              <Card className="hidden sm:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Agent</TableHead>
                      <TableHead>Bank</TableHead>
                      <TableHead>Account Number</TableHead>
                      <TableHead>Account Name</TableHead>
                      <TableHead className="text-center">Properties</TableHead>
                      <TableHead className="text-center">Inspections</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAgents.map((a) => {
                      const verification = getAgentVerification(a.id);
                      return (
                        <TableRow key={a.id}>
                          <TableCell>
                            <p className="font-medium text-sm">{a.full_name}</p>
                            <p className="text-xs text-muted-foreground">{a.email}</p>
                          </TableCell>
                          <TableCell className="text-sm">{verification?.bank_name || <span className="text-muted-foreground/40">—</span>}</TableCell>
                          <TableCell>
                            {verification?.account_number ? (
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono text-sm">{verification.account_number}</span>
                                <button onClick={() => copyToClipboard(verification.account_number, 'Account number')} className="text-muted-foreground hover:text-foreground transition-colors">
                                  <Copy className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : <span className="text-muted-foreground/40">—</span>}
                          </TableCell>
                          <TableCell className="text-sm font-medium">{verification?.account_name || <span className="text-muted-foreground/40">—</span>}</TableCell>
                          <TableCell className="text-center text-sm">{getAgentPropertyCount(a.id)}</TableCell>
                          <TableCell className="text-center text-sm">{getAgentInspectionCount(a.id)}</TableCell>
                          <TableCell>
                            <Button size="sm" variant="outline" className="h-7 px-2 gap-1" onClick={() => setSelectedAgent({ ...a, verification })}>
                              <Eye className="w-3.5 h-3.5" /> View
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </Card>
            </>
          )}
        </TabsContent>

        {/* ── Verification ── */}
        <TabsContent value="verification">
          <div className="space-y-4">
            {verifications.filter(v => v.status === 'pending').length === 0 ? (
              <Card className="p-12 text-center">
                <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto mb-3" />
                <p className="font-semibold text-green-700">All caught up!</p>
                <p className="text-sm text-muted-foreground mt-1">No pending verification requests</p>
              </Card>
            ) : (
              <>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                  {verifications.filter(v => v.status === 'pending').length} pending request{verifications.filter(v => v.status === 'pending').length !== 1 ? 's' : ''}
                </p>
                <div className="space-y-4">
                  {verifications.filter(v => v.status === 'pending').map((v) => {
                    const idName = (v.user_name || '').toUpperCase().trim();
                    const acctName = (v.account_name || '').toUpperCase().trim();
                    const idWords = idName.split(' ').filter(Boolean);
                    const acctWords = acctName.split(' ').filter(Boolean);
                    const matches = idWords.filter(w => acctWords.includes(w)).length;
                    const nameMatch = matches >= 2 || (idWords.length === 1 && acctWords.includes(idWords[0]));
                    return (
                      <Card key={v.id} className="overflow-hidden border-yellow-200">
                        {/* Header */}
                        <div className="flex items-center justify-between gap-3 px-5 py-4 bg-yellow-50/60 border-b border-yellow-200">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center shrink-0">
                              <User className="w-5 h-5 text-yellow-700" />
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-sm">{v.user_name}</p>
                              <p className="text-xs text-muted-foreground truncate">{v.user_email}</p>
                              {v.user_phone && (
                                <a href={`tel:${v.user_phone}`} className="text-xs text-primary font-medium flex items-center gap-1 mt-0.5 hover:underline">
                                  <Phone className="w-3 h-3" /> {v.user_phone}
                                </a>
                              )}
                            </div>
                          </div>
                          <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300 shrink-0">Pending</Badge>
                        </div>

                        <div className="p-5 space-y-4">
                          {/* Address */}
                          {v.address && (
                            <div>
                              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Address</p>
                              <p className="text-sm text-foreground/80">{v.address}</p>
                            </div>
                          )}

                          {/* Bank details */}
                          {v.bank_name && (
                            <div>
                              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Bank Account</p>
                              <div className={`flex items-start gap-2 p-2.5 rounded-lg border text-xs mb-2 ${nameMatch ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                                {nameMatch
                                  ? <CheckCircle2 className="w-3.5 h-3.5 text-green-600 shrink-0 mt-0.5" />
                                  : <AlertTriangle className="w-3.5 h-3.5 text-red-600 shrink-0 mt-0.5" />}
                                <p className={`font-semibold ${nameMatch ? 'text-green-700' : 'text-red-700'}`}>
                                  {nameMatch ? 'Name matches ID' : 'Name mismatch — verify carefully'}
                                </p>
                              </div>
                              <div className="grid grid-cols-3 gap-3 text-xs bg-muted/30 rounded-lg border p-3">
                                <div><span className="text-muted-foreground block mb-0.5">Bank</span><span className="font-semibold">{v.bank_name}</span></div>
                                <div>
                                  <span className="text-muted-foreground block mb-0.5">Account No.</span>
                                  <div className="flex items-center gap-1">
                                    <span className="font-mono font-bold">{v.account_number}</span>
                                    <button onClick={() => copyToClipboard(v.account_number, 'Account number')} className="text-muted-foreground hover:text-primary"><Copy className="w-3 h-3" /></button>
                                  </div>
                                </div>
                                <div><span className="text-muted-foreground block mb-0.5">Account Name</span><span className={`font-bold ${nameMatch ? 'text-green-700' : 'text-red-700'}`}>{v.account_name}</span></div>
                              </div>
                            </div>
                          )}

                          {/* Documents */}
                          <div className="grid grid-cols-2 gap-3">
                            {v.id_card_url && (
                              <div>
                                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">ID Card</p>
                                <a href={v.id_card_url} target="_blank" rel="noreferrer">
                                  <img src={v.id_card_url} alt="ID Card" className="w-full h-32 object-cover rounded-lg border hover:opacity-90 transition-opacity cursor-pointer" />
                                </a>
                              </div>
                            )}
                            {v.selfie_url && (
                              <div>
                                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Selfie with ID</p>
                                <a href={v.selfie_url} target="_blank" rel="noreferrer">
                                  <img src={v.selfie_url} alt="Selfie" className="w-full h-32 object-cover rounded-lg border hover:opacity-90 transition-opacity cursor-pointer" />
                                </a>
                              </div>
                            )}
                          </div>
                          {v.agreement_url && (
                            <a href={v.agreement_url} target="_blank" rel="noreferrer"
                              className="flex items-center gap-3 p-3 rounded-lg border border-primary/30 bg-primary/5 hover:bg-primary/10 transition-colors">
                              <FileText className="w-6 h-6 text-primary shrink-0" />
                              <div><p className="text-sm font-medium text-primary">View Signed Agreement PDF</p><p className="text-xs text-muted-foreground">Opens in new tab</p></div>
                            </a>
                          )}

                          {/* Action buttons */}
                          <div className="flex gap-2 pt-1">
                            <Button className="flex-1 gap-1.5 bg-green-600 hover:bg-green-700 text-white"
                              onClick={() => handleReviewVerification(v.id, 'approved', v)}>
                              <CheckCircle2 className="w-4 h-4" /> Approve
                            </Button>
                            <Button variant="destructive" className="flex-1 gap-1.5"
                              onClick={() => handleReviewVerification(v.id, 'rejected', v)}>
                              <XCircle className="w-4 h-4" /> Reject
                            </Button>
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </TabsContent>

        {/* ── Properties ── */}
        <TabsContent value="properties">
          <div className="space-y-4">
            {properties.filter(p => p.status === 'pending').length > 0 && (
              <div className="mb-2">
                <h3 className="font-semibold mb-3 text-yellow-800 text-sm">⏳ Pending Approval</h3>
                <div className="space-y-3">
                  {properties.filter(p => p.status === 'pending').map((p) => {
                    const dupMatch = p.possible_duplicate_of ? properties.find(x => x.id === p.possible_duplicate_of) : null;
                    return (
                    <Card key={p.id} className="overflow-hidden border-yellow-200">
                      <div className="flex">
                        <img src={p.images?.[0] || 'https://images.pexels.com/photos/3754595/pexels-photo-3754595.jpeg'} alt="" className="w-24 sm:w-32 object-cover flex-shrink-0" style={{ minHeight: '100px' }} />
                        <div className="flex-1 p-3 min-w-0 flex flex-col justify-between" style={{ minHeight: '100px' }}>
                          <div>
                            <h4 className="font-semibold text-sm line-clamp-1">{p.title}</h4>
                            <p className="text-xs text-muted-foreground line-clamp-1">{p.location}</p>
                            {p.address && (
                              <p className="text-xs text-muted-foreground line-clamp-1">{p.address}</p>
                            )}
                            <p className="text-primary font-bold text-sm mt-1">{formatPrice(p.price)}/yr</p>
                            <p className="text-xs text-muted-foreground">By: {p.uploaded_by_agent_name}</p>
                            {dupMatch && (
                              <p className="text-xs text-red-600 font-medium mt-1">
                                ⚠ Possible duplicate of "{dupMatch.title}" by {dupMatch.uploaded_by_agent_name}
                              </p>
                            )}
                          </div>
                          <div className="flex gap-2 mt-2 flex-wrap">
                            <Button size="sm" variant="outline" className="h-7 px-2 text-xs gap-1" onClick={() => setPreviewProperty(p)}><Eye className="w-3 h-3" /> Preview</Button>
                            <Button size="sm" className="h-7 px-2 text-xs gap-1" onClick={() => handleApproveProperty(p.id, 'approved')}><CheckCircle2 className="w-3 h-3" /> Approve</Button>
                            <Button size="sm" variant="destructive" className="h-7 px-2 text-xs gap-1" onClick={() => handleApproveProperty(p.id, 'rejected')}><XCircle className="w-3 h-3" /> Reject</Button>
                            <Button size="sm" variant="outline" className="h-7 px-2 text-xs gap-1" onClick={() => confirmDeleteProperty(p)}><Trash2 className="w-3 h-3" /> Delete</Button>
                          </div>
                        </div>
                      </div>
                    </Card>
                    );
                  })}
                </div>
              </div>
            )}
            <h3 className="font-semibold text-sm mb-3">All Properties</h3>
            <div className="sm:hidden space-y-3">
              {properties.map((p) => (
                <Card key={p.id} className="overflow-hidden">
                  <div className="flex">
                    <img src={p.images?.[0] || 'https://images.pexels.com/photos/3754595/pexels-photo-3754595.jpeg'} alt="" className="w-24 object-cover flex-shrink-0" style={{ minHeight: '96px' }} />
                    <div className="flex-1 p-3 min-w-0 flex flex-col justify-between" style={{ minHeight: '96px' }}>
                      <div>
                        <div className="flex items-start justify-between gap-1">
                          <h4 className="font-semibold text-sm line-clamp-1 flex-1 min-w-0">{p.title}</h4>
                          <Badge className={`${getStatusBadge(p.status)} text-xs shrink-0 capitalize`}>{p.status}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-1">{p.location}</p>
                        <p className="text-xs text-muted-foreground capitalize">{p.property_type} · {formatPrice(p.price)}/yr</p>
                        <p className="text-xs text-muted-foreground">By: {p.uploaded_by_agent_name}</p>
                      </div>
                      <div className="flex gap-1.5 mt-1 flex-wrap">
                        {p.status === 'pending' && (<><Button size="sm" className="h-6 px-2 text-xs" onClick={() => handleApproveProperty(p.id, 'approved')}><CheckCircle2 className="w-3 h-3" /></Button><Button size="sm" variant="outline" className="h-6 px-2 text-xs" onClick={() => handleApproveProperty(p.id, 'rejected')}><XCircle className="w-3 h-3" /></Button></>)}
                        <Button size="sm" variant="destructive" className="h-6 px-2 text-xs" onClick={() => confirmDeleteProperty(p)}><Trash2 className="w-3 h-3" /></Button>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
            <Card className="hidden sm:block overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead>Property</TableHead><TableHead>Type</TableHead><TableHead>Price</TableHead><TableHead>Agent</TableHead><TableHead>Status</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
                <TableBody>{properties.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell><div className="flex items-center gap-3"><img src={p.images?.[0] || 'https://images.pexels.com/photos/3754595/pexels-photo-3754595.jpeg'} alt="" className="w-12 h-12 rounded object-cover shrink-0" /><div className="min-w-0"><p className="font-medium text-sm truncate max-w-[140px]">{p.title}</p><p className="text-xs text-muted-foreground truncate max-w-[140px]">{p.location}</p></div></div></TableCell>
                    <TableCell className="capitalize text-sm">{p.property_type}</TableCell>
                    <TableCell className="text-sm whitespace-nowrap">{formatPrice(p.price)}</TableCell>
                    <TableCell className="text-sm">{p.uploaded_by_agent_name}</TableCell>
                    <TableCell><Badge className={`${getStatusBadge(p.status)} capitalize`}>{p.status}</Badge></TableCell>
                    <TableCell><div className="flex gap-1.5"><Button size="sm" variant="outline" className="h-7 px-2" onClick={() => setPreviewProperty(p)}><Eye className="w-3.5 h-3.5" /></Button>{p.status === 'pending' && (<><Button size="sm" className="h-7 px-2" onClick={() => handleApproveProperty(p.id, 'approved')}><CheckCircle2 className="w-3.5 h-3.5" /></Button><Button size="sm" variant="outline" className="h-7 px-2" onClick={() => handleApproveProperty(p.id, 'rejected')}><XCircle className="w-3.5 h-3.5" /></Button></>)}<Button variant="destructive" size="sm" className="h-7 px-2" onClick={() => confirmDeleteProperty(p)}><Trash2 className="w-3.5 h-3.5" /></Button></div></TableCell>
                  </TableRow>
                ))}</TableBody>
              </Table>
            </Card>
          </div>
        </TabsContent>

        {/* ── Inspections ── */}
        <TabsContent value="inspections">
          <div className="sm:hidden space-y-3">
            {inspections.map((i) => (
              <Card key={i.id} className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm line-clamp-1">{i.property_title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">User: {i.user_name}</p>
                    <p className="text-xs text-muted-foreground">Agent: {i.agent_name || 'Unassigned'}</p>
                    <p className="text-xs text-muted-foreground">Date: {i.inspection_date}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <Badge className={`${getStatusBadge(i.status)} text-xs capitalize`}>{i.status}</Badge>
                    <Badge className={`${getStatusBadge(i.payment_status)} text-xs capitalize`}>{i.payment_status}</Badge>
                  </div>
                </div>
              </Card>
            ))}
          </div>
          <Card className="hidden sm:block overflow-x-auto">
            <Table>
              <TableHeader><TableRow><TableHead>Property</TableHead><TableHead>User</TableHead><TableHead>Agent</TableHead><TableHead>Date</TableHead><TableHead>Status</TableHead><TableHead>Payment</TableHead></TableRow></TableHeader>
              <TableBody>{inspections.map((i) => (
                <TableRow key={i.id}>
                  <TableCell className="font-medium text-sm">{i.property_title}</TableCell>
                  <TableCell className="text-sm">{i.user_name}</TableCell>
                  <TableCell className="text-sm">{i.agent_name || 'Unassigned'}</TableCell>
                  <TableCell className="text-sm">{i.inspection_date}</TableCell>
                  <TableCell><Badge className={getStatusBadge(i.status)}>{i.status}</Badge></TableCell>
                  <TableCell><Badge className={getStatusBadge(i.payment_status)}>{i.payment_status}</Badge></TableCell>
                </TableRow>
              ))}</TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* ── Transactions ── */}
        <TabsContent value="transactions">
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-3">
              <Card className="p-4 bg-blue-50 border-blue-200"><p className="text-xs text-muted-foreground">Inspection Transactions</p><p className="text-2xl font-bold mt-1">{transactions.inspection_transactions.length}</p></Card>
              <Card className="p-4 bg-green-50 border-green-200"><p className="text-xs text-green-700 font-medium">Completed Inspection Tx</p><p className="text-2xl font-bold mt-1 text-green-900">{transactions.inspection_transactions.filter(t => t.status === 'completed').length}</p><p className="text-xs text-green-600 font-medium mt-0.5">{formatPrice(transactions.inspection_transactions.filter(t => t.status === 'completed').reduce((s, t) => s + (t.amount || 0), 0))}</p></Card>
            </div>
            <div>
              <h3 className="font-semibold text-sm mb-3">Inspection Transactions</h3>
              <div className="sm:hidden space-y-3">{transactions.inspection_transactions.map((tx) => (<Card key={tx.id} className="p-4"><div className="flex items-start justify-between gap-2"><div className="min-w-0 flex-1"><p className="font-mono text-xs text-muted-foreground truncate">{tx.reference}</p><p className="text-sm font-bold text-primary mt-1">{formatPrice(tx.amount)}</p></div><div className="flex flex-col items-end gap-1 shrink-0"><Badge className={`${getStatusBadge(tx.status)} text-xs`}>{tx.status}</Badge><p className="text-xs text-muted-foreground">{new Date(tx.created_at).toLocaleDateString()}</p></div></div></Card>))}{transactions.inspection_transactions.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No inspection transactions yet</p>}</div>
              <Card className="hidden sm:block overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Reference</TableHead><TableHead>Amount</TableHead><TableHead>Status</TableHead><TableHead>Date</TableHead></TableRow></TableHeader><TableBody>{transactions.inspection_transactions.map((tx) => (<TableRow key={tx.id}><TableCell className="font-mono text-sm">{tx.reference}</TableCell><TableCell>{formatPrice(tx.amount)}</TableCell><TableCell><Badge className={getStatusBadge(tx.status)}>{tx.status}</Badge></TableCell><TableCell className="text-sm text-muted-foreground">{new Date(tx.created_at).toLocaleDateString()}</TableCell></TableRow>))}</TableBody></Table></Card>
            </div>
          </div>
        </TabsContent>

        {/* ── Messages ── */}
        <TabsContent value="messages">
          {messages.length === 0 ? (
            <Card className="p-12 text-center border-border/60"><div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mx-auto mb-4"><Inbox className="w-7 h-7 text-foreground/30" /></div><h3 className="font-semibold">No Messages Yet</h3><p className="text-sm text-foreground/55 mt-1">Messages submitted via the Contact page will appear here</p></Card>
          ) : (
            <div className="grid sm:grid-cols-5 gap-4">
              <div className="sm:col-span-2 space-y-2">
                {messages.map((m) => (
                  <Card key={m.id} onClick={() => { setSelectedMessage(m); if (m.status === 'unread') handleMarkRead(m.id); }}
                    className={`p-4 cursor-pointer transition-all border ${selectedMessage?.id === m.id ? 'border-primary bg-primary/5' : m.status === 'unread' ? 'border-blue-200 bg-blue-50/40 hover:border-blue-300' : 'border-border/60 hover:border-border'}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">{m.status === 'unread' && <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />}<p className={`text-sm truncate ${m.status === 'unread' ? 'font-bold' : 'font-semibold'}`}>{m.name}</p></div>
                        <p className="text-xs text-foreground/55 truncate mt-0.5">{m.subject}</p>
                        <p className="text-xs text-foreground/40 line-clamp-1 mt-0.5">{m.message}</p>
                      </div>
                      <div className="shrink-0 flex flex-col items-end gap-1"><p className="text-xs text-foreground/40 whitespace-nowrap">{new Date(m.created_at).toLocaleDateString()}</p><Badge className={m.status === 'unread' ? 'bg-blue-100 text-blue-700 text-xs' : 'bg-gray-100 text-gray-600 text-xs'}>{m.status}</Badge></div>
                    </div>
                  </Card>
                ))}
              </div>
              <div className="sm:col-span-3">
                {selectedMessage ? (
                  <Card className="p-6 border-border/60">
                    <div className="flex items-start justify-between gap-3 mb-5">
                      <div className="min-w-0 flex-1"><h3 className="font-bold text-lg leading-tight">{selectedMessage.subject}</h3><p className="text-xs text-foreground/50 mt-1">{new Date(selectedMessage.created_at).toLocaleString()}</p></div>
                      <Button variant="destructive" size="sm" className="h-7 px-2 shrink-0" onClick={() => handleDeleteMessage(selectedMessage.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                    </div>
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/40 mb-5">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0"><User className="w-5 h-5 text-primary" /></div>
                      <div className="min-w-0 flex-1"><p className="font-semibold text-sm">{selectedMessage.name}</p><p className="text-xs text-foreground/55 truncate">{selectedMessage.email}</p></div>
                    </div>
                    <div className="bg-white border border-border/50 rounded-lg p-4 min-h-[120px]"><p className="text-sm text-foreground/80 whitespace-pre-wrap leading-relaxed">{selectedMessage.message}</p></div>
                    {/* Inline reply composer */}
                    <div className="mt-4 space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Reply to {selectedMessage.name}</p>
                      <Textarea
                        value={replyText}
                        onChange={e => setReplyText(e.target.value)}
                        placeholder={`Write your reply to ${selectedMessage.name}...`}
                        rows={4}
                        className="resize-none text-sm"
                      />
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs text-muted-foreground">Sends to: <span className="font-medium">{selectedMessage.email}</span></p>
                        <Button size="sm" className="gap-1.5" onClick={() => handleReply(selectedMessage)} disabled={sendingReply || !replyText.trim()}>
                          <Mail className="w-3.5 h-3.5" />
                          {sendingReply ? 'Sending...' : 'Send Reply'}
                        </Button>
                      </div>
                    </div>
                  </Card>
                ) : (
                  <Card className="p-12 text-center border-border/60"><MailOpen className="w-12 h-12 text-foreground/20 mx-auto mb-3" /><p className="text-sm text-foreground/50">Select a message to read it</p></Card>
                )}
              </div>
            </div>
          )}

        </TabsContent>

        {/* ── Reports Tab ── */}
        <TabsContent value="reports">
          {reports.length === 0 ? (
            <Card className="p-12 text-center border-border/60">
              <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                <Flag className="w-7 h-7 text-foreground/30" />
              </div>
              <h3 className="font-semibold">No Reports Yet</h3>
              <p className="text-sm text-foreground/55 mt-1">Reports users submit from a listing's "Report" button will appear here</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {reports.map((r) => (
                <Card key={r.id} className="p-4 border-border/60">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-1.5">
                        <Badge className={
                          r.status === 'pending' ? 'bg-amber-100 text-amber-800 hover:bg-amber-100'
                          : r.status === 'resolved' ? 'bg-green-100 text-green-700 hover:bg-green-100'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-100'
                        }>{r.status}</Badge>
                        <span className="text-xs text-foreground/40">{new Date(r.created_at).toLocaleString()}</span>
                      </div>
                      <button
                        onClick={() => navigate(`/property/${r.property_id}`)}
                        className="font-semibold text-sm text-primary hover:underline text-left"
                      >
                        {r.property?.title || 'View listing'}
                      </button>
                      {r.property?.location_text && (
                        <p className="text-xs text-foreground/50">{r.property.location_text}</p>
                      )}
                      <p className="text-sm mt-2"><span className="font-medium">Reason:</span> {r.reason}</p>
                      {r.details && <p className="text-sm text-foreground/70 mt-1 whitespace-pre-wrap">{r.details}</p>}
                      <p className="text-xs text-foreground/45 mt-2">
                        Reported by {r.reporter_name || 'a user'}{r.reporter_email ? ` · ${r.reporter_email}` : ''}
                      </p>
                    </div>
                    {r.status === 'pending' && (
                      <div className="flex gap-2 shrink-0">
                        <Button size="sm" variant="outline" onClick={() => handleResolveReport(r.id, 'dismissed')}>Dismiss</Button>
                        <Button size="sm" onClick={() => handleResolveReport(r.id, 'resolved')}>Mark Resolved</Button>
                      </div>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── Payouts Tab ── */}
        <TabsContent value="payouts">
          {/* Summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
            <Card className="p-4">
              <p className="text-sm text-muted-foreground mb-1">Pending Requests</p>
              <p className="text-2xl font-bold text-orange-500">{withdrawalRequests.filter(r => r.status === 'pending').length}</p>
            </Card>
            <Card className="p-4">
              <p className="text-sm text-muted-foreground mb-1">Total Paid Out</p>
              <p className="text-2xl font-bold text-green-600">
                ₦{withdrawalRequests.filter(r => r.status === 'paid').reduce((s, r) => s + Number(r.amount), 0).toLocaleString('en-NG')}
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-sm text-muted-foreground mb-1">Total Agent Earnings</p>
              <p className="text-2xl font-bold">
                ₦{agentBalances.reduce((s, b) => s + Number(b.total_earned || 0), 0).toLocaleString('en-NG')}
              </p>
            </Card>
          </div>

          {/* Pending requests */}
          <h3 className="font-semibold mb-3">Pending Withdrawals</h3>
          {withdrawalRequests.filter(r => r.status === 'pending').length === 0 ? (
            <Card className="p-8 text-center text-muted-foreground mb-6">No pending withdrawal requests</Card>
          ) : (
            <div className="space-y-3 mb-6">
              {withdrawalRequests.filter(r => r.status === 'pending').map(req => {
                const agentBal = agentBalances.find(b => b.agent_id === req.agent_id);
                return (
                  <Card key={req.id} className="p-4">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                      <div className="space-y-1">
                        <p className="font-semibold">{req.agent_name}</p>
                        <p className="text-sm text-muted-foreground">{req.agent_email}</p>
                        <p className="text-lg font-bold text-green-600">₦{Number(req.amount).toLocaleString('en-NG')} <span className="text-xs font-normal text-muted-foreground">requested</span></p>
                        <div className="text-xs text-muted-foreground">
                          Fee (1.3%): -₦{Number(req.fee_amount || 0).toLocaleString('en-NG')}
                        </div>
                        <p className="text-sm font-semibold text-foreground">
                          Pay out: ₦{Number(req.net_amount || (req.amount - (req.fee_amount || 0))).toLocaleString('en-NG')}
                        </p>
                        {agentBal && (
                          <p className="text-xs text-muted-foreground">
                            Available: ₦{(Number(agentBal.total_earned) - Number(agentBal.total_withdrawn)).toLocaleString('en-NG')}
                          </p>
                        )}
                        <div className="mt-2 p-2 rounded bg-muted text-xs space-y-0.5">
                          <p className="font-medium">Bank Details</p>
                          <p>{req.bank_name} — {req.account_number}</p>
                          <p>{req.account_name}</p>
                          <button onClick={() => { navigator.clipboard.writeText(req.account_number); toast.success('Copied!'); }}
                            className="text-primary underline text-xs mt-1">Copy account number</button>
                        </div>
                        <p className="text-xs text-muted-foreground">{new Date(req.requested_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                      </div>
                      <div className="flex flex-col gap-2 shrink-0">
                        <Button size="sm" className="gap-1.5"
                          onClick={async () => {
                            try {
                              await withdrawalAPI.markPaid(req.id, user.id);
                              toast.success('Marked as paid');
                              fetchData();
                            } catch(e) { toast.error(e.message); }
                          }}>
                          <CheckCircle2 className="w-3.5 h-3.5" /> Mark Paid
                        </Button>
                        {rejectingWithdrawal === req.id ? (
                          <div className="space-y-1">
                            <Input placeholder="Reason (optional)" value={rejectNote} onChange={e => setRejectNote(e.target.value)} className="h-8 text-xs" />
                            <div className="flex gap-1">
                              <Button size="sm" variant="destructive" className="flex-1 text-xs"
                                onClick={async () => {
                                  try {
                                    await withdrawalAPI.reject(req.id, user.id, rejectNote);
                                    toast.success('Request rejected');
                                    setRejectingWithdrawal(null);
                                    setRejectNote('');
                                    fetchData();
                                  } catch(e) { toast.error(e.message); }
                                }}>Confirm</Button>
                              <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={() => { setRejectingWithdrawal(null); setRejectNote(''); }}>Cancel</Button>
                            </div>
                          </div>
                        ) : (
                          <Button size="sm" variant="outline" className="gap-1.5 text-destructive border-destructive/40"
                            onClick={() => setRejectingWithdrawal(req.id)}>
                            <XCircle className="w-3.5 h-3.5" /> Reject
                          </Button>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}

          {/* History */}
          <h3 className="font-semibold mb-3">History</h3>
          <Card className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Agent</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {withdrawalRequests.filter(r => r.status !== 'pending').length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No history yet</TableCell></TableRow>
                ) : withdrawalRequests.filter(r => r.status !== 'pending').map(req => (
                  <TableRow key={req.id}>
                    <TableCell className="font-medium">{req.agent_name}</TableCell>
                    <TableCell>₦{Number(req.amount).toLocaleString('en-NG')}</TableCell>
                    <TableCell><Badge className={`capitalize ${req.status === 'paid' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{req.status}</Badge></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(req.requested_at).toLocaleDateString('en-NG')}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{req.notes || '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>



        <TabsContent value="escrow">
          <div className="mb-4 p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800">
            Money currently sitting with Rentora, not yet released. A held payment auto-releases 5 days after payment if the student never confirms move-in.
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
            <Card className="p-4 border-amber-300 bg-amber-50">
              <p className="text-sm text-amber-700 font-medium mb-1">Currently Held</p>
              <p className="text-2xl font-bold text-amber-900">{formatPrice(stats?.total_escrow_held || 0)}</p>
              <p className="text-xs text-amber-600 mt-0.5">{rentPayments.filter(p => p.status === 'held').length} payment(s)</p>
            </Card>
            <Card className="p-4">
              <p className="text-sm text-muted-foreground mb-1">Released All-Time</p>
              <p className="text-2xl font-bold">
                {formatPrice(rentPayments.filter(p => p.status === 'released').reduce((s, p) => s + Number(p.total_amount || 0), 0))}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">{rentPayments.filter(p => p.status === 'released').length} payment(s)</p>
            </Card>
          </div>

          <h3 className="font-semibold mb-3">Currently Held</h3>
          {rentPayments.filter(p => p.status === 'held').length === 0 ? (
            <Card className="p-8 text-center text-muted-foreground mb-6">Nothing currently held in escrow</Card>
          ) : (
            <div className="space-y-3 mb-6">
              {rentPayments.filter(p => p.status === 'held').map(payment => {
                const autoRelease = payment.auto_release_at ? new Date(payment.auto_release_at) : null;
                const daysLeft = autoRelease ? Math.max(0, Math.ceil((autoRelease - new Date()) / (1000 * 60 * 60 * 24))) : null;
                return (
                  <Card key={payment.id} className="p-4 border-amber-200">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <div>
                        <button onClick={() => openPropertyPreviewById(payment.property_id)} className="font-semibold text-primary hover:underline text-left">
                          {payment.property?.title || 'Unknown property'} <span className="text-xs font-normal text-muted-foreground">— {payment.property?.location}</span>
                        </button>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Rent {formatPrice(payment.rent_amount)} + Agent fee {formatPrice(payment.agent_fee)}{payment.caution_fee > 0 ? ` + Caution fee ${formatPrice(payment.caution_fee)}` : ''} + Service fee {formatPrice(payment.service_fee)}
                        </p>
                        {autoRelease && (
                          <p className="text-xs text-amber-700 mt-1">Auto-releases in {daysLeft} day{daysLeft === 1 ? '' : 's'} ({autoRelease.toLocaleDateString('en-NG')})</p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-lg font-bold text-amber-900">{formatPrice(payment.total_amount)}</p>
                        <Badge variant="outline" className="border-amber-400 text-amber-700">Held</Badge>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}

          <h3 className="font-semibold mb-3">Pending Move-In Review</h3>
          {rentPayments.filter(p => p.status === 'move_in_reported').length === 0 ? (
            <Card className="p-8 text-center text-muted-foreground mb-6">No move-ins waiting on review</Card>
          ) : (
            <div className="space-y-3 mb-6">
              {rentPayments.filter(p => p.status === 'move_in_reported').map(payment => (
                <Card key={payment.id} className="p-4 border-blue-200">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      {payment.move_in_photo_url && (
                        <button onClick={() => setMoveInPreview(payment)} className="shrink-0">
                          <img src={payment.move_in_photo_url} alt="Move-in" className="w-14 h-14 rounded object-cover border hover:opacity-80" />
                        </button>
                      )}
                      <div className="min-w-0">
                        <button onClick={() => openPropertyPreviewById(payment.property_id)} className="font-semibold text-primary hover:underline text-left">
                          {payment.property?.title || 'Unknown property'} <span className="text-xs font-normal text-muted-foreground">— {payment.property?.location}</span>
                        </button>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Student: {payment.student?.full_name || 'Unknown'} ({payment.student?.email || '—'})
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Reported {payment.move_in_reported_at ? new Date(payment.move_in_reported_at).toLocaleString('en-NG') : '—'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <p className="text-lg font-bold text-blue-900">{formatPrice(payment.total_amount)}</p>
                        <Badge variant="outline" className="border-blue-400 text-blue-700">Awaiting review</Badge>
                      </div>
                      <Button size="sm" onClick={() => setMoveInPreview(payment)}>Review</Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}

          <h3 className="font-semibold mb-3">Recently Released</h3>
          <Card className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Property</TableHead>
                  <TableHead>Rent</TableHead>
                  <TableHead>Agent Fee</TableHead>
                  <TableHead>Caution Fee</TableHead>
                  <TableHead>Service Fee</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Released</TableHead>
                  <TableHead>Move-in Photo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rentPayments.filter(p => p.status === 'released').length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No released payments yet</TableCell></TableRow>
                ) : rentPayments.filter(p => p.status === 'released').slice(0, 25).map(payment => (
                  <TableRow key={payment.id}>
                    <TableCell className="font-medium">
                      <button onClick={() => openPropertyPreviewById(payment.property_id)} className="text-primary hover:underline text-left">
                        {payment.property?.title || '—'}
                      </button>
                    </TableCell>
                    <TableCell>{formatPrice(payment.rent_amount)}</TableCell>
                    <TableCell>{formatPrice(payment.agent_fee)}</TableCell>
                    <TableCell>{payment.caution_fee > 0 ? formatPrice(payment.caution_fee) : '—'}</TableCell>
                    <TableCell>{formatPrice(payment.service_fee)}</TableCell>
                    <TableCell><Badge className="capitalize bg-green-100 text-green-800">{payment.status}</Badge></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{payment.released_at ? new Date(payment.released_at).toLocaleDateString('en-NG') : '—'}</TableCell>
                    <TableCell>
                      {payment.move_in_photo_url ? (
                        <a href={payment.move_in_photo_url} target="_blank" rel="noopener noreferrer">
                          <img src={payment.move_in_photo_url} alt="Move-in" className="w-10 h-10 rounded object-cover border hover:opacity-80" />
                        </a>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">None</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="rentora-revenue">
          <div className="mb-4 p-3 rounded-lg bg-indigo-50 border border-indigo-200 text-sm text-indigo-800">
            This is Rentora's own money — what the platform actually earns, separate from anything owed to agents. Inspection fees are excluded since agents keep 100% of those.
          </div>

          <Card className="p-6 mb-6 bg-gradient-to-br from-primary to-primary/80 text-white">
            <p className="text-sm opacity-90 mb-1">Total Revenue (All-Time)</p>
            <p className="text-4xl sm:text-5xl font-bold">{formatPrice(stats?.total_revenue || 0)}</p>
            <p className="text-xs opacity-80 mt-2">Rent service fee + withdrawal fee</p>
          </Card>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card className="p-6 border-2 border-secondary/20">
              <div className="w-12 h-12 rounded-full bg-secondary/10 flex items-center justify-center mb-3">
                <Wallet className="w-6 h-6 text-secondary" />
              </div>
              <p className="text-sm text-muted-foreground mb-1">Rent Service Fee</p>
              <p className="text-3xl font-bold">{formatPrice(stats?.rent_service_fee_revenue || 0)}</p>
              <p className="text-xs text-muted-foreground mt-2">Added on top of rent, never a cut of it</p>
            </Card>
            <Card className="p-6 border-2 border-secondary/20">
              <div className="w-12 h-12 rounded-full bg-secondary/10 flex items-center justify-center mb-3">
                <ArrowDownCircle className="w-6 h-6 text-secondary" />
              </div>
              <p className="text-sm text-muted-foreground mb-1">Withdrawal Fee</p>
              <p className="text-3xl font-bold">{formatPrice(stats?.withdrawal_fee_revenue || 0)}</p>
              <p className="text-xs text-muted-foreground mt-2">1.3% of every agent withdrawal, once paid</p>
            </Card>
          </div>

          <Card className="p-4 mt-6">
            <p className="text-sm font-medium mb-2">For reference — money that is NOT Rentora revenue</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div className="flex justify-between p-2 rounded bg-muted/50">
                <span className="text-muted-foreground">Inspection fees processed (100% to agents)</span>
                <span className="font-medium">{formatPrice(stats?.inspection_fees_processed || 0)}</span>
              </div>
              <div className="flex justify-between p-2 rounded bg-muted/50">
                <span className="text-muted-foreground">Currently held in escrow (not yet Rentora's or anyone's)</span>
                <span className="font-medium">{formatPrice(stats?.total_escrow_held || 0)}</span>
              </div>
            </div>
          </Card>
        </TabsContent>
          </Tabs>
        </div>
      </main>

      {/* ── Agent Detail Dialog ── */}
      <Dialog open={!!selectedAgent} onOpenChange={() => setSelectedAgent(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCog className="w-5 h-5 text-primary" /> Agent Profile
            </DialogTitle>
          </DialogHeader>
          {selectedAgent && (() => {
            // Always read live verification from state (not stale snapshot)
            const liveVerification = getAgentVerification(selectedAgent.id || selectedAgent.user_id);
            const agentWithLiveVerif = { ...selectedAgent, verification: liveVerification };
            const selectedAgentData = agentWithLiveVerif;
            // shadow selectedAgent inside dialog with live data
            return (
            <>
            <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
              {/* Basic info */}
              <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/40">
                <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <User className="w-7 h-7 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-base">{selectedAgentData.full_name}</p>
                  <p className="text-sm text-muted-foreground truncate">{selectedAgentData.email}</p>
                  {selectedAgentData.phone && (
                    <a href={`tel:${selectedAgentData.phone}`} className="text-xs text-primary font-medium flex items-center gap-1 mt-1 hover:underline">
                      <Phone className="w-3 h-3" /> {selectedAgentData.phone}
                    </a>
                  )}
                  <Badge className="mt-1.5 bg-green-100 text-green-700 text-xs">✓ Verified Agent</Badge>
                </div>
              </div>

              {/* Verification Documents */}
              {(selectedAgentData.verification?.id_card_url || selectedAgentData.verification?.selfie_url) && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Verification Documents</p>
                  <div className="grid grid-cols-2 gap-3">
                    {selectedAgentData.verification.id_card_url && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">ID Card</p>
                        <a href={selectedAgentData.verification.id_card_url} target="_blank" rel="noreferrer">
                          <img src={selectedAgentData.verification.id_card_url} alt="ID Card"
                            className="w-full h-28 object-cover rounded-lg border hover:opacity-90 transition-opacity cursor-pointer" />
                        </a>
                      </div>
                    )}
                    {selectedAgentData.verification?.selfie_url && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Selfie with ID</p>
                        <a href={selectedAgentData.verification.selfie_url} target="_blank" rel="noreferrer">
                          <img src={selectedAgentData.verification.selfie_url} alt="Selfie"
                            className="w-full h-28 object-cover rounded-lg border hover:opacity-90 transition-opacity cursor-pointer" />
                        </a>
                      </div>
                    )}
                  </div>
                  {selectedAgentData.verification?.agreement_url && (
                    <a href={selectedAgentData.verification.agreement_url} target="_blank" rel="noreferrer"
                      className="flex items-center gap-2.5 p-2.5 rounded-lg border border-primary/30 bg-primary/5 hover:bg-primary/10 transition-colors">
                      <FileText className="w-5 h-5 text-primary shrink-0" />
                      <p className="text-sm font-medium text-primary">View Signed Agreement</p>
                    </a>
                  )}
                </div>
              )}

              {/* Stats */}
              <div className="grid grid-cols-2 gap-3">
                <Card className="p-3 text-center">
                  <p className="text-2xl font-bold text-primary">{getAgentPropertyCount(selectedAgentData.id)}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Properties Listed</p>
                </Card>
                <Card className="p-3 text-center">
                  <p className="text-2xl font-bold text-blue-600">{getAgentInspectionCount(selectedAgentData.id)}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Inspections</p>
                </Card>
              </div>

              {/* Bank details */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Bank Account</p>

                {/* Pending bank change request */}
                {(() => {
                  const agentId = selectedAgentData.id || selectedAgentData.user_id;
                  const pending = bankRequests.find(r => r.user_id === agentId && r.status === 'pending');
                  if (!pending) return null;

                  // Fuzzy name match check
                  const idName = (selectedAgent.full_name || selectedAgentData.verification?.user_name || '').toUpperCase().trim();
                  const acctName = (pending.account_name || '').toUpperCase().trim();
                  const idWords = idName.split(' ').filter(Boolean);
                  const acctWords = acctName.split(' ').filter(Boolean);
                  const matchCount = idWords.filter(w => acctWords.includes(w)).length;
                  const nameMatch = matchCount >= 2 || (idWords.length === 1 && acctWords.includes(idWords[0]));

                  return (
                    <div className="rounded-lg border border-orange-300 bg-orange-50 overflow-hidden">
                      {/* Header */}
                      <div className="flex items-center gap-2 px-4 py-3 bg-orange-100 border-b border-orange-200">
                        <Clock className="w-4 h-4 text-orange-600 shrink-0" />
                        <p className="text-xs font-bold text-orange-700 uppercase tracking-wide flex-1">Pending Bank Change — Verify Identity</p>
                        <span className="text-xs text-orange-500">{new Date(pending.created_at).toLocaleDateString()}</span>
                      </div>

                      <div className="p-4 space-y-4">
                        {/* Name match alert */}
                        <div className={`flex items-start gap-3 p-3 rounded-lg border ${nameMatch ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                          {nameMatch
                            ? <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
                            : <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                          }
                          <div className="min-w-0 flex-1">
                            <p className={`text-xs font-bold ${nameMatch ? 'text-green-700' : 'text-red-700'}`}>
                              {nameMatch ? 'Names appear to match' : 'Name mismatch detected — verify carefully'}
                            </p>
                            <div className="mt-1.5 grid grid-cols-2 gap-2 text-xs">
                              <div>
                                <span className="text-muted-foreground block">Registered Name (ID)</span>
                                <span className="font-bold">{idName || '—'}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground block">Account Name (Bank)</span>
                                <span className="font-bold">{acctName || '—'}</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* ID card image */}
                        {selectedAgentData.verification?.id_card_url && (
                          <div>
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Agent's ID Card</p>
                            <a href={selectedAgentData.verification.id_card_url} target="_blank" rel="noreferrer">
                              <img
                                src={selectedAgentData.verification.id_card_url}
                                alt="ID Card"
                                className="w-full max-h-40 object-contain rounded-lg border bg-muted/20 cursor-pointer hover:opacity-90 transition-opacity"
                              />
                              <p className="text-xs text-primary mt-1 text-center">Click to open full size ↗</p>
                            </a>
                          </div>
                        )}

                        {/* Bank details */}
                        <div className="grid grid-cols-3 gap-3 text-xs bg-white rounded-lg border border-orange-200 p-3">
                          <div>
                            <span className="text-muted-foreground block mb-0.5">Bank</span>
                            <span className="font-semibold">{pending.bank_name}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground block mb-0.5">Account No.</span>
                            <div className="flex items-center gap-1">
                              <span className="font-mono font-bold">{pending.account_number}</span>
                              <button onClick={() => copyToClipboard(pending.account_number, 'Account number')} className="text-muted-foreground hover:text-primary">
                                <Copy className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                          <div>
                            <span className="text-muted-foreground block mb-0.5">Account Name</span>
                            <span className={`font-bold ${nameMatch ? 'text-green-700' : 'text-red-700'}`}>{pending.account_name}</span>
                          </div>
                        </div>

                        {/* Reject reason input — shown when reject is clicked */}
                        {bankRejectId === pending.id && (
                          <div className="space-y-2">
                            <p className="text-xs font-semibold text-red-700">Reason for rejection (shown to agent):</p>
                            <Input
                              value={bankRejectNote}
                              onChange={e => setBankRejectNote(e.target.value)}
                              placeholder="e.g. Account name does not match your registered name on ID"
                              className="text-sm border-red-300 focus:ring-red-400"
                            />
                            <div className="flex gap-2">
                              <Button size="sm" variant="destructive" className="flex-1 h-8 gap-1.5"
                                onClick={() => handleBankRequest(pending.id, 'rejected', bankRejectNote)}>
                                <XCircle className="w-3.5 h-3.5" /> Confirm Rejection
                              </Button>
                              <Button size="sm" variant="outline" className="h-8"
                                onClick={() => { setBankRejectId(null); setBankRejectNote(''); }}>
                                Cancel
                              </Button>
                            </div>
                          </div>
                        )}

                        {/* Action buttons */}
                        {bankRejectId !== pending.id && (
                          <div className="flex gap-2">
                            <Button size="sm" className="flex-1 h-9 gap-1.5 bg-green-600 hover:bg-green-700 text-white"
                              onClick={() => handleBankRequest(pending.id, 'approved')}>
                              <CheckCircle2 className="w-3.5 h-3.5" /> Approve — Names Match
                            </Button>
                            <Button size="sm" variant="destructive" className="flex-1 h-9 gap-1.5"
                              onClick={() => { setBankRejectId(pending.id); setBankRejectNote('Account name does not match the name on your submitted ID. Please resubmit with the correct account.'); }}>
                              <XCircle className="w-3.5 h-3.5" /> Reject — Mismatch
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* Current approved bank details */}
                {selectedAgentData.verification?.bank_name ? (
                  <div className="p-4 rounded-lg border bg-blue-50/50 border-blue-200 space-y-3">
                    <div className="flex items-center gap-2 mb-1">
                      <CreditCard className="w-4 h-4 text-blue-600" />
                      <p className="text-xs font-bold text-blue-700 uppercase tracking-wide">Current Approved Details</p>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Bank</span>
                      <span className="text-sm font-semibold">{selectedAgentData.verification.bank_name}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Account Number</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-bold">{selectedAgentData.verification.account_number}</span>
                        <button onClick={() => copyToClipboard(selectedAgentData.verification.account_number, 'Account number')} className="text-muted-foreground hover:text-primary transition-colors">
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between border-t border-blue-200 pt-3">
                      <span className="text-xs text-muted-foreground">Account Name</span>
                      <span className="text-sm font-bold text-blue-800">{selectedAgentData.verification.account_name}</span>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-lg border border-yellow-200 bg-yellow-50">
                    <p className="text-sm text-yellow-700">No approved bank details on file</p>
                    <p className="text-xs text-yellow-600 mt-0.5">Approve the pending request above to set bank details</p>
                  </div>
                )}
              </div>

              {/* Address */}
              {selectedAgentData.verification?.address && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Address</p>
                  <p className="text-sm p-3 rounded-lg bg-muted/40">{selectedAgentData.verification.address}</p>
                </div>
              )}

              {/* Properties */}
              {getAgentPropertyCount(selectedAgentData.id) > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Listed Properties</p>
                  <div className="space-y-2">
                    {properties.filter(p => p.uploaded_by_agent_id === selectedAgentData.id).map(p => (
                      <div key={p.id} className="flex items-center gap-3 p-2 rounded-lg bg-muted/30">
                        <img src={p.images?.[0] || 'https://images.pexels.com/photos/3754595/pexels-photo-3754595.jpeg'} alt="" className="w-10 h-10 rounded object-cover shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{p.title}</p>
                          <p className="text-xs text-muted-foreground">{formatPrice(p.price)}/yr</p>
                        </div>
                        <Badge className={`${getStatusBadge(p.status)} text-xs capitalize shrink-0`}>{p.status}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <DialogFooter>
              {selectedAgentData?.phone ? (
                <a href={`tel:${selectedAgentData.phone}`}>
                  <Button variant="outline" className="gap-2"><Phone className="w-4 h-4" /> Call Agent</Button>
                </a>
              ) : (
                <a href={`mailto:${selectedAgentData?.email}`} target="_blank" rel="noreferrer">
                  <Button variant="outline" className="gap-2"><Mail className="w-4 h-4" /> Email Agent</Button>
                </a>
              )}
              <Button onClick={() => setSelectedAgent(null)}>Close</Button>
            </DialogFooter>
          </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* ── Verification Review Dialog ── */}
      <Dialog open={!!selectedVerification} onOpenChange={() => setSelectedVerification(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Verification Request</DialogTitle><DialogDescription>Review the agent verification documents</DialogDescription></DialogHeader>
          {selectedVerification && (
            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
              <div className="p-3 rounded-lg bg-muted/40 space-y-1">
                <p className="font-semibold">{selectedVerification.user_name}</p>
                <p className="text-sm text-muted-foreground">{selectedVerification.user_email}</p>
                <p className="text-sm text-muted-foreground mt-1">{selectedVerification.address}</p>
                {selectedVerification.bank_name && (() => {
                  const idName = (selectedVerification.user_name || '').toUpperCase().trim();
                  const acctName = (selectedVerification.account_name || '').toUpperCase().trim();
                  const idWords = idName.split(' ').filter(Boolean);
                  const acctWords = acctName.split(' ').filter(Boolean);
                  const matches = idWords.filter(w => acctWords.includes(w)).length;
                  const nameMatch = matches >= 2 || (idWords.length === 1 && acctWords.includes(idWords[0]));
                  return (
                    <div className="mt-3 pt-3 border-t border-border/40 space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Bank Account</p>
                      <div className={`flex items-start gap-2 p-2 rounded-lg border text-xs ${nameMatch ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                        {nameMatch
                          ? <CheckCircle2 className="w-3.5 h-3.5 text-green-600 shrink-0 mt-0.5" />
                          : <AlertTriangle className="w-3.5 h-3.5 text-red-600 shrink-0 mt-0.5" />}
                        <div>
                          <p className={`font-bold ${nameMatch ? 'text-green-700' : 'text-red-700'}`}>
                            {nameMatch ? 'Names match' : 'Name mismatch — verify carefully'}
                          </p>
                          <p className="text-muted-foreground">ID: <strong>{idName}</strong> · Bank: <strong>{acctName}</strong></p>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-xs bg-white rounded border p-2">
                        <div><span className="text-muted-foreground block">Bank</span><span className="font-semibold">{selectedVerification.bank_name}</span></div>
                        <div>
                          <span className="text-muted-foreground block">Account No.</span>
                          <div className="flex items-center gap-1">
                            <span className="font-mono font-bold">{selectedVerification.account_number}</span>
                            <button onClick={() => copyToClipboard(selectedVerification.account_number, 'Account number')} className="text-muted-foreground hover:text-primary"><Copy className="w-3 h-3" /></button>
                          </div>
                        </div>
                        <div><span className="text-muted-foreground block">Account Name</span><span className={`font-bold ${nameMatch ? 'text-green-700' : 'text-red-700'}`}>{selectedVerification.account_name}</span></div>
                      </div>
                    </div>
                  );
                })()}
              </div>
              <div><p className="text-xs font-medium text-muted-foreground mb-2">ID Card</p><img src={selectedVerification.id_card_url} alt="ID Card" className="w-full max-h-52 object-contain rounded-lg border bg-muted/20" /></div>
              <div><p className="text-xs font-medium text-muted-foreground mb-2">Selfie with ID</p><img src={selectedVerification.selfie_url} alt="Selfie" className="w-full max-h-52 object-contain rounded-lg border bg-muted/20" /></div>
              {selectedVerification.agreement_url ? (
                <div><p className="text-xs font-medium text-muted-foreground mb-2">Signed Agreement</p>
                  <a href={selectedVerification.agreement_url} target="_blank" rel="noreferrer" className="flex items-center gap-3 p-3 rounded-lg border border-primary/30 bg-primary/5 hover:bg-primary/10 transition-colors">
                    <FileText className="w-8 h-8 text-primary shrink-0" />
                    <div><p className="text-sm font-medium text-primary">View Signed Agreement PDF</p><p className="text-xs text-muted-foreground">Click to open in new tab</p></div>
                  </a>
                </div>
              ) : (
                <div className="p-3 rounded-lg border border-yellow-200 bg-yellow-50"><p className="text-xs text-yellow-700 font-medium">⚠ No signed agreement uploaded</p></div>
              )}
            </div>
          )}
          {selectedVerification && (
            <div className="px-1 pb-2">
              <a href={`mailto:${selectedVerification.user_email}?subject=${encodeURIComponent('Your Rentora Agent Verification')}&body=${encodeURIComponent('Hi ' + selectedVerification.user_name + ',\n\n[Write your message here]\n\nBest regards,\nRentora Admin Team')}`}
                target="_blank" rel="noreferrer"
                className="flex items-center gap-2.5 w-full px-4 py-3 rounded-lg border border-border bg-muted/40 hover:bg-muted transition-colors">
                <Mail className="w-4 h-4 text-primary shrink-0" />
                <div className="flex-1 min-w-0"><p className="text-sm font-medium">Email {selectedVerification.user_name}</p><p className="text-xs text-muted-foreground truncate">{selectedVerification.user_email}</p></div>
              </a>
              <p className="text-xs text-muted-foreground text-center mt-1.5">Opens your email client with a pre-filled message</p>
            </div>
          )}
          <DialogFooter className="gap-2 flex-wrap">
            <Button variant="outline" onClick={() => setSelectedVerification(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      {/* ── Property Preview Dialog ── */}
      <Dialog open={!!previewProperty} onOpenChange={() => setPreviewProperty(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-primary" /> Property Preview
            </DialogTitle>
            <DialogDescription>Review property details before approving</DialogDescription>
          </DialogHeader>
          {previewProperty && (
            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
              {/* Image gallery */}
              {previewProperty.images?.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {previewProperty.images.slice(0, 6).map((img, i) => (
                    <a key={i} href={img} target="_blank" rel="noreferrer">
                      <img src={img} alt={`Photo ${i + 1}`}
                        className={`w-full object-cover rounded-lg border hover:opacity-90 transition-opacity cursor-pointer ${i === 0 ? 'col-span-3 max-h-52' : 'max-h-28'}`} />
                    </a>
                  ))}
                </div>
              )}
              {/* Core info */}
              <div className="space-y-1">
                <h2 className="text-lg font-bold">{previewProperty.title}</h2>
                <p className="text-sm text-muted-foreground">{previewProperty.location}</p>
                {previewProperty.address && (
                  <p className="text-sm text-muted-foreground">{previewProperty.address}</p>
                )}
                <div className="flex flex-wrap gap-2 mt-2">
                  <Badge className="bg-primary/10 text-primary capitalize">{previewProperty.property_type}</Badge>
                  <Badge className="bg-green-100 text-green-800 font-bold">{formatPrice(previewProperty.price)}/yr</Badge>
                  {previewProperty.bedrooms && <Badge variant="outline">{previewProperty.bedrooms} bed</Badge>}
                  {previewProperty.bathrooms && <Badge variant="outline">{previewProperty.bathrooms} bath</Badge>}
                </div>
              </div>
              {/* Description */}
              {previewProperty.description && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Description</p>
                  <p className="text-sm text-foreground/80 whitespace-pre-wrap leading-relaxed">{previewProperty.description}</p>
                </div>
              )}
              {/* Amenities */}
              {previewProperty.amenities?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Amenities</p>
                  <div className="flex flex-wrap gap-1.5">
                    {previewProperty.amenities.map((a, i) => (
                      <span key={i} className="text-xs px-2 py-1 rounded-full bg-muted border">{a}</span>
                    ))}
                  </div>
                </div>
              )}
              {/* Pricing & Fees — everything the agent entered */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Pricing &amp; Fees</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="p-2 rounded-lg bg-muted/40">
                    <p className="text-xs text-muted-foreground">Rent (yearly)</p>
                    <p className="font-semibold">{formatPrice(previewProperty.price)}</p>
                  </div>
                  <div className="p-2 rounded-lg bg-muted/40">
                    <p className="text-xs text-muted-foreground">Inspection Fee</p>
                    <p className="font-semibold">{formatPrice(previewProperty.inspection_fee || 3000)}</p>
                  </div>
                  <div className="p-2 rounded-lg bg-muted/40">
                    <p className="text-xs text-muted-foreground">Caution Fee</p>
                    <p className="font-semibold">{previewProperty.caution_fee ? formatPrice(previewProperty.caution_fee) : '—'}</p>
                  </div>
                  <div className="p-2 rounded-lg bg-muted/40">
                    <p className="text-xs text-muted-foreground">Agent Fee (10% of rent)</p>
                    <p className="font-semibold">{formatPrice(Math.round(Number(previewProperty.price || 0) * 0.10))}</p>
                  </div>
                </div>
              </div>
              {/* Contact info the agent provided for this listing */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Listing Contact</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="p-2 rounded-lg bg-muted/40">
                    <p className="text-xs text-muted-foreground">Contact Name</p>
                    <p className="font-semibold">{previewProperty.contact_name || '—'}</p>
                  </div>
                  <div className="p-2 rounded-lg bg-muted/40">
                    <p className="text-xs text-muted-foreground">Contact Phone</p>
                    <p className="font-semibold">{previewProperty.contact_phone || '—'}</p>
                  </div>
                </div>
              </div>
              {/* Property Owner — visible to admin at every stage, including before approval */}
              <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
                <p className="text-xs font-semibold text-blue-800 uppercase tracking-wide mb-2">Property Owner</p>
                {previewProperty.owner_full_name ? (
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">Full Name</p>
                      <p className="font-semibold">{previewProperty.owner_full_name}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Phone</p>
                      <p className="font-semibold">{previewProperty.owner_phone || '—'}</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-red-600 font-medium">Missing — this listing cannot accept a rent payment until the agent adds owner details.</p>
                )}
              </div>
              {/* Status & availability at a glance */}
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="capitalize">Status: {previewProperty.status}</Badge>
                <Badge variant="outline" className="capitalize">Availability: {previewProperty.availability || 'available'}</Badge>
                {previewProperty.availability === 'unavailable' && (
                  <span className="text-xs text-muted-foreground italic">
                    Permanently taken once rent is held or released — cannot be relisted from the dashboard.
                  </span>
                )}
              </div>
              {/* Agent */}
              <div className="p-3 rounded-lg bg-muted/40 flex items-center gap-3">
                <User className="w-8 h-8 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Listed by</p>
                  <p className="font-semibold text-sm">{previewProperty.uploaded_by_agent_name}</p>
                  <p className="text-xs text-muted-foreground">{new Date(previewProperty.created_at).toLocaleDateString()}</p>
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setPreviewProperty(null)}>Close</Button>
            {previewProperty?.status === 'pending' && (<>
              <Button variant="destructive" className="gap-1" onClick={() => { handleApproveProperty(previewProperty.id, 'rejected'); setPreviewProperty(null); }}>
                <XCircle className="w-4 h-4" /> Reject
              </Button>
              <Button className="gap-1" onClick={() => { handleApproveProperty(previewProperty.id, 'approved'); setPreviewProperty(null); }}>
                <CheckCircle2 className="w-4 h-4" /> Approve
              </Button>
            </>)}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation Dialog ── */}
      <Dialog open={deleteConfirm.open} onOpenChange={(open) => !deleteConfirm.deleting && setDeleteConfirm({ open, property: null, deleting: false })}>
        <DialogContent>
          <DialogHeader><DialogTitle className="flex items-center gap-2 text-destructive"><AlertTriangle className="w-5 h-5" /> Delete Property</DialogTitle><DialogDescription>This action cannot be undone.</DialogDescription></DialogHeader>
          {deleteConfirm.property && (
            <div className="flex items-center gap-4 py-2">
              <img src={deleteConfirm.property.images?.[0] || 'https://images.pexels.com/photos/3754595/pexels-photo-3754595.jpeg'} alt="" className="w-20 h-16 rounded-lg object-cover flex-shrink-0" />
              <div><p className="font-semibold">{deleteConfirm.property.title}</p><p className="text-sm text-muted-foreground">{deleteConfirm.property.location}</p><p className="text-sm text-muted-foreground">By: {deleteConfirm.property.uploaded_by_agent_name}</p></div>
            </div>
          )}
          <p className="text-sm text-muted-foreground">Are you sure you want to permanently delete this property? All associated unlocks and inspections will also be removed.</p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteConfirm({ open: false, property: null, deleting: false })} disabled={deleteConfirm.deleting}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteProperty} disabled={deleteConfirm.deleting}>{deleteConfirm.deleting ? 'Deleting...' : 'Yes, Delete'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Move-In Review Dialog ── */}
      <Dialog open={!!moveInPreview} onOpenChange={(open) => { if (!open) setMoveInPreview(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Review Move-In Photo</DialogTitle>
            <DialogDescription>
              Confirming releases {moveInPreview ? formatPrice(moveInPreview.total_amount) : ''} (rent + agent fee{moveInPreview?.caution_fee > 0 ? ' + caution fee' : ''} + service fee) to the agent. This can't be undone.
            </DialogDescription>
          </DialogHeader>
          {moveInPreview && (
            <div className="space-y-3">
              {moveInPreview.move_in_photo_url ? (
                <img src={moveInPreview.move_in_photo_url} alt="Move-in" className="w-full max-h-80 object-contain rounded-lg border bg-muted/30" />
              ) : (
                <p className="text-sm text-muted-foreground italic">No photo was uploaded with this report.</p>
              )}
              <div className="text-sm space-y-0.5">
                <div className="font-semibold">{moveInPreview.property?.title || 'Unknown property'}</div>
                <div className="text-muted-foreground">Student: {moveInPreview.student?.full_name || 'Unknown'} ({moveInPreview.student?.email || '—'})</div>
                <div className="text-muted-foreground">Reference: {moveInPreview.reference}</div>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setMoveInPreview(null)} disabled={confirmingMoveIn}>Close</Button>
            <Button onClick={() => handleAdminConfirmMoveIn(moveInPreview.id)} disabled={confirmingMoveIn}>
              {confirmingMoveIn ? 'Confirming...' : 'Confirm Move-In & Release Funds'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default AdminDashboard;