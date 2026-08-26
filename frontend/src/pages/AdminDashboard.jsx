import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { adminAPI, userAPI, verificationAPI, studentVerificationAPI, propertyAPI, inspectionAPI, transactionAPI, contactAPI, withdrawalAPI, balanceAPI, rentAPI, maintenanceAPI, reportAPI } from '../lib/api';
import { supabase } from '../lib/supabase';
import { sendBroadcast, sendBroadcastEmail } from '../lib/notifications';
import { advertisingAPI, AD_SLOT_SPECS } from '../lib/advertising';
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
  Menu, X, ChevronRight, CalendarCheck, Flag, GraduationCap, FileImage, Megaphone, Send
} from 'lucide-react';
import { toast } from 'sonner';

export function AdminDashboard() {
  const navigate = useNavigate();
  const { user, isAuthenticated, isAdmin } = useAuth();

  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [agents, setAgents] = useState([]);
  const [verifications, setVerifications] = useState([]);
  const [studentVerifications, setStudentVerifications] = useState([]);
  const [studentVerifStatusFilter, setStudentVerifStatusFilter] = useState('pending');
  const [studentVerifSearch, setStudentVerifSearch] = useState('');
  const [studentDocPreview, setStudentDocPreview] = useState(null); // { url, kind: 'image'|'pdf', title }
  const [studentDocPreviewLoading, setStudentDocPreviewLoading] = useState(false);
  const [studentRejectTarget, setStudentRejectTarget] = useState(null); // request being rejected
  const [studentRejectReason, setStudentRejectReason] = useState('');
  const [studentReviewBusy, setStudentReviewBusy] = useState(false);
  const [properties, setProperties] = useState([]);
  const [viewings, setInspections] = useState([]);
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
  const [previewAd, setPreviewAd] = useState(null);
  const [withdrawalRequests, setWithdrawalRequests] = useState([]);
  const [rentPayments, setRentPayments] = useState([]);
  const [refundTarget, setRefundTarget] = useState(null); // held payment being resolved via refund
  const [refundReason, setRefundReason] = useState('unavailable');
  const [refundNote, setRefundNote] = useState('');
  const [refundBusy, setRefundBusy] = useState(false);
  const [agentBalances, setAgentBalances] = useState([]);
  const [rejectingWithdrawal, setRejectingWithdrawal] = useState(null);
  const [rejectNote, setRejectNote] = useState('');
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);

  // Agent invites — invite-only agent applications (see BecomeAgent.jsx)
  const [agentInvites, setAgentInvites] = useState([]);
  const [loadingInvites, setLoadingInvites] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteExpiryDays, setInviteExpiryDays] = useState('7');
  const [generatingInvite, setGeneratingInvite] = useState(false);
  const [resendingInviteId, setResendingInviteId] = useState(null);

  // Broadcasts — admin → all users (or a role) push, shown via the same
  // bell/notifications system as personal notifications. See lib/notifications.js.
  const [broadcasts, setBroadcasts] = useState([]);
  const [loadingBroadcasts, setLoadingBroadcasts] = useState(false);
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastBody, setBroadcastBody] = useState('');
  const [broadcastLink, setBroadcastLink] = useState('');
  const [broadcastTarget, setBroadcastTarget] = useState('all');
  const [sendingBroadcast, setSendingBroadcast] = useState(false);
  // Synchronous guard: a state flag alone can still lose the race against a
  // double-click, which would create two broadcasts (and two email blasts).
  const sendingBroadcastRef = useRef(false);
  const [broadcastAsEmail, setBroadcastAsEmail] = useState(false);
  const [broadcastEmailedIds, setBroadcastEmailedIds] = useState({}); // { [broadcastId]: { sent, recipients } }
  const [broadcastReach, setBroadcastReach] = useState({}); // { [broadcastId]: { total, read } }

  // Advertising — paid adverts awaiting review, plus their full history.
  // Approve/reject go through the security-definer approve_ad / reject_ad
  // RPCs (see the advertising SQL) rather than direct table writes, so the
  // server-side admin-role check can never be bypassed from here.
  const [ads, setAds] = useState([]);
  const [loadingAds, setLoadingAds] = useState(false);
  const [adActionBusyId, setAdActionBusyId] = useState(null);
  // Slot pricing / concurrency cap — admin-editable. Values are whatever
  // ad_slot_config actually returns; we never assume a column exists
  // beyond what getSlotConfig gives us (see updateSlotConfig in
  // lib/advertising.js).
  const [slotConfigs, setSlotConfigs] = useState([]);
  const [loadingSlotConfig, setLoadingSlotConfig] = useState(false);
  const [slotDrafts, setSlotDrafts] = useState({}); // { [slot]: { ...editable fields as strings } }
  const [savingSlot, setSavingSlot] = useState(null);

  useEffect(() => {
    if (!isAuthenticated) { navigate('/login'); return; }
    if (!isAdmin) { toast.error('Access denied'); navigate('/'); return; }
    fetchData();
  }, [isAuthenticated, isAdmin]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchAgentInvites = async () => {
    setLoadingInvites(true);
    try {
      const { data: invites, error } = await supabase
        .from('agent_invites')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      const usedIds = [...new Set((invites || []).map(i => i.used_by).filter(Boolean))];
      let namesById = {};
      if (usedIds.length) {
        const { data: usedUsers } = await supabase.from('users').select('id, full_name, email').in('id', usedIds);
        namesById = Object.fromEntries((usedUsers || []).map(u => [u.id, u]));
      }
      setAgentInvites((invites || []).map(i => ({ ...i, used_by_user: i.used_by ? namesById[i.used_by] : null })));
    } catch (e) {
      console.error('Failed to load agent invites:', e);
    } finally {
      setLoadingInvites(false);
    }
  };

  useEffect(() => {
    if (isAdmin && activeTab === 'agent-invites') fetchAgentInvites();
  }, [isAdmin, activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchBroadcasts = async () => {
    setLoadingBroadcasts(true);
    try {
      const { data, error } = await supabase
        .from('admin_broadcasts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      setBroadcasts(data || []);
      // Reach (read count) is a separate admin-only RPC — fetch it per
      // broadcast rather than joining, since it aggregates across users.
      (data || []).forEach(async (b) => {
        const { data: reach, error: reachErr } = await supabase.rpc('broadcast_reach', { p_broadcast_id: b.id });
        if (!reachErr && reach) setBroadcastReach(prev => ({ ...prev, [b.id]: reach }));
      });
    } catch (e) {
      console.error('Failed to load broadcasts:', e);
    } finally {
      setLoadingBroadcasts(false);
    }
  };

  useEffect(() => {
    if (isAdmin && activeTab === 'broadcasts') fetchBroadcasts();
  }, [isAdmin, activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchAds = async () => {
    setLoadingAds(true);
    try {
      const { data, error } = await supabase
        .from('ads')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      setAds(data || []);
    } catch (e) {
      console.error('Failed to load adverts:', e);
      toast.error('Failed to load adverts');
    } finally {
      setLoadingAds(false);
    }
  };

  const fetchSlotConfig = async () => {
    setLoadingSlotConfig(true);
    try {
      const rows = await advertisingAPI.getSlotConfig();
      setSlotConfigs(rows);
      // ad_slot_config genuinely has both weekly_price/monthly_price AND
      // price_per_week/price_per_month as separate columns — not two names
      // for the same one. Prefer weekly_price/monthly_price for display
      // (matches estimateAdPrice / computeAdTotal's precedence), but saving
      // writes to BOTH pairs so neither one goes stale for any other code
      // path that might read the other pair.
      const drafts = {};
      rows.forEach((row) => {
        drafts[row.slot] = {
          max_concurrent_ads: row.max_concurrent_ads ?? '',
          weekly: row.weekly_price ?? row.price_per_week ?? '',
          monthly: row.monthly_price ?? row.price_per_month ?? '',
        };
      });
      setSlotDrafts(drafts);
    } catch (e) {
      console.error('Failed to load slot config:', e);
      toast.error('Failed to load ad slot config');
    } finally {
      setLoadingSlotConfig(false);
    }
  };

  useEffect(() => {
    if (isAdmin && activeTab === 'advertising') { fetchAds(); fetchSlotConfig(); }
  }, [isAdmin, activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSlotDraftChange = (slot, field, value) => {
    setSlotDrafts((prev) => ({ ...prev, [slot]: { ...prev[slot], [field]: value } }));
  };

  const handleSaveSlotConfig = async (slot) => {
    const draft = slotDrafts[slot];
    if (!draft) return;
    const maxConcurrent = Number(draft.max_concurrent_ads);
    const weekly = Number(draft.weekly);
    const monthly = Number(draft.monthly);
    if (!Number.isFinite(maxConcurrent) || maxConcurrent < 0) { toast.error('Max concurrent ads must be a valid number'); return; }
    if (!Number.isFinite(weekly) || weekly < 0) { toast.error('Weekly price must be a valid number'); return; }
    if (!Number.isFinite(monthly) || monthly < 0) { toast.error('Monthly price must be a valid number'); return; }
    setSavingSlot(slot);
    try {
      const updated = await advertisingAPI.updateSlotConfig(slot, {
        max_concurrent_ads: maxConcurrent,
        weekly_price: weekly,
        price_per_week: weekly,
        monthly_price: monthly,
        price_per_month: monthly,
      });
      setSlotConfigs((prev) => prev.map((row) => (row.slot === slot ? updated : row)));
      toast.success('Slot pricing updated');
    } catch (e) {
      console.error('Failed to update slot config:', e);
      toast.error(e.message || 'Failed to update slot pricing');
    } finally {
      setSavingSlot(null);
    }
  };

  // approve_ad / reject_ad are SECURITY DEFINER functions that re-check the
  // caller is an admin from their own row in `users` — see the advertising
  // SQL. approve_ad additionally requires payment_status IN ('paid',
  // 'completed'), so an unpaid advert can never be approved from here even
  // if this UI had a bug.
  const handleAdDecision = async (adId, decision) => {
    setAdActionBusyId(adId);
    try {
      const { error } = await supabase.rpc(decision === 'approve' ? 'approve_ad' : 'reject_ad', { p_ad_id: adId });
      if (error) throw error;
      setAds((prev) => prev.map((a) => a.id === adId ? { ...a, status: decision === 'approve' ? 'approved' : 'rejected' } : a));
      toast.success(decision === 'approve' ? 'Advert approved' : 'Advert rejected');
    } catch (e) {
      console.error(`Failed to ${decision} ad:`, e);
      toast.error(e.message || `Failed to ${decision === 'approve' ? 'approve' : 'reject'} advert`);
    } finally {
      setAdActionBusyId(null);
    }
  };

  const adDurationLabel = (ad) => {
    if (!ad.starts_at || !ad.ends_at) return '—';
    const days = Math.round((new Date(ad.ends_at) - new Date(ad.starts_at)) / 86400000);
    return `${days} day${days === 1 ? '' : 's'}`;
  };

  // `price` is the server-computed quoted price (set when checkout starts);
  // `amount_paid` is only set once confirm-payment.js has independently
  // verified the Korapay charge. Show whichever is actually known yet.
  const adAmountLabel = (ad) => formatPrice(ad.amount_paid || ad.price || 0);

  const handleSendBroadcast = async () => {
    if (sendingBroadcastRef.current) return; // already sending — ignore the extra click
    if (!broadcastTitle.trim() || !broadcastBody.trim()) {
      toast.error('Add both a title and a message');
      return;
    }
    sendingBroadcastRef.current = true;
    setSendingBroadcast(true);
    const emailToo = broadcastAsEmail;
    const emailPayload = {
      title: broadcastTitle.trim(),
      body: broadcastBody.trim(),
      target: broadcastTarget,
      link: broadcastLink.trim() || null,
    };
    try {
      const broadcastId = await sendBroadcast(broadcastTitle.trim(), broadcastBody.trim(), broadcastTarget, broadcastLink.trim() || null);
      toast.success('Broadcast sent');
      setBroadcastTitle('');
      setBroadcastBody('');
      setBroadcastLink('');
      setBroadcastTarget('all');
      fetchBroadcasts();

      // Fan out to real push subscriptions — best-effort, same pattern as
      // the email calls elsewhere in this file. The in-app broadcast above
      // has already succeeded either way, so a push failure here shouldn't
      // look like the whole send failed.
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const accessToken = session?.access_token;
        const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL || '';
        if (accessToken && SUPABASE_URL) {
          await fetch(`${SUPABASE_URL}/functions/v1/send-push`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` },
            body: JSON.stringify({ broadcast_id: broadcastId }),
          });
        }
      } catch (pushErr) {
        console.warn('send-push failed (non-critical, in-app broadcast already sent):', pushErr);
      }

      // Optional email blast to every matching user's inbox. Server-side it is
      // claimed once per broadcast id, so it can never go out twice.
      if (emailToo) {
        try {
          const result = await sendBroadcastEmail({ broadcastId, ...emailPayload });
          if (result?.already_sent) {
            toast.info('Emails for this broadcast were already sent.');
          } else {
            setBroadcastEmailedIds(prev => ({ ...prev, [broadcastId]: result }));
            toast.success(`Emailed ${result?.sent ?? 0} of ${result?.recipients ?? 0} users${result?.failed ? ` · ${result.failed} failed` : ''}`);
          }
        } catch (emailErr) {
          toast.error(`In-app broadcast sent, but email failed: ${emailErr.message}`);
        }
      }
    } catch (e) {
      toast.error(e.message || 'Failed to send broadcast');
    } finally {
      sendingBroadcastRef.current = false;
      setSendingBroadcast(false);
    }
  };

  const deleteBroadcast = async (broadcastId) => {
    if (!window.confirm('Delete this broadcast for everyone? This cannot be undone.')) return;
    try {
      const { error } = await supabase.from('admin_broadcasts').delete().eq('id', broadcastId);
      if (error) throw error;
      setBroadcasts(prev => prev.filter(b => b.id !== broadcastId));
      toast.success('Broadcast deleted');
    } catch (e) {
      toast.error(e.message || 'Failed to delete broadcast');
    }
  };

  const generateAgentInvite = async () => {
    setGeneratingInvite(true);
    try {
      const code = crypto.randomUUID().replace(/-/g, '').slice(0, 12);
      const days = Math.max(1, parseInt(inviteExpiryDays, 10) || 7);
      const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
      const email = inviteEmail.trim();
      const { error } = await supabase.from('agent_invites').insert({
        code, created_by: user.id, email: email || null, expires_at: expiresAt,
      });
      if (error) throw error;

      if (email) {
        // Best-effort: the invite row is already saved either way, so an
        // email hiccup shouldn't look like the whole action failed — the
        // admin can still copy the link or hit Resend from the list below.
        try {
          await adminAPI.sendAgentInviteEmail({ to: email, link: inviteLink(code), expiresAt, invitedBy: user.full_name });
          toast.success(`Invite sent to ${email}`);
        } catch (emailErr) {
          console.error('Failed to email agent invite:', emailErr);
          toast.error('Invite link created, but the email failed to send. You can copy the link or hit Resend below.');
        }
      } else {
        toast.success('Invite link generated');
      }

      setInviteEmail('');
      await fetchAgentInvites();
    } catch (e) {
      toast.error(e.message || 'Failed to generate invite');
    } finally {
      setGeneratingInvite(false);
    }
  };

  const resendAgentInvite = async (invite) => {
    if (!invite.email) return;
    setResendingInviteId(invite.id);
    try {
      await adminAPI.sendAgentInviteEmail({ to: invite.email, link: inviteLink(invite.code), expiresAt: invite.expires_at, invitedBy: user.full_name });
      toast.success(`Invite resent to ${invite.email}`);
    } catch (e) {
      toast.error(e.message || 'Failed to resend invite email');
    } finally {
      setResendingInviteId(null);
    }
  };

  const revokeAgentInvite = async (invite) => {
    try {
      const { error } = await supabase.from('agent_invites')
        .update({ revoked_at: new Date().toISOString() })
        .eq('id', invite.id);
      if (error) throw error;
      toast.success('Invite revoked');
      await fetchAgentInvites();
    } catch (e) {
      toast.error(e.message || 'Failed to revoke invite');
    }
  };

  const inviteLink = (code) => `${window.location.origin}/become-agent?invite=${code}`;

  const copyInviteLink = (code) => {
    navigator.clipboard.writeText(inviteLink(code))
      .then(() => toast.success('Invite link copied'))
      .catch(() => toast.error('Could not copy link'));
  };

  const shareInviteOnWhatsApp = (code) => {
    window.open(`https://wa.me/?text=${encodeURIComponent('Apply to become a Rentora agent: ' + inviteLink(code))}`, '_blank');
  };

  const inviteStatus = (invite) => {
    if (invite.used_by) return 'used';
    if (invite.revoked_at) return 'revoked';
    if (new Date(invite.expires_at) < new Date()) return 'expired';
    return 'unused';
  };

  const fetchData = async () => {
    setLoading(true);
    await maintenanceAPI.expireStalePending().catch(() => {});
    try {
      const [statsRes, usersRes, verificationsRes, studentVerifsRes, propertiesRes, inspectionsRes, txRes, messagesRes, withdrawalsRes, balancesRes, rentPaymentsRes, reportsRes] = await Promise.all([
        adminAPI.getStats(), userAPI.getAll(), verificationAPI.getAll(), studentVerificationAPI.getAll(),
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
      setStudentVerifications(studentVerifsRes.data || []);
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

  // ── Student verification ─────────────────────────────
  const handlePreviewStudentDoc = async (url, title) => {
    if (!url) return;
    setStudentDocPreviewLoading(true);
    try {
      const signedUrl = await studentVerificationAPI.getSignedDocumentUrl(url);
      const kind = /\.pdf(\?|$)/i.test(url) ? 'pdf' : 'image';
      setStudentDocPreview({ url: signedUrl, kind, title });
    } catch {
      toast.error('Could not load document preview');
    } finally {
      setStudentDocPreviewLoading(false);
    }
  };

  const handleApproveStudent = async (request) => {
    setStudentReviewBusy(true);
    try {
      await studentVerificationAPI.review(request.id, 'approved', user.id);
      toast.success(`${request.user_name || 'Student'} verified ✓`);
      fetchData();
    } catch (e) {
      toast.error(e.message || 'Failed to approve');
    } finally { setStudentReviewBusy(false); }
  };

  const handleRejectStudent = async () => {
    if (!studentRejectTarget) return;
    if (!studentRejectReason.trim()) { toast.error('A rejection reason is required'); return; }
    setStudentReviewBusy(true);
    try {
      await studentVerificationAPI.review(studentRejectTarget.id, 'rejected', user.id, studentRejectReason.trim());
      toast.success('Verification rejected — student notified');
      setStudentRejectTarget(null);
      setStudentRejectReason('');
      fetchData();
    } catch (e) {
      toast.error(e.message || 'Failed to reject');
    } finally { setStudentReviewBusy(false); }
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
  const [selectedReport, setSelectedReport] = useState(null); // report opened in the detail dialog
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

  // Resolving a held payment where the property turned out not to be
  // available/misrepresented: refunds the student in full and takes the
  // listing down for good (not back to 'available'). See
  // /api/admin-refund-payment.js — this button is the only place that
  // endpoint is ever called from.
  const handleResolveRefund = async () => {
    if (!refundTarget) return;
    setRefundBusy(true);
    try {
      await adminAPI.refundRentPayment(refundTarget.id, refundReason, refundNote);
      toast.success('Refund recorded and listing removed.');
      setRefundTarget(null);
      setRefundNote('');
      setRefundReason('unavailable');
      fetchData();
    } catch (e) {
      toast.error(e.message || 'Failed to process refund');
    } finally {
      setRefundBusy(false);
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
      // Show user-friendly error messages
      const errorMessage = error.message || 'Failed to delete property';
      toast.error(errorMessage);
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

      // Persist the reply so it's still visible after a refresh/navigation
      // — previously the email sent but nothing was ever saved, so the
      // reply "disappeared" as far as the admin UI was concerned.
      const sentReplyText = replyText.trim();
      const { data: updated } = await contactAPI.reply(msg.id, sentReplyText, user?.id);
      setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, ...updated } : m));
      setSelectedMessage(prev => prev && prev.id === msg.id ? { ...prev, ...updated } : prev);

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
    viewings.filter(i => i.agent_id === agentId).length;

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
    active: 'bg-green-100 text-green-800',
    pending_review: 'bg-yellow-100 text-yellow-800',
  }[status] || 'bg-gray-100 text-gray-800');

  const filteredUsers = users.filter(u =>
    !searchTerm ||
    u.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // "2h ago" / "3d ago" style label for last_login_at. Falls back to
  // "Never" for users who've never logged in (e.g. imported/legacy rows)
  // and to a full date once it's more than a month ago, since "38d ago"
  // stops being a useful at-a-glance number.
  const formatLastLogin = (value) => {
    if (!value) return 'Never';
    const then = new Date(value);
    const diffMs = Date.now() - then.getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    return then.toLocaleDateString();
  };

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
        { id: 'verification', label: 'Agent Verification', icon: Shield, count: stats?.pending_verifications, urgent: true },
        { id: 'student-verification', label: 'Student ID', icon: GraduationCap, count: studentVerifications.filter(v => v.status === 'pending').length, urgent: true },
        { id: 'agent-invites', label: 'Agent Invites', icon: Mail, count: agentInvites.filter(i => inviteStatus(i) === 'unused').length },
      ],
    },
    { id: 'properties', label: 'Listings', icon: Building2, count: stats?.pending_properties, urgent: true },
    { id: 'inspections', label: 'Bookings', icon: CalendarCheck },
    {
      label: 'Money', icon: Wallet, detail: 'Transactions · Payouts · Escrow',
      items: [
        { id: 'transactions', label: 'Transactions', icon: Receipt },
        { id: 'payouts', label: 'Agent Payouts', icon: ArrowDownCircle, count: withdrawalRequests.filter(r => r.status === 'pending').length, urgent: true },
        { id: 'escrow', label: 'Escrow', icon: Lock, count: rentPayments.filter(p => p.status === 'held' || p.status === 'move_in_reported' || p.status === 'refund_processing').length },
        { id: 'rentora-revenue', label: 'Revenue', icon: TrendingUp },
      ],
    },
    { id: 'messages', label: 'Messages', icon: MessageSquare, count: messages.filter(m => m.status === 'unread').length, urgent: true },
    { id: 'reports', label: 'Reports', icon: Flag, count: reports.filter(r => r.status === 'pending').length, urgent: true },
    { id: 'advertising', label: 'Adverts', icon: Megaphone, count: ads.filter(a => (a.payment_status === 'paid' || a.payment_status === 'completed') && a.status !== 'approved' && a.status !== 'active' && a.status !== 'rejected').length, urgent: true },
    { id: 'broadcasts', label: 'Broadcasts', icon: Megaphone },
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
    <div className="min-h-screen admin-surface" data-testid="admin-dashboard">
      {/* Sidebar + mobile drawer are portalled to <body> so no ancestor
          (sticky/blurred site header, transforms) can clip or hide them. */}
      {createPortal(
        <>
      {/* Mobile nav backdrop */}
      {mobileNavOpen && (
        <button
          onClick={() => setMobileNavOpen(false)}
          className="fixed inset-0 z-40 bg-slate-900/40 lg:hidden"
          aria-label="Close admin navigation"
        />
      )}

      {/* Sidebar — light card style with dark active pill */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-[280px] h-[100dvh] bg-white border-r border-slate-200/70 flex flex-col shadow-xl lg:shadow-none transition-transform lg:translate-x-0 ${mobileNavOpen ? 'translate-x-0' : '-translate-x-full'}`}>
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
        </>,
        document.body
      )}

      {/* Main */}
      <main className="min-w-0 lg:ml-[280px]">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 admin-topbar px-4 py-3 sm:px-8">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => setMobileNavOpen(true)} className="lg:hidden shrink-0 w-9 h-9 rounded-lg border border-slate-200 flex items-center justify-center">
              <Menu className="w-4 h-4" />
            </button>
            <div className="min-w-0">
              <p className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">Section</p>
              <h2 className="text-sm font-semibold text-slate-800 truncate">{activeGroupLabel}</h2>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={() => goTo('messages')} aria-label="Open messages" className="h-9 w-9 rounded-full border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center relative">
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
                  Hello, {firstName} 
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
                    <p className="text-[11px] text-white/70 mt-2">Rent service fee + advertising</p>
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

                {/* KPI: Viewing Requests */}
                <div className="admin-card p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-9 h-9 rounded-xl bg-violet-50 flex items-center justify-center">
                      <CalendarCheck className="w-4 h-4 text-violet-600" />
                    </div>
                  </div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Viewing Requests</p>
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
                        <Megaphone className="w-4 h-4 text-slate-400" />
                        <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Advertising Revenue</p>
                      </div>
                      <p className="text-xl font-bold text-slate-900">{formatPrice(stats?.advertising_revenue || 0)}</p>
                      <p className="text-[10px] text-slate-400 mt-1">Paid sponsored listings and ad slots</p>
                    </div>
                    <div className="p-4 rounded-2xl bg-slate-50/70 border border-slate-100">
                      <div className="flex items-center gap-2 mb-2">
                        <Receipt className="w-4 h-4 text-slate-400" />
                        <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Viewing Fees</p>
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
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Viewing Tx</p>
                  <p className="text-lg font-bold text-slate-900 mt-1">{transactions.inspection_transactions.length}</p>
                  <p className="text-[10px] text-emerald-600 mt-0.5">{transactions.inspection_transactions.filter(t => t.status === 'completed').length} completed</p>
                </div>
                <div className="admin-card p-4">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Pending Viewing Requests</p>
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
                      <img src={u.avatar_url} alt={u.full_name} className="w-full h-full object-cover" loading="lazy" decoding="async" width="800" height="600" />
                    ) : (
                      <User className="w-5 h-5 text-primary" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm truncate">{u.full_name}</p>
                    <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <Badge variant={u.suspended ? 'destructive' : 'outline'} className="text-xs">{u.suspended ? 'Suspended' : 'Active'}</Badge>
                      <span className="text-xs text-muted-foreground">Last login: {formatLastLogin(u.last_login_at)}</span>
                    </div>
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
              <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Role</TableHead><TableHead>Status</TableHead><TableHead>Last Login</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
              <TableBody>
                {filteredUsers.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden shrink-0">
                          {u.avatar_url ? (
                            <img src={u.avatar_url} alt={u.full_name} className="w-full h-full object-cover" loading="lazy" decoding="async" width="800" height="600" />
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
                    <TableCell className="text-sm text-muted-foreground">{formatLastLogin(u.last_login_at)}</TableCell>
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
                            onClick={() => setSelectedAgent(agents.find(a => a.id === req.user_id) || { id: req.user_id, full_name: req.users?.full_name, email: req.users?.email, phone: req.users?.phone, verification: verifications.find(v => v.user_id === req.user_id && v.status === 'approved') })}>
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
                        <span>{getAgentInspectionCount(a.id)} viewings</span>
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
                      <TableHead className="text-center">Viewing Requests</TableHead>
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
                                  <img src={v.id_card_url} alt="ID Card" className="w-full h-32 object-cover rounded-lg border hover:opacity-90 transition-opacity cursor-pointer" loading="lazy" decoding="async" width="800" height="600" />
                                </a>
                              </div>
                            )}
                            {v.selfie_url && (
                              <div>
                                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Selfie with ID</p>
                                <a href={v.selfie_url} target="_blank" rel="noreferrer">
                                  <img src={v.selfie_url} alt="Selfie" className="w-full h-32 object-cover rounded-lg border hover:opacity-90 transition-opacity cursor-pointer" loading="lazy" decoding="async" width="800" height="600" />
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

        {/* ── Student Verification Hub ── */}
        <TabsContent value="student-verification">
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
              <Tabs value={studentVerifStatusFilter} onValueChange={setStudentVerifStatusFilter}>
                <TabsList>
                  <TabsTrigger value="pending">
                    Pending {studentVerifications.filter(v => v.status === 'pending').length > 0 && `(${studentVerifications.filter(v => v.status === 'pending').length})`}
                  </TabsTrigger>
                  <TabsTrigger value="approved">Approved</TabsTrigger>
                  <TabsTrigger value="rejected">Rejected</TabsTrigger>
                  <TabsTrigger value="all">All</TabsTrigger>
                </TabsList>
              </Tabs>
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search name, email, matric no..."
                  value={studentVerifSearch}
                  onChange={(e) => setStudentVerifSearch(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>

            {(() => {
              const q = studentVerifSearch.trim().toLowerCase();
              const filtered = studentVerifications
                .filter(v => studentVerifStatusFilter === 'all' || v.status === studentVerifStatusFilter)
                .filter(v => !q ||
                  v.user_name?.toLowerCase().includes(q) ||
                  v.user_email?.toLowerCase().includes(q) ||
                  v.matric_number?.toLowerCase().includes(q)
                );

              if (filtered.length === 0) {
                return (
                  <Card className="p-12 text-center">
                    <GraduationCap className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
                    <p className="font-semibold">No {studentVerifStatusFilter !== 'all' ? studentVerifStatusFilter : ''} requests</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {studentVerifStatusFilter === 'pending' ? 'All caught up!' : 'Nothing matches this filter yet.'}
                    </p>
                  </Card>
                );
              }

              const statusBadge = (status) => {
                if (status === 'approved') return <Badge className="bg-green-100 text-green-800 border-green-300 shrink-0">Approved</Badge>;
                if (status === 'rejected') return <Badge className="bg-red-100 text-red-800 border-red-300 shrink-0">Rejected</Badge>;
                return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300 shrink-0">Pending</Badge>;
              };

              return (
                <div className="space-y-4">
                  {filtered.map((v) => (
                    <Card key={v.id} className={`overflow-hidden ${v.status === 'pending' ? 'border-yellow-200' : v.status === 'approved' ? 'border-green-200' : 'border-red-200'}`}>
                      <div className={`flex items-center justify-between gap-3 px-5 py-4 border-b ${v.status === 'pending' ? 'bg-yellow-50/60 border-yellow-200' : v.status === 'approved' ? 'bg-green-50/60 border-green-200' : 'bg-red-50/60 border-red-200'}`}>
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                            <GraduationCap className="w-5 h-5 text-foreground/70" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-sm">{v.user_name || 'Unnamed student'}</p>
                            <p className="text-xs text-muted-foreground truncate">{v.user_email}</p>
                            {v.matric_number && <p className="text-xs text-muted-foreground">Matric: {v.matric_number}</p>}
                          </div>
                        </div>
                        {statusBadge(v.status)}
                      </div>

                      <div className="p-5 space-y-4">
                        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                          <span>Document: <span className="font-medium text-foreground/80">{v.document_type === 'admission_letter' ? 'Admission letter' : 'Student ID card'}</span></span>
                          <span>Submitted: {new Date(v.created_at).toLocaleString()}</span>
                          {v.reviewed_at && <span>Reviewed: {new Date(v.reviewed_at).toLocaleString()}</span>}
                        </div>

                        {v.status === 'rejected' && v.admin_note && (
                          <div className="flex items-start gap-2 p-2.5 rounded-lg border border-red-200 bg-red-50 text-xs">
                            <AlertTriangle className="w-3.5 h-3.5 text-red-600 shrink-0 mt-0.5" />
                            <p className="text-red-700"><span className="font-semibold">Rejection reason:</span> {v.admin_note}</p>
                          </div>
                        )}

                        {/* Document + selfie preview triggers */}
                        <div className="grid grid-cols-2 gap-3">
                          <button type="button" onClick={() => handlePreviewStudentDoc(v.document_url, `${v.user_name || 'Student'} — School Document`)}
                            className="flex items-center gap-2 p-3 rounded-lg border hover:bg-muted/50 transition-colors text-left">
                            {/\.pdf(\?|$)/i.test(v.document_url || '') ? <FileText className="w-5 h-5 text-primary shrink-0" /> : <FileImage className="w-5 h-5 text-primary shrink-0" />}
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">School Document</p>
                              <p className="text-xs text-muted-foreground">Click to preview</p>
                            </div>
                          </button>
                          <button type="button" onClick={() => handlePreviewStudentDoc(v.selfie_url, `${v.user_name || 'Student'} — Selfie`)}
                            className="flex items-center gap-2 p-3 rounded-lg border hover:bg-muted/50 transition-colors text-left">
                            <FileImage className="w-5 h-5 text-primary shrink-0" />
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">Selfie</p>
                              <p className="text-xs text-muted-foreground">Click to preview · becomes avatar on approval</p>
                            </div>
                          </button>
                        </div>

                        {v.status === 'pending' && (
                          <div className="flex gap-2 pt-1">
                            <Button className="flex-1 gap-1.5 bg-green-600 hover:bg-green-700 text-white" disabled={studentReviewBusy}
                              onClick={() => handleApproveStudent(v)}>
                              <CheckCircle2 className="w-4 h-4" /> Approve
                            </Button>
                            <Button variant="destructive" className="flex-1 gap-1.5" disabled={studentReviewBusy}
                              onClick={() => { setStudentRejectTarget(v); setStudentRejectReason(''); }}>
                              <XCircle className="w-4 h-4" /> Reject
                            </Button>
                          </div>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              );
            })()}
          </div>
        </TabsContent>

        {/* ── Agent Invites ── */}
        <TabsContent value="agent-invites">
          <div className="space-y-6">
            <Card className="p-5">
              <h3 className="font-semibold mb-1">Generate invite link</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Agent applications are invite-only — nobody can find or guess this page on their own.
                Enter the agent's email to have the invite link emailed to them directly, or leave it
                blank to just generate a link to copy or share on WhatsApp yourself.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <Input
                  placeholder="Agent's email (optional)"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="sm:max-w-xs"
                />
                <Select value={inviteExpiryDays} onValueChange={setInviteExpiryDays}>
                  <SelectTrigger className="sm:w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Expires in 1 day</SelectItem>
                    <SelectItem value="3">Expires in 3 days</SelectItem>
                    <SelectItem value="7">Expires in 7 days</SelectItem>
                    <SelectItem value="30">Expires in 30 days</SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={generateAgentInvite} disabled={generatingInvite} className="gap-2">
                  {generatingInvite ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                  {inviteEmail.trim() ? 'Generate & email invite' : 'Generate invite link'}
                </Button>
              </div>
            </Card>

            <Card className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold">All invites</h3>
                <Button variant="outline" size="sm" onClick={fetchAgentInvites} disabled={loadingInvites} className="gap-2">
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingInvites ? 'animate-spin' : ''}`} /> Refresh
                </Button>
              </div>

              {loadingInvites ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : agentInvites.length === 0 ? (
                <p className="text-sm text-muted-foreground">No invites generated yet.</p>
              ) : (
                <div className="space-y-3">
                  {agentInvites.map((invite) => {
                    const st = inviteStatus(invite);
                    return (
                      <div key={invite.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border p-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{invite.code}</code>
                            {st === 'unused' && <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">Unused</Badge>}
                            {st === 'used' && <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Used</Badge>}
                            {st === 'expired' && <Badge className="bg-gray-100 text-gray-700 hover:bg-gray-100">Expired</Badge>}
                            {st === 'revoked' && <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Revoked</Badge>}
                            {invite.email && <span className="text-xs text-muted-foreground">for {invite.email}</span>}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {st === 'used'
                              ? `Used by ${invite.used_by_user?.full_name || invite.used_by_user?.email || 'unknown'} on ${new Date(invite.used_at).toLocaleDateString()}`
                              : `Expires ${new Date(invite.expires_at).toLocaleDateString()}`}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {st === 'unused' && (
                            <>
                              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => copyInviteLink(invite.code)}>
                                <Copy className="w-3.5 h-3.5" /> Copy
                              </Button>
                              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => shareInviteOnWhatsApp(invite.code)}>
                                WhatsApp
                              </Button>
                              {invite.email && (
                                <Button size="sm" variant="outline" className="gap-1.5" disabled={resendingInviteId === invite.id} onClick={() => resendAgentInvite(invite)}>
                                  {resendingInviteId === invite.id ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />} Resend
                                </Button>
                              )}
                              <Button size="sm" variant="ghost" className="gap-1.5 text-destructive hover:text-destructive" onClick={() => revokeAgentInvite(invite)}>
                                <XCircle className="w-3.5 h-3.5" /> Revoke
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
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
                        <img src={p.images?.[0] || 'https://images.pexels.com/photos/3754595/pexels-photo-3754595.jpeg?auto=compress&cs=tinysrgb&w=800'} alt="" className="w-24 sm:w-32 object-cover flex-shrink-0" style={{ minHeight: '100px' }} loading="lazy" decoding="async" width="800" height="600" />
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
                    <img src={p.images?.[0] || 'https://images.pexels.com/photos/3754595/pexels-photo-3754595.jpeg?auto=compress&cs=tinysrgb&w=800'} alt="" className="w-24 object-cover flex-shrink-0" style={{ minHeight: '96px' }} loading="lazy" decoding="async" width="800" height="600" />
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
                    <TableCell><div className="flex items-center gap-3"><img src={p.images?.[0] || 'https://images.pexels.com/photos/3754595/pexels-photo-3754595.jpeg?auto=compress&cs=tinysrgb&w=800'} alt="" className="w-12 h-12 rounded object-cover shrink-0" loading="lazy" decoding="async" width="800" height="600" /><div className="min-w-0"><p className="font-medium text-sm truncate max-w-[140px]">{p.title}</p><p className="text-xs text-muted-foreground truncate max-w-[140px]">{p.location}</p></div></div></TableCell>
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

        {/* ── Viewing Requests ── */}
        <TabsContent value="inspections">
          <div className="sm:hidden space-y-3">
            {viewings.map((i) => (
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
              <TableBody>{viewings.map((i) => (
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
              <Card className="p-4 bg-blue-50 border-blue-200"><p className="text-xs text-muted-foreground">Viewing Transactions</p><p className="text-2xl font-bold mt-1">{transactions.inspection_transactions.length}</p></Card>
              <Card className="p-4 bg-green-50 border-green-200"><p className="text-xs text-green-700 font-medium">Completed Viewing Tx</p><p className="text-2xl font-bold mt-1 text-green-900">{transactions.inspection_transactions.filter(t => t.status === 'completed').length}</p><p className="text-xs text-green-600 font-medium mt-0.5">{formatPrice(transactions.inspection_transactions.filter(t => t.status === 'completed').reduce((s, t) => s + (t.amount || 0), 0))}</p></Card>
            </div>
            <div>
              <h3 className="font-semibold text-sm mb-3">Viewing Transactions</h3>
              <div className="sm:hidden space-y-3">{transactions.inspection_transactions.map((tx) => (<Card key={tx.id} className="p-4"><div className="flex items-start justify-between gap-2"><div className="min-w-0 flex-1"><p className="font-mono text-xs text-muted-foreground truncate">{tx.reference}</p><p className="text-sm font-bold text-primary mt-1">{formatPrice(tx.amount)}</p></div><div className="flex flex-col items-end gap-1 shrink-0"><Badge className={`${getStatusBadge(tx.status)} text-xs`}>{tx.status}</Badge><p className="text-xs text-muted-foreground">{new Date(tx.created_at).toLocaleDateString()}</p></div></div></Card>))}{transactions.inspection_transactions.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No viewing transactions yet</p>}</div>
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
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-sm">{selectedMessage.name}</p>
                        <p className="text-xs text-foreground/55 truncate">{selectedMessage.email}</p>
                        {selectedMessage.phone && (
                          <a href={`tel:${selectedMessage.phone}`} className="text-xs text-primary flex items-center gap-1 mt-0.5 hover:underline w-fit">
                            <Phone className="w-3 h-3" /> {selectedMessage.phone}
                          </a>
                        )}
                      </div>
                    </div>
                    <div className="bg-white border border-border/50 rounded-lg p-4 min-h-[120px]"><p className="text-sm text-foreground/80 whitespace-pre-wrap leading-relaxed">{selectedMessage.message}</p></div>
                    {/* Previously-sent admin reply, if any */}
                    {selectedMessage.admin_reply && (
                      <div className="mt-4 bg-primary/5 border border-primary/20 rounded-lg p-4">
                        <p className="text-xs font-semibold text-primary uppercase tracking-wide mb-1.5">
                          Your reply · {selectedMessage.replied_at ? new Date(selectedMessage.replied_at).toLocaleString() : ''}
                        </p>
                        <p className="text-sm text-foreground/80 whitespace-pre-wrap leading-relaxed">{selectedMessage.admin_reply}</p>
                      </div>
                    )}
                    {/* Inline reply composer */}
                    <div className="mt-4 space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{selectedMessage.admin_reply ? 'Send another reply' : `Reply to ${selectedMessage.name}`}</p>
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
                <Card key={r.id} onClick={() => setSelectedReport(r)} className="p-4 border-border/60 cursor-pointer hover:border-primary/40 hover:shadow-sm transition">
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
                        onClick={(e) => { e.stopPropagation(); navigate(`/property/${r.property_id}`); }}
                        className="font-semibold text-sm text-primary hover:underline text-left"
                      >
                        {r.property?.title || 'View listing'}
                      </button>
                      {r.property?.location_text && (
                        <p className="text-xs text-foreground/50">{r.property.location_text}</p>
                      )}
                      <p className="text-sm mt-2"><span className="font-medium">Reason:</span> {r.reason}</p>
                      {r.details && <p className="text-sm text-foreground/70 mt-1 line-clamp-2">{r.details}</p>}
                      <p className="text-xs text-foreground/45 mt-2">
                        Reported by {r.reporter_name || 'a user'}{r.reporter_email ? ` · ${r.reporter_email}` : ''}
                      </p>
                    </div>
                    {r.status === 'pending' && (
                      <div className="flex gap-2 shrink-0">
                        <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); handleResolveReport(r.id, 'dismissed'); }}>Dismiss</Button>
                        <Button size="sm" onClick={(e) => { e.stopPropagation(); handleResolveReport(r.id, 'resolved'); }}>Mark Resolved</Button>
                      </div>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── Advertising Tab ── */}
        <TabsContent value="advertising">
          {loadingAds ? (
            <Card className="p-12 text-center border-border/60"><RefreshCw className="w-6 h-6 mx-auto animate-spin text-foreground/30" /></Card>
          ) : ads.length === 0 ? (
            <Card className="p-12 text-center border-border/60">
              <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                <Megaphone className="w-7 h-7 text-foreground/30" />
              </div>
              <h3 className="font-semibold">No Adverts Yet</h3>
              <p className="text-sm text-foreground/55 mt-1">Adverts submitted from the "Advertise" page will appear here once payment is confirmed.</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {/* Mobile cards */}
              <div className="sm:hidden space-y-3">
                {ads.map((ad) => {
                  const canDecide = (ad.payment_status === 'paid' || ad.payment_status === 'completed') && ad.status !== 'approved' && ad.status !== 'active' && ad.status !== 'rejected';
                  return (
                    <Card key={ad.id} className="p-4">
                      <div className="flex gap-3">
                        {ad.image_url && <img src={ad.image_url} alt="" className="w-20 h-14 rounded-md object-cover shrink-0 border border-border/50" />}
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-sm truncate">{ad.business_name || ad.full_name || 'Advertiser'}</p>
                          <p className="text-xs text-muted-foreground truncate">{ad.full_name}{ad.whatsapp_number ? ` · ${ad.whatsapp_number}` : ''}</p>
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            <Badge className={`${getStatusBadge(ad.status)} text-xs`}>{ad.status}</Badge>
                            <Badge className={`${getStatusBadge(ad.payment_status)} text-xs`}>{ad.payment_status}</Badge>
                          </div>
                        </div>
                      </div>
<Button size="sm" variant="outline" className="w-full mt-3" onClick={() => setPreviewAd(ad)}><Eye className="w-4 h-4 mr-1" /> Preview ad</Button>
  <div className="mt-3 grid grid-cols-2 gap-y-1 text-xs text-muted-foreground">
  <span>Slot: <span className="text-foreground">{ad.slot}</span></span>
                        <span>Duration: <span className="text-foreground">{adDurationLabel(ad)}</span></span>
                        <span>Amount: <span className="text-foreground">{adAmountLabel(ad)}</span></span>
                        <span>Clicks: <span className="text-foreground">{ad.clicks ?? 0}</span></span>
                        <span className="col-span-2">Created: {ad.created_at ? new Date(ad.created_at).toLocaleDateString() : '—'}</span>
                      </div>
                      {canDecide && (
                        <div className="flex gap-2 mt-3">
                          <Button size="sm" variant="outline" className="flex-1" disabled={adActionBusyId === ad.id} onClick={() => handleAdDecision(ad.id, 'reject')}>Reject</Button>
                          <Button size="sm" className="flex-1" disabled={adActionBusyId === ad.id} onClick={() => handleAdDecision(ad.id, 'approve')}>Approve</Button>
                        </div>
                      )}
                    </Card>
                  );
                })}
              </div>

              {/* Desktop table */}
              <Card className="hidden sm:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Creative</TableHead>
                      <TableHead>Advertiser</TableHead>
                      <TableHead>Slot</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Payment</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Clicks</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ads.map((ad) => {
                      const canDecide = (ad.payment_status === 'paid' || ad.payment_status === 'completed') && ad.status !== 'approved' && ad.status !== 'active' && ad.status !== 'rejected';
                      return (
                        <TableRow key={ad.id}>
                          <TableCell>
                            {ad.image_url ? <img src={ad.image_url} alt="" className="w-16 h-10 rounded object-cover border border-border/50" /> : <span className="text-xs text-muted-foreground">—</span>}
                          </TableCell>
                          <TableCell>
                            <p className="font-medium text-sm">{ad.business_name || ad.full_name || 'Advertiser'}</p>
                            <p className="text-xs text-muted-foreground">{ad.full_name}{ad.whatsapp_number ? ` · ${ad.whatsapp_number}` : ''}</p>
                          </TableCell>
                          <TableCell className="text-sm">{ad.slot}</TableCell>
                          <TableCell className="text-sm">{adDurationLabel(ad)}</TableCell>
                          <TableCell className="text-sm">{adAmountLabel(ad)}</TableCell>
                          <TableCell><Badge className={getStatusBadge(ad.payment_status)}>{ad.payment_status}</Badge></TableCell>
                          <TableCell><Badge className={getStatusBadge(ad.status)}>{ad.status}</Badge></TableCell>
                          <TableCell className="text-sm">{ad.clicks ?? 0}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{ad.created_at ? new Date(ad.created_at).toLocaleDateString() : '—'}</TableCell>
<TableCell className="text-right">
  <div className="flex gap-2 justify-end">
    <Button size="sm" variant="ghost" onClick={() => setPreviewAd(ad)}><Eye className="w-4 h-4 mr-1" /> Preview</Button>
    {canDecide ? (
      <>
        <Button size="sm" variant="outline" disabled={adActionBusyId === ad.id} onClick={() => handleAdDecision(ad.id, 'reject')}>Reject</Button>
        <Button size="sm" disabled={adActionBusyId === ad.id} onClick={() => handleAdDecision(ad.id, 'approve')}>Approve</Button>
      </>
    ) : (
      <span className="text-xs text-muted-foreground">
        {ad.payment_status === 'pending' ? 'Awaiting payment' : ad.status === 'rejected' ? 'Rejected' : 'Reviewed'}
      </span>
    )}
  </div>
</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </Card>
            </div>
          )}

          {/* Slot Config — pricing & concurrency cap per ad placement */}
          <div className="mt-8">
            <h3 className="font-semibold mb-3">Slot Config</h3>
            {loadingSlotConfig ? (
              <Card className="p-8 text-center border-border/60"><RefreshCw className="w-5 h-5 mx-auto animate-spin text-foreground/30" /></Card>
            ) : slotConfigs.length === 0 ? (
              <Card className="p-6 text-center border-border/60">
                <p className="text-sm text-foreground/55">No ad slots configured yet.</p>
              </Card>
            ) : (
              <div className="grid gap-4 sm:grid-cols-3">
                {slotConfigs.map((row) => {
                  const draft = slotDrafts[row.slot] || {};
                  const label = AD_SLOT_SPECS[row.slot]?.label || row.slot;
                  return (
                    <Card key={row.slot} className="p-4">
                      <p className="font-semibold text-sm mb-3">{label}</p>
                      <label className="block text-xs text-foreground/55 mb-1">Max concurrent ads</label>
                      <Input
                        type="number"
                        min="0"
                        value={draft.max_concurrent_ads}
                        onChange={(e) => handleSlotDraftChange(row.slot, 'max_concurrent_ads', e.target.value)}
                        className="mb-3"
                      />
                      <label className="block text-xs text-foreground/55 mb-1">Price / week (₦)</label>
                      <Input
                        type="number"
                        min="0"
                        value={draft.weekly}
                        onChange={(e) => handleSlotDraftChange(row.slot, 'weekly', e.target.value)}
                        className="mb-3"
                      />
                      <label className="block text-xs text-foreground/55 mb-1">Price / month (₦)</label>
                      <Input
                        type="number"
                        min="0"
                        value={draft.monthly}
                        onChange={(e) => handleSlotDraftChange(row.slot, 'monthly', e.target.value)}
                        className="mb-3"
                      />
                      <Button
                        size="sm"
                        className="w-full"
                        disabled={savingSlot === row.slot}
                        onClick={() => handleSaveSlotConfig(row.slot)}
                      >
                        {savingSlot === row.slot ? 'Saving…' : 'Save'}
                      </Button>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </TabsContent>

        {/* ── Broadcasts Tab ── */}
        <TabsContent value="broadcasts">
          <div className="space-y-6">
            <Card className="p-5">
              <h3 className="font-semibold mb-1">Send a broadcast</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Delivered instantly to the bell icon and /notifications page for every matching user.
                Tick “Also send as email” to deliver the same message to every matching user's inbox as a
                branded Rentora email. Keep it short; shorter reads better in the bell popover.
              </p>
              <div className="space-y-3">
                <Input
                  placeholder="Title (e.g. Scheduled maintenance tonight)"
                  value={broadcastTitle}
                  onChange={(e) => setBroadcastTitle(e.target.value)}
                />
                <Textarea
                  placeholder="Message"
                  value={broadcastBody}
                  onChange={(e) => setBroadcastBody(e.target.value)}
                  rows={3}
                />
                <div className="flex flex-col sm:flex-row gap-3">
                  <Input
                    placeholder="Link when tapped (optional, e.g. /properties)"
                    value={broadcastLink}
                    onChange={(e) => setBroadcastLink(e.target.value)}
                    className="sm:flex-1"
                  />
                  <Select value={broadcastTarget} onValueChange={setBroadcastTarget}>
                    <SelectTrigger className="sm:w-48"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Everyone</SelectItem>
                      <SelectItem value="user">Students only</SelectItem>
                      <SelectItem value="agent">Agents only</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button onClick={handleSendBroadcast} disabled={sendingBroadcast} className="gap-2 sm:w-40">
                    {sendingBroadcast ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    {sendingBroadcast ? 'Sending…' : 'Send'}
                  </Button>
                </div>

                <label className="flex items-start gap-2.5 rounded-lg border bg-slate-50/60 p-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={broadcastAsEmail}
                    onChange={(e) => setBroadcastAsEmail(e.target.checked)}
                    className="mt-0.5 h-4 w-4 accent-primary"
                  />
                  <span className="text-sm">
                    <span className="font-medium">Also send as email</span>
                    <span className="block text-xs text-muted-foreground mt-0.5">
                      One branded email per recipient, sent to every matching user's inbox in batches.
                      Each broadcast can only ever be emailed once, so a double click can't send it twice.
                    </span>
                  </span>
                </label>
              </div>
            </Card>

            <Card className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold">Sent broadcasts</h3>
                <Button variant="outline" size="sm" onClick={fetchBroadcasts} disabled={loadingBroadcasts} className="gap-2">
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingBroadcasts ? 'animate-spin' : ''}`} /> Refresh
                </Button>
              </div>

              {loadingBroadcasts ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : broadcasts.length === 0 ? (
                <p className="text-sm text-muted-foreground">No broadcasts sent yet.</p>
              ) : (
                <div className="space-y-3">
                  {broadcasts.map((b) => {
                    const reach = broadcastReach[b.id];
                    return (
                      <div key={b.id} className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 rounded-lg border p-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm">{b.title}</span>
                            <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-100">
                              {b.target === 'all' ? 'Everyone' : b.target === 'user' ? 'Students' : 'Agents'}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{b.body}</p>
                          <p className="text-xs text-foreground/45 mt-1.5">
                            {new Date(b.created_at).toLocaleString()}
                            {reach ? ` · ${reach.read}/${reach.total} read` : ''}
                            {broadcastEmailedIds[b.id] ? ` · emailed ${broadcastEmailedIds[b.id].sent}` : ''}
                          </p>
                        </div>
                        <Button
                          size="sm" variant="ghost"
                          className="gap-1.5 text-destructive hover:text-destructive shrink-0"
                          onClick={() => deleteBroadcast(b.id)}
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Delete
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </div>
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
                          Fee: ₦0
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
              <p className="text-xs text-amber-600 mt-0.5">{rentPayments.filter(p => p.status === 'held' || p.status === 'refund_processing').length} payment(s)</p>
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
          {rentPayments.filter(p => p.status === 'held' || p.status === 'refund_processing').length === 0 ? (
            <Card className="p-8 text-center text-muted-foreground mb-6">Nothing currently held in escrow</Card>
          ) : (
            <div className="space-y-3 mb-6">
              {rentPayments.filter(p => p.status === 'held' || p.status === 'refund_processing').map(payment => {
                const autoRelease = payment.auto_release_at ? new Date(payment.auto_release_at) : null;
                const daysLeft = autoRelease ? Math.max(0, Math.ceil((autoRelease - new Date()) / (1000 * 60 * 60 * 24))) : null;
                const stuck = payment.status === 'refund_processing';
                return (
                  <Card key={payment.id} className={stuck ? 'p-4 border-red-200' : 'p-4 border-amber-200'}>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <div>
                        <button onClick={() => openPropertyPreviewById(payment.property_id)} className="font-semibold text-primary hover:underline text-left">
                          {payment.property?.title || 'Unknown property'} <span className="text-xs font-normal text-muted-foreground">— {payment.property?.location}</span>
                        </button>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Rent {formatPrice(payment.rent_amount)} + Agency fee {formatPrice(payment.agent_fee)}{payment.agreement_fee > 0 ? ` + Agreement ${formatPrice(payment.agreement_fee)}` : ''}{payment.caution_fee > 0 ? ` + Caution ${formatPrice(payment.caution_fee)}` : ''}{payment.inspection_fee > 0 ? ` + Inspection ${formatPrice(payment.inspection_fee)}` : ''}{payment.documentation_fee > 0 ? ` + Documentation ${formatPrice(payment.documentation_fee)}` : ''}{payment.other_fees_total > 0 ? ` + Other ${formatPrice(payment.other_fees_total)}` : ''} + Service fee {formatPrice(payment.service_fee)}
                        </p>
                        {stuck ? (
                          <p className="text-xs text-red-700 mt-1">A previous refund attempt didn't finish — resolve it to record the refund and remove the listing.</p>
                        ) : autoRelease && (
                          <p className="text-xs text-amber-700 mt-1">Auto-releases in {daysLeft} day{daysLeft === 1 ? '' : 's'} ({autoRelease.toLocaleDateString('en-NG')})</p>
                        )}
                      </div>
                      <div className="text-right shrink-0 flex flex-col items-end gap-1.5">
                        <p className={stuck ? 'text-lg font-bold text-red-900' : 'text-lg font-bold text-amber-900'}>{formatPrice(payment.total_amount)}</p>
                        <Badge variant="outline" className={stuck ? 'border-red-400 text-red-700' : 'border-amber-400 text-amber-700'}>{stuck ? 'Needs resolving' : 'Held'}</Badge>
                        <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => setRefundTarget(payment)}>
                          Resolve
                        </Button>
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
                          <img src={payment.move_in_photo_url} alt="Move-in" className="w-14 h-14 rounded object-cover border hover:opacity-80" loading="lazy" decoding="async" width="800" height="600" />
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
                          <img src={payment.move_in_photo_url} alt="Move-in" className="w-10 h-10 rounded object-cover border hover:opacity-80" loading="lazy" decoding="async" width="800" height="600" />
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

          <h3 className="font-semibold mb-3 mt-6">Refund History</h3>
          <Card className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Property</TableHead>
                  <TableHead>Student</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Refunded By</TableHead>
                  <TableHead>Refunded</TableHead>
                  <TableHead>Note</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rentPayments.filter(p => p.status === 'refunded').length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No refunds issued yet</TableCell></TableRow>
                ) : rentPayments.filter(p => p.status === 'refunded').sort((a, b) => new Date(b.refunded_at || b.created_at) - new Date(a.refunded_at || a.created_at)).slice(0, 25).map(payment => (
                  <TableRow key={payment.id}>
                    <TableCell className="font-medium">
                      <button onClick={() => openPropertyPreviewById(payment.property_id)} className="text-primary hover:underline text-left">
                        {payment.property?.title || '—'}
                      </button>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {payment.student?.full_name || '—'}{payment.student?.email ? ` (${payment.student.email})` : ''}
                    </TableCell>
                    <TableCell>{formatPrice(payment.total_amount)}</TableCell>
                    <TableCell><Badge variant="outline" className="capitalize text-xs">{payment.refund_reason || '—'}</Badge></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{payment.refunded_by || '—'}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{payment.refunded_at ? new Date(payment.refunded_at).toLocaleDateString('en-NG') : '—'}</TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate" title={payment.admin_note || ''}>{payment.admin_note || '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="rentora-revenue">
          <div className="mb-4 p-3 rounded-lg bg-indigo-50 border border-indigo-200 text-sm text-indigo-800">
            This is Rentora's own money — what the platform actually earns, separate from anything owed to agents. Viewing fees are excluded since agents keep 100% of those.
          </div>

          <Card className="p-6 mb-6 bg-gradient-to-br from-primary to-primary/80 text-white">
            <p className="text-sm opacity-90 mb-1">Total Revenue (All-Time)</p>
            <p className="text-4xl sm:text-5xl font-bold">{formatPrice(stats?.total_revenue || 0)}</p>
            <p className="text-xs opacity-80 mt-2">Rent service fee + advertising</p>
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
                <Megaphone className="w-6 h-6 text-secondary" />
              </div>
              <p className="text-sm text-muted-foreground mb-1">Advertising Revenue</p>
              <p className="text-3xl font-bold">{formatPrice(stats?.advertising_revenue || 0)}</p>
              <p className="text-xs text-muted-foreground mt-2">Sponsored listings and local business ad slots</p>
            </Card>
          </div>

          <Card className="p-4 mt-6">
            <p className="text-sm font-medium mb-2">For reference — money that is NOT Rentora revenue</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div className="flex justify-between p-2 rounded bg-muted/50">
                <span className="text-muted-foreground">Viewing fees processed (100% to agents)</span>
                <span className="font-medium">{formatPrice(stats?.inspection_fees_processed || 0)}</span>
              </div>
              <div className="flex justify-between p-2 rounded bg-muted/50">
                <span className="text-muted-foreground">Currently held in escrow (not yet Rentora's or anyone's)</span>
                <span className="font-medium">{formatPrice(stats?.total_escrow_held || 0)}</span>
              </div>
              <div className="flex justify-between p-2 rounded bg-muted/50">
                <span className="text-muted-foreground">Withdrawal fees collected (currently ₦0 fee)</span>
                <span className="font-medium">{formatPrice(stats?.withdrawal_fee_revenue || 0)}</span>
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
                  {selectedAgentData.phone ? (
                    <a href={`tel:${selectedAgentData.phone}`} className="text-xs text-primary font-medium flex items-center gap-1 mt-1 hover:underline">
                      <Phone className="w-3 h-3" /> {selectedAgentData.phone}
                    </a>
                  ) : (
                    <span className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                      <Phone className="w-3 h-3" /> No agent number on file
                    </span>
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
                            className="w-full h-28 object-cover rounded-lg border hover:opacity-90 transition-opacity cursor-pointer" loading="lazy" decoding="async" width="800" height="600" />
                        </a>
                      </div>
                    )}
                    {selectedAgentData.verification?.selfie_url && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Selfie with ID</p>
                        <a href={selectedAgentData.verification.selfie_url} target="_blank" rel="noreferrer">
                          <img src={selectedAgentData.verification.selfie_url} alt="Selfie"
                            className="w-full h-28 object-cover rounded-lg border hover:opacity-90 transition-opacity cursor-pointer" loading="lazy" decoding="async" width="800" height="600" />
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
                  <p className="text-xs text-muted-foreground mt-0.5">Viewing Requests</p>
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
                                className="w-full max-h-40 object-contain rounded-lg border bg-muted/20 cursor-pointer hover:opacity-90 transition-opacity" loading="lazy" decoding="async" width="800" height="600" />
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
                        <img src={p.images?.[0] || 'https://images.pexels.com/photos/3754595/pexels-photo-3754595.jpeg?auto=compress&cs=tinysrgb&w=800'} alt="" className="w-10 h-10 rounded object-cover shrink-0" loading="lazy" decoding="async" width="800" height="600" />
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
              <div><p className="text-xs font-medium text-muted-foreground mb-2">ID Card</p><img src={selectedVerification.id_card_url} alt="ID Card" className="w-full max-h-52 object-contain rounded-lg border bg-muted/20" loading="lazy" decoding="async" width="800" height="600" /></div>
              <div><p className="text-xs font-medium text-muted-foreground mb-2">Selfie with ID</p><img src={selectedVerification.selfie_url} alt="Selfie" className="w-full max-h-52 object-contain rounded-lg border bg-muted/20" loading="lazy" decoding="async" width="800" height="600" /></div>
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


      {/* ── Ad Preview Dialog ── */}
<Dialog open={!!previewAd} onOpenChange={() => setPreviewAd(null)}>
  <DialogContent className="max-w-2xl">
    <DialogHeader><DialogTitle>Advert Preview</DialogTitle><DialogDescription>Review the creative and campaign details before or after approval.</DialogDescription></DialogHeader>
    {previewAd && (
      <div className="flex flex-col gap-4 max-h-[70vh] overflow-y-auto">
        {previewAd.image_url && <img src={previewAd.image_url} alt={previewAd.business_name || 'Advertisement creative'} className="w-full max-h-72 object-contain rounded-lg border bg-muted" />}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div><p className="text-muted-foreground">Advertiser</p><p className="font-medium">{previewAd.full_name || previewAd.business_name || '—'}</p></div>
          <div><p className="text-muted-foreground">Business</p><p className="font-medium">{previewAd.business_name || '—'}</p></div>
          <div><p className="text-muted-foreground">Slot</p><p className="font-medium">{previewAd.slot || '—'}</p></div>
          <div><p className="text-muted-foreground">Status</p><Badge className={getStatusBadge(previewAd.status)}>{previewAd.status}</Badge></div>
          <div><p className="text-muted-foreground">Payment</p><Badge className={getStatusBadge(previewAd.payment_status)}>{previewAd.payment_status}</Badge></div>
          <div><p className="text-muted-foreground">Amount</p><p className="font-medium">{adAmountLabel(previewAd)}</p></div>
        </div>
        {previewAd.ad_text && <div><p className="text-sm text-muted-foreground">Ad copy</p><p className="mt-1 rounded-lg bg-muted p-3 text-sm">{previewAd.ad_text}</p></div>}
        {previewAd.target_url && <a className="text-sm text-primary underline" href={previewAd.target_url} target="_blank" rel="noreferrer">Open destination URL</a>}
      </div>
    )}
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
                        className={`w-full object-cover rounded-lg border hover:opacity-90 transition-opacity cursor-pointer ${i === 0 ? 'col-span-3 max-h-52' : 'max-h-28'}`} loading="lazy" decoding="async" width="800" height="600" />
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
              <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
                <p className="text-xs font-semibold text-blue-800 uppercase tracking-wide mb-2">Pricing &amp; Fees</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="p-3 rounded-lg border border-blue-200">
                    <p className="text-xs text-muted-foreground">Rent (yearly)</p>
                    <p className="font-semibold">{formatPrice(previewProperty.price)}</p>
                  </div>
                  <div className="p-3 rounded-lg border border-blue-200">
                    <p className="text-xs text-muted-foreground">Viewing Fee</p>
                    <p className="font-semibold">{Number(previewProperty.inspection_fee) > 0 ? formatPrice(previewProperty.inspection_fee) : 'Free'}</p>
                  </div>
                  <div className="p-3 rounded-lg border border-blue-200"><p className="text-xs text-muted-foreground">Agreement Fee</p><p className="font-semibold">{formatPrice(previewProperty.agreement_fee || 0)}</p></div>
                  <div className="p-3 rounded-lg border border-blue-200"><p className="text-xs text-muted-foreground">Documentation Fee</p><p className="font-semibold">{formatPrice(previewProperty.documentation_fee || 0)}</p></div>
                  {(previewProperty.other_fees || []).map((fee, i) => <div key={i} className="p-3 rounded-lg border border-blue-200"><p className="text-xs text-muted-foreground">{fee.name || 'Other Fee'}</p><p className="font-semibold">{formatPrice(fee.amount || 0)}</p></div>)}
                  <div className="p-3 rounded-lg border border-blue-200">
                    <p className="text-xs text-muted-foreground">Recurring Payment</p>
                    <p className="font-semibold">{formatPrice(previewProperty.recurring_payment)}</p>
                  </div>
                  <div className="p-3 rounded-lg border border-blue-200">
                    <p className="text-xs text-muted-foreground">Caution Fee</p>
                    <p className="font-semibold">{previewProperty.caution_fee ? formatPrice(previewProperty.caution_fee) : '—'}</p>
                  </div>
                  <div className="p-3 rounded-lg border border-blue-200">
                    <p className="text-xs text-muted-foreground">Agency Fee</p>
                    <p className="font-semibold">{formatPrice(previewProperty.agency_fee || previewProperty.agent_fee || 0)}</p>
                  </div>
                </div>
              </div>
              
              {/* Contact info the agent provided for this listing */}
              <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
                <p className="text-xs font-semibold text-blue-800 uppercase tracking-wide mb-2">Listing Contact</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="p-3 rounded-lg border border-blue-200">
                    <p className="text-xs text-muted-foreground">Contact Name</p>
                    <p className="font-semibold">{previewProperty.contact_name || '—'}</p>
                  </div>
                  <div className="p-3 rounded-lg border border-blue-200">
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
                    <div p-3 rounded-lg border border-blue-200>
                      <p className="text-xs text-muted-foreground">Full Name</p>
                      <p className="font-semibold">{previewProperty.owner_full_name}</p>
                    </div>
                    <div p-3 rounded-lg border border-blue-200>
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
              <img src={deleteConfirm.property.images?.[0] || 'https://images.pexels.com/photos/3754595/pexels-photo-3754595.jpeg?auto=compress&cs=tinysrgb&w=800'} alt="" className="w-20 h-16 rounded-lg object-cover flex-shrink-0" loading="lazy" decoding="async" width="800" height="600" />
              <div><p className="font-semibold">{deleteConfirm.property.title}</p><p className="text-sm text-muted-foreground">{deleteConfirm.property.location}</p><p className="text-sm text-muted-foreground">By: {deleteConfirm.property.uploaded_by_agent_name}</p></div>
            </div>
          )}
          <p className="text-sm text-muted-foreground">Are you sure you want to permanently delete this property? All associated unlocks and viewings will also be removed.</p>
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
                <img src={moveInPreview.move_in_photo_url} alt="Move-in" className="w-full max-h-80 object-contain rounded-lg border bg-muted/30" loading="lazy" decoding="async" width="800" height="600" />
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

      {/* ── Resolve (Refund) Dialog — only reachable from the Resolve
          button on a held payment. Internal-only language ("refund",
          "reject listing") lives here in the admin dashboard; the
          student and agent never see this screen or its wording. ── */}
      <Dialog open={!!refundTarget} onOpenChange={(open) => { if (!open) { setRefundTarget(null); setRefundNote(''); setRefundReason('unavailable'); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resolve held payment</DialogTitle>
            <DialogDescription>
              Send {refundTarget ? formatPrice(refundTarget.total_amount) : ''} back to the student yourself (bank transfer), then confirm below. This records the refund and removes the listing from Rentora for good — it will NOT go back to "available". This can't be undone.
            </DialogDescription>
          </DialogHeader>
          {refundTarget && (
            <div className="space-y-4">
              <div className="text-sm">
                <div className="font-semibold">{refundTarget.property?.title || 'Unknown property'}</div>
                <div className="text-muted-foreground">Student: {refundTarget.student?.full_name || 'Unknown'} ({refundTarget.student?.email || '—'})</div>
                <div className="text-muted-foreground">Reference: {refundTarget.reference}</div>
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Reason</label>
                <Select value={refundReason} onValueChange={setRefundReason}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unavailable">Property is no longer available</SelectItem>
                    <SelectItem value="misrepresented">Listing misrepresented the property</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Internal note (optional)</label>
                <Textarea value={refundNote} onChange={(e) => setRefundNote(e.target.value)} placeholder="Context for the record — not shown to the student." rows={3} />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setRefundTarget(null)} disabled={refundBusy}>Cancel</Button>
            <Button variant="destructive" onClick={handleResolveRefund} disabled={refundBusy}>
              {refundBusy ? 'Recording...' : "I've Sent the Refund — Record & Remove Listing"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Report Detail Dialog ── */}
      <Dialog open={!!selectedReport} onOpenChange={(open) => { if (!open) setSelectedReport(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Listing Report</DialogTitle>
            <DialogDescription>
              {selectedReport ? new Date(selectedReport.created_at).toLocaleString() : ''}
            </DialogDescription>
          </DialogHeader>
          {selectedReport && (
            <div className="space-y-4 text-sm">
              <div className="flex items-center gap-2">
                <Badge className={
                  selectedReport.status === 'pending' ? 'bg-amber-100 text-amber-800 hover:bg-amber-100'
                  : selectedReport.status === 'resolved' ? 'bg-green-100 text-green-700 hover:bg-green-100'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-100'
                }>{selectedReport.status}</Badge>
                <span className="text-xs text-muted-foreground">Reason: {selectedReport.reason}</span>
              </div>

              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Reported listing</p>
                <button
                  onClick={() => { setSelectedReport(null); navigate(`/property/${selectedReport.property_id}`); }}
                  className="font-semibold text-primary hover:underline text-left"
                >
                  {selectedReport.property?.title || 'View listing'}
                </button>
                {selectedReport.property?.location_text && (
                  <p className="text-xs text-muted-foreground">{selectedReport.property.location_text}</p>
                )}
              </div>

              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Message</p>
                <div className="bg-muted/40 border rounded-lg p-3 min-h-[90px]">
                  <p className="whitespace-pre-wrap leading-relaxed text-foreground/85">
                    {selectedReport.details || 'No extra details were provided by the reporter.'}
                  </p>
                </div>
              </div>

              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Reporter</p>
                <p>{selectedReport.reporter_name || 'A user'}</p>
                {selectedReport.reporter_email && (
                  <a href={`mailto:${selectedReport.reporter_email}?subject=${encodeURIComponent('Your Rentora listing report')}`} className="text-xs text-primary hover:underline break-all">
                    {selectedReport.reporter_email}
                  </a>
                )}
              </div>

              {selectedReport.admin_note && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Admin note</p>
                  <p className="text-foreground/80 whitespace-pre-wrap">{selectedReport.admin_note}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setSelectedReport(null)}>Close</Button>
            {selectedReport?.status === 'pending' && (
              <>
                <Button variant="outline" onClick={() => { handleResolveReport(selectedReport.id, 'dismissed'); setSelectedReport(null); }}>Dismiss</Button>
                <Button onClick={() => { handleResolveReport(selectedReport.id, 'resolved'); setSelectedReport(null); }}>Mark Resolved</Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Student document/selfie preview ── */}
      <Dialog open={!!studentDocPreview || studentDocPreviewLoading} onOpenChange={(open) => { if (!open) setStudentDocPreview(null); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{studentDocPreview?.title || 'Loading preview...'}</DialogTitle>
          </DialogHeader>
          <div className="min-h-[300px] flex items-center justify-center bg-muted/30 rounded-lg overflow-hidden">
            {studentDocPreviewLoading && <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />}
            {!studentDocPreviewLoading && studentDocPreview?.kind === 'pdf' && (
              <iframe src={studentDocPreview.url} title={studentDocPreview.title} className="w-full h-[70vh]" />
            )}
            {!studentDocPreviewLoading && studentDocPreview?.kind === 'image' && (
              <img src={studentDocPreview.url} alt={studentDocPreview.title} className="max-w-full max-h-[70vh] object-contain" />
            )}
          </div>
          {studentDocPreview && (
            <a href={studentDocPreview.url} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">
              Open in new tab
            </a>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Student verification reject reason ── */}
      <Dialog open={!!studentRejectTarget} onOpenChange={(open) => { if (!open) { setStudentRejectTarget(null); setStudentRejectReason(''); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reject verification</DialogTitle>
            <DialogDescription>
              {studentRejectTarget?.user_name || 'This student'} will be notified by email and can resubmit their documents.
            </DialogDescription>
          </DialogHeader>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Reason (required, shown to the student)</label>
            <Textarea
              value={studentRejectReason}
              onChange={(e) => setStudentRejectReason(e.target.value)}
              placeholder="e.g. The ID card photo is blurry — please resubmit a clearer photo."
              rows={4}
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setStudentRejectTarget(null); setStudentRejectReason(''); }}>Cancel</Button>
            <Button variant="destructive" disabled={studentReviewBusy || !studentRejectReason.trim()} onClick={handleRejectStudent}>
              {studentReviewBusy ? 'Rejecting...' : 'Reject & Notify'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default AdminDashboard;