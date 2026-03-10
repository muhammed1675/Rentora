import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { adminAPI, userAPI, verificationAPI, propertyAPI, inspectionAPI, transactionAPI, contactAPI } from '../lib/api';
import { supabase } from '../lib/supabase';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import {
  LayoutDashboard, Users, Shield, Building2, Calendar, Receipt,
  CheckCircle2, XCircle, Eye, Ban, UserCheck, TrendingUp, Coins,
  Search, RefreshCw, Trash2, AlertTriangle, User, FileText,
  MessageSquare, Mail, Inbox, MailOpen, UserCog, Copy, Phone, CreditCard, Clock
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
  const [transactions, setTransactions] = useState({ token_transactions: [], inspection_transactions: [] });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedVerification, setSelectedVerification] = useState(null);
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [agentSearch, setAgentSearch] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState({ open: false, property: null, deleting: false });
  const [messages, setMessages] = useState([]);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [bankRequests, setBankRequests] = useState([]);
  const [bankRejectNote, setBankRejectNote] = useState('');
  const [bankRejectId, setBankRejectId] = useState(null);
  const [agentBankDetails, setAgentBankDetails] = useState([]);
  const [previewProperty, setPreviewProperty] = useState(null);

  useEffect(() => {
    if (!isAuthenticated) { navigate('/login'); return; }
    if (!isAdmin) { toast.error('Access denied'); navigate('/'); return; }
    fetchData();
  }, [isAuthenticated, isAdmin]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchData = async () => {
    setLoading(true);
    try {
      const [statsRes, usersRes, verificationsRes, propertiesRes, inspectionsRes, txRes, messagesRes] = await Promise.all([
        adminAPI.getStats(), userAPI.getAll(), verificationAPI.getAll(),
        propertyAPI.getAllAdmin(), inspectionAPI.getAll(), transactionAPI.getAll(),
        contactAPI.getAll(),
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

  return (
    <div className="container mx-auto px-4 py-6" data-testid="admin-dashboard">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Admin Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage users, properties, and operations</p>
        </div>
        <Button onClick={fetchData} variant="outline" size="sm" className="gap-2">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">Refresh</span>
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="overflow-x-auto mb-6 -mx-4 px-4">
          <TabsList className="inline-flex w-auto min-w-full sm:min-w-0 gap-1 h-auto p-1">
            <TabsTrigger value="overview" className="flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm whitespace-nowrap">
              <LayoutDashboard className="w-4 h-4 shrink-0" /> Overview
            </TabsTrigger>
            <TabsTrigger value="users" className="flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm whitespace-nowrap">
              <Users className="w-4 h-4 shrink-0" /> Users
              {users.length > 0 && <Badge variant="secondary" className="ml-1 text-xs px-1.5">{users.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="agents" className="flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm whitespace-nowrap">
              <UserCog className="w-4 h-4 shrink-0" /> Agents
              {agents.length > 0 && <Badge variant="secondary" className="ml-1 text-xs px-1.5">{agents.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="verification" className="flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm whitespace-nowrap">
              <Shield className="w-4 h-4 shrink-0" /> Verify
              {stats?.pending_verifications > 0 && <Badge variant="destructive" className="ml-1 text-xs px-1.5">{stats.pending_verifications}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="properties" className="flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm whitespace-nowrap">
              <Building2 className="w-4 h-4 shrink-0" /> Properties
              {stats?.pending_properties > 0 && <Badge variant="destructive" className="ml-1 text-xs px-1.5">{stats.pending_properties}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="inspections" className="flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm whitespace-nowrap">
              <Calendar className="w-4 h-4 shrink-0" /> Inspections
            </TabsTrigger>
            <TabsTrigger value="transactions" className="flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm whitespace-nowrap">
              <Receipt className="w-4 h-4 shrink-0" /> Transactions
            </TabsTrigger>
            <TabsTrigger value="messages" className="flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm whitespace-nowrap">
              <MessageSquare className="w-4 h-4 shrink-0" /> Messages
              {messages.filter(m => m.status === 'unread').length > 0 && (
                <Badge variant="destructive" className="ml-1 text-xs px-1.5">
                  {messages.filter(m => m.status === 'unread').length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>
        </div>

        {/* ── Overview ── */}
        <TabsContent value="overview">
          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[...Array(8)].map(i => <Card key={i} className="p-4 animate-pulse"><div className="h-14 bg-muted rounded" /></Card>)}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <Card className="p-4"><div className="flex items-center justify-between"><div><p className="text-xs text-muted-foreground">Total Users</p><p className="text-2xl font-bold mt-1">{stats?.total_users || 0}</p></div><Users className="w-6 h-6 text-primary opacity-70" /></div></Card>
                <Card className="p-4"><div className="flex items-center justify-between"><div><p className="text-xs text-muted-foreground">Total Agents</p><p className="text-2xl font-bold mt-1">{stats?.total_agents || 0}</p></div><UserCheck className="w-6 h-6 text-secondary opacity-70" /></div></Card>
                <Card className="p-4"><div className="flex items-center justify-between"><div><p className="text-xs text-muted-foreground">Properties</p><p className="text-2xl font-bold mt-1">{stats?.total_properties || 0}</p></div><Building2 className="w-6 h-6 text-primary opacity-70" /></div></Card>
                <Card className="p-4"><div className="flex items-center justify-between"><div><p className="text-xs text-muted-foreground">Inspections</p><p className="text-2xl font-bold mt-1">{stats?.total_inspections || 0}</p></div><Calendar className="w-6 h-6 text-secondary opacity-70" /></div></Card>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <Card className="p-4 border-yellow-200 bg-yellow-50"><p className="text-xs text-yellow-700 font-medium">Pending Properties</p><p className="text-2xl font-bold mt-1 text-yellow-900">{stats?.pending_properties || 0}</p></Card>
                <Card className="p-4 border-yellow-200 bg-yellow-50"><p className="text-xs text-yellow-700 font-medium">Pending Verifications</p><p className="text-2xl font-bold mt-1 text-yellow-900">{stats?.pending_verifications || 0}</p></Card>
                <Card className="p-4 border-green-200 bg-green-50"><p className="text-xs text-green-700 font-medium">Approved Properties</p><p className="text-2xl font-bold mt-1 text-green-900">{stats?.approved_properties || 0}</p></Card>
                <Card className="p-4 border-blue-200 bg-blue-50"><p className="text-xs text-blue-700 font-medium">Completed Inspections</p><p className="text-2xl font-bold mt-1 text-blue-900">{stats?.completed_inspections || 0}</p></Card>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Card className="p-4"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0"><Coins className="w-5 h-5 text-primary" /></div><div><p className="text-xs text-muted-foreground">Token Revenue</p><p className="text-xl font-bold">{formatPrice(stats?.token_revenue || 0)}</p></div></div></Card>
                <Card className="p-4"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-full bg-secondary/10 flex items-center justify-center shrink-0"><Calendar className="w-5 h-5 text-secondary" /></div><div><p className="text-xs text-muted-foreground">Inspection Revenue</p><p className="text-xl font-bold">{formatPrice(stats?.inspection_revenue || 0)}</p></div></div></Card>
                <Card className="p-4 bg-primary text-white"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center shrink-0"><TrendingUp className="w-5 h-5" /></div><div><p className="text-xs opacity-80">Total Revenue</p><p className="text-xl font-bold">{formatPrice(stats?.total_revenue || 0)}</p></div></div></Card>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
                <Card className="p-4"><div className="flex items-center justify-between"><div><p className="text-xs text-muted-foreground">Token Transactions</p><p className="text-2xl font-bold mt-1">{transactions.token_transactions.length}</p><p className="text-xs text-muted-foreground mt-0.5">{transactions.token_transactions.filter(t => t.status === 'completed').length} completed</p></div><Coins className="w-6 h-6 text-primary opacity-60" /></div></Card>
                <Card className="p-4"><div className="flex items-center justify-between"><div><p className="text-xs text-muted-foreground">Inspection Transactions</p><p className="text-2xl font-bold mt-1">{transactions.inspection_transactions.length}</p><p className="text-xs text-muted-foreground mt-0.5">{transactions.inspection_transactions.filter(t => t.status === 'completed').length} completed</p></div><Receipt className="w-6 h-6 text-secondary opacity-60" /></div></Card>
                <Card className="p-4 border-yellow-200 bg-yellow-50"><p className="text-xs text-yellow-700 font-medium">Pending Inspections</p><p className="text-2xl font-bold mt-1 text-yellow-900">{stats?.pending_inspections || 0}</p><p className="text-xs text-yellow-600 mt-0.5">awaiting completion</p></Card>
                <Card className="p-4 border-blue-200 bg-blue-50"><p className="text-xs text-blue-700 font-medium">Unread Messages</p><p className="text-2xl font-bold mt-1 text-blue-900">{messages.filter(m => m.status === 'unread').length}</p><p className="text-xs text-blue-600 mt-0.5">need response</p></Card>
              </div>
            </>
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
                    <TableCell className="font-medium">{u.full_name}</TableCell>
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
                  {properties.filter(p => p.status === 'pending').map((p) => (
                    <Card key={p.id} className="overflow-hidden border-yellow-200">
                      <div className="flex">
                        <img src={p.images?.[0] || 'https://images.pexels.com/photos/3754595/pexels-photo-3754595.jpeg'} alt="" className="w-24 sm:w-32 object-cover flex-shrink-0" style={{ minHeight: '100px' }} />
                        <div className="flex-1 p-3 min-w-0 flex flex-col justify-between" style={{ minHeight: '100px' }}>
                          <div>
                            <h4 className="font-semibold text-sm line-clamp-1">{p.title}</h4>
                            <p className="text-xs text-muted-foreground line-clamp-1">{p.location}</p>
                            <p className="text-primary font-bold text-sm mt-1">{formatPrice(p.price)}/yr</p>
                            <p className="text-xs text-muted-foreground">By: {p.uploaded_by_agent_name}</p>
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
                  ))}
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
                    <TableCell><div className="flex gap-1.5">{p.status === 'pending' && (<><Button size="sm" variant="outline" className="h-7 px-2" onClick={() => setPreviewProperty(p)}><Eye className="w-3.5 h-3.5" /></Button><Button size="sm" className="h-7 px-2" onClick={() => handleApproveProperty(p.id, 'approved')}><CheckCircle2 className="w-3.5 h-3.5" /></Button><Button size="sm" variant="outline" className="h-7 px-2" onClick={() => handleApproveProperty(p.id, 'rejected')}><XCircle className="w-3.5 h-3.5" /></Button></>)}<Button variant="destructive" size="sm" className="h-7 px-2" onClick={() => confirmDeleteProperty(p)}><Trash2 className="w-3.5 h-3.5" /></Button></div></TableCell>
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
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Card className="p-4 bg-primary/5 border-primary/20"><p className="text-xs text-muted-foreground">Token Transactions</p><p className="text-2xl font-bold mt-1">{transactions.token_transactions.length}</p></Card>
              <Card className="p-4 bg-green-50 border-green-200"><p className="text-xs text-green-700 font-medium">Completed Token Tx</p><p className="text-2xl font-bold mt-1 text-green-900">{transactions.token_transactions.filter(t => t.status === 'completed').length}</p><p className="text-xs text-green-600 font-medium mt-0.5">{formatPrice(transactions.token_transactions.filter(t => t.status === 'completed').reduce((s, t) => s + (t.amount || 0), 0))}</p></Card>
              <Card className="p-4 bg-blue-50 border-blue-200"><p className="text-xs text-muted-foreground">Inspection Transactions</p><p className="text-2xl font-bold mt-1">{transactions.inspection_transactions.length}</p></Card>
              <Card className="p-4 bg-green-50 border-green-200"><p className="text-xs text-green-700 font-medium">Completed Inspection Tx</p><p className="text-2xl font-bold mt-1 text-green-900">{transactions.inspection_transactions.filter(t => t.status === 'completed').length}</p><p className="text-xs text-green-600 font-medium mt-0.5">{formatPrice(transactions.inspection_transactions.filter(t => t.status === 'completed').reduce((s, t) => s + (t.amount || 0), 0))}</p></Card>
            </div>
            <div>
              <h3 className="font-semibold text-sm mb-3">Token Transactions</h3>
              <div className="sm:hidden space-y-3">{transactions.token_transactions.map((tx) => (<Card key={tx.id} className="p-4"><div className="flex items-start justify-between gap-2"><div className="min-w-0 flex-1"><p className="font-mono text-xs text-muted-foreground truncate">{tx.reference}</p><p className="font-semibold text-sm mt-1">{tx.tokens_added} Tokens</p><p className="text-sm font-bold text-primary">{formatPrice(tx.amount)}</p></div><div className="flex flex-col items-end gap-1 shrink-0"><Badge className={`${getStatusBadge(tx.status)} text-xs`}>{tx.status}</Badge><p className="text-xs text-muted-foreground">{new Date(tx.created_at).toLocaleDateString()}</p></div></div></Card>))}{transactions.token_transactions.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No token transactions yet</p>}</div>
              <Card className="hidden sm:block overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Reference</TableHead><TableHead>Tokens</TableHead><TableHead>Amount</TableHead><TableHead>Status</TableHead><TableHead>Date</TableHead></TableRow></TableHeader><TableBody>{transactions.token_transactions.map((tx) => (<TableRow key={tx.id}><TableCell className="font-mono text-sm">{tx.reference}</TableCell><TableCell>{tx.tokens_added}</TableCell><TableCell>{formatPrice(tx.amount)}</TableCell><TableCell><Badge className={getStatusBadge(tx.status)}>{tx.status}</Badge></TableCell><TableCell className="text-sm text-muted-foreground">{new Date(tx.created_at).toLocaleDateString()}</TableCell></TableRow>))}</TableBody></Table></Card>
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
                      <a href={`mailto:${selectedMessage.email}?subject=Re: ${encodeURIComponent(selectedMessage.subject)}`} target="_blank" rel="noreferrer">
                        <Button size="sm" className="h-8 px-3 gap-1.5 text-xs shrink-0"><Mail className="w-3.5 h-3.5" /> Reply</Button>
                      </a>
                    </div>
                    <div className="bg-white border border-border/50 rounded-lg p-4 min-h-[120px]"><p className="text-sm text-foreground/80 whitespace-pre-wrap leading-relaxed">{selectedMessage.message}</p></div>
                    <p className="text-xs text-foreground/40 mt-3 text-center">Clicking Reply opens your email client with a pre-filled reply</p>
                  </Card>
                ) : (
                  <Card className="p-12 text-center border-border/60"><MailOpen className="w-12 h-12 text-foreground/20 mx-auto mb-3" /><p className="text-sm text-foreground/50">Select a message to read it</p></Card>
                )}
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

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
    </div>
  );
}

export default AdminDashboard;
