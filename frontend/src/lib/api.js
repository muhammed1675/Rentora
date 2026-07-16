import { supabase } from './supabase';
import { v4 as uuidv4 } from 'uuid';

// Helper to generate payment reference
const generateReference = (prefix) => {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `${prefix}-${date}-${uuidv4().slice(0, 8).toUpperCase()}`;
};

// ============== PROPERTY APIs ==============

export const propertyAPI = {
  // Checks for existing listings that look like the same property —
  // similar title/location, similar price, same type, posted by a
  // DIFFERENT agent. Call before submitting a new/edited listing so the
  // agent can be warned. The DB also flags this server-side on save
  // regardless (see trg_flag_possible_duplicate), so this is a UX layer,
  // not the only line of defense.
  checkPossibleDuplicates: async ({ title, location, price, propertyType, agentId, excludePropertyId }) => {
    const { data, error } = await supabase.rpc('find_possible_duplicate_properties', {
      p_title: title,
      p_location: location,
      p_price: price,
      p_property_type: propertyType,
      p_exclude_agent_id: agentId || null,
      p_exclude_property_id: excludePropertyId || null,
    });
    if (error) { console.warn('duplicate check:', error.message); return { data: [] }; }
    return { data: data || [] };
  },

  getAll: async (params = {}) => {
    let query = supabase
      .from('properties')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (params.status) {
      query = query.eq('status', params.status);
    } else {
      query = query.eq('status', 'approved');
    }

    // Exclude properties marked "taken" (unavailable) from public listings,
    // unless the caller explicitly asks to include them (e.g. an admin view).
    // Handles NULL availability (older rows that predate the column) safely —
    // a plain .neq() would silently exclude those too.
    if (!params.include_unavailable) {
      query = query.or('availability.neq.unavailable,availability.is.null');
    }
    
    if (params.property_type) {
      query = query.eq('property_type', params.property_type);
    }
    
    if (params.min_price) {
      query = query.gte('price', params.min_price);
    }
    
    if (params.max_price) {
      query = query.lte('price', params.max_price);
    }
    
    const { data, error } = await query;
    if (error) throw error;
    return { data };
  },

  getPublic: async (id) => {
    const { data, error } = await supabase
      .from('properties')
      .select('*')
      .eq('id', id)
      .eq('status', 'approved')
      .single();
    
    if (error) throw error;
    
    return {
      data: {
        ...data,
        contact_phone: '***LOCKED***',
        contact_unlocked: false
      }
    };
  },

  getById: async (id, userId) => {
    const { data: property, error } = await supabase
      .from('properties')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) throw error;
    
    // Check if user has unlocked
    const { data: unlock } = await supabase
      .from('unlocks')
      .select('id')
      .eq('user_id', userId)
      .eq('property_id', id)
      .single();
    
    return {
      data: {
        ...property,
        contact_unlocked: !!unlock,
        contact_phone: unlock ? property.contact_phone : '***LOCKED***'
      }
    };
  },

  create: async (data, user) => {
    const propertyId = uuidv4();
    const { error } = await supabase
      .from('properties')
      .insert({
        id: propertyId,
        ...data,
        uploaded_by_agent_id: user.id,
        uploaded_by_agent_name: user.full_name,
        status: 'pending'
      });
    
    if (error) throw error;
    return { data: { property_id: propertyId } };
  },

  update: async (id, data) => {
    const { error } = await supabase
      .from('properties')
      .update(data)
      .eq('id', id);
    
    if (error) throw error;
    return { data: { message: 'Property updated' } };
  },

  delete: async (id) => {
    const { error } = await supabase
      .from('properties')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
    return { data: { message: 'Property deleted' } };
  },

  approve: async (id, status, adminId) => {
    const { error } = await supabase
      .from('properties')
      .update({ status, approved_by_admin_id: adminId })
      .eq('id', id);
    
    if (error) throw error;
    return { data: { message: `Property ${status}` } };
  },

  getMyListings: async (userId) => {
    const { data, error } = await supabase
      .from('properties')
      .select('*')
      .eq('uploaded_by_agent_id', userId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return { data };
  },

  getPending: async () => {
    const { data, error } = await supabase
      .from('properties')
      .select('*')
      .eq('status', 'pending');
    
    if (error) throw error;
    return { data };
  },

  getAllAdmin: async () => {
    const { data, error } = await supabase
      .from('properties')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return { data };
  },

  unlock: async (propertyId, userId) => {
    // Check if already unlocked
    const { data: existing } = await supabase
      .from('unlocks')
      .select('id')
      .eq('user_id', userId)
      .eq('property_id', propertyId)
      .single();
    
    if (existing) {
      throw new Error('Already unlocked');
    }
    
    // Check wallet balance
    const { data: wallet } = await supabase
      .from('wallets')
      .select('token_balance')
      .eq('user_id', userId)
      .single();
    
    if (!wallet || wallet.token_balance < 1) {
      throw new Error('Insufficient token balance');
    }
    
    // Get property
    const { data: property } = await supabase
      .from('properties')
      .select('*')
      .eq('id', propertyId)
      .eq('status', 'approved')
      .single();
    
    if (!property) {
      throw new Error('Property not found');
    }
    
    // Deduct token
    await supabase
      .from('wallets')
      .update({ token_balance: wallet.token_balance - 1 })
      .eq('user_id', userId);
    
    // Create unlock
    await supabase
      .from('unlocks')
      .insert({
        id: uuidv4(),
        user_id: userId,
        property_id: propertyId
      });
    
    return {
      data: {
        message: 'Contact unlocked',
        contact_name: property.contact_name,
        contact_phone: property.contact_phone
      }
    };
  }
};

// ============== WALLET APIs ==============

export const walletAPI = {
  get: async (userId) => {
    const { data, error } = await supabase
      .from('wallets')
      .select('*')
      .eq('user_id', userId)
      .single();
    
    if (error && error.code !== 'PGRST116') throw error;
    return { data: data || { user_id: userId, token_balance: 0 } };
  },

  getUserWallet: async (userId) => {
    const { data, error } = await supabase
      .from('wallets')
      .select('*')
      .eq('user_id', userId)
      .single();
    
    if (error) throw error;
    return { data };
  }
};

// ============== TOKEN APIs ==============

export const tokenAPI = {
  purchase: async (data, userId) => {
    const reference = generateReference('TOKEN');
    const amount = data.quantity * 1000;
    
    // Create transaction record
    await supabase
      .from('transactions')
      .insert({
        id: uuidv4(),
        user_id: userId,
        reference,
        amount,
        tokens_added: data.quantity,
        status: 'pending'
      });
    
    return {
      data: {
        reference,
        amount,
        quantity: data.quantity,
        payment_type: 'token_purchase'
      }
    };
  }
};

// ============== UNLOCK APIs ==============

export const unlockAPI = {
  getMyUnlocks: async (userId) => {
    const { data: unlocks, error } = await supabase
      .from('unlocks')
      .select('*')
      .eq('user_id', userId);
    
    if (error) throw error;
    
    // Get property details for each unlock
    const result = [];
    for (const unlock of unlocks) {
      const { data: property } = await supabase
        .from('properties')
        .select('*')
        .eq('id', unlock.property_id)
        .single();
      
      if (property) {
        result.push({ ...unlock, property });
      }
    }
    
    return { data: result };
  }
};

// ============== INSPECTION APIs ==============

export const inspectionAPI = {
  request: async (data, user) => {
    // Get property
    const { data: property, error: propError } = await supabase
      .from('properties')
      .select('*')
      .eq('id', data.property_id)
      .eq('status', 'approved')
      .single();
    
    if (propError || !property) {
      throw new Error('Property not found');
    }
    
    const reference = generateReference('INSP');
    const inspectionId = uuidv4();
    
    // Create inspection
    await supabase
      .from('inspections')
      .insert({
        id: inspectionId,
        user_id: user.id,
        user_name: user.full_name,
        user_email: user.email,
        property_id: data.property_id,
        property_title: property.title,
        agent_id: property.uploaded_by_agent_id,
        agent_name: property.uploaded_by_agent_name,
        inspection_date: data.inspection_date,
        status: 'pending',
        payment_status: 'pending',
        payment_reference: reference
      });
    
    // Dynamic inspection fee set by the agent (min 1000, default 3000)
    const inspectionAmount = Number(property.inspection_fee) > 0
      ? Number(property.inspection_fee)
      : 3000;

    // Create inspection transaction
    await supabase
      .from('inspection_transactions')
      .insert({
        id: uuidv4(),
        inspection_id: inspectionId,
        user_id: user.id,
        reference,
        amount: inspectionAmount,
        status: 'pending'
      });
    
    return {
      data: {
        inspection_id: inspectionId,
        reference,
        amount: inspectionAmount,
        payment_type: 'inspection',
        agent_id: property.uploaded_by_agent_id,
        agent_name: property.uploaded_by_agent_name,
        property_title: property.title,
      }
    };
  },

  // Best-effort agent notification once payment succeeds — never allowed to
  // affect the booking itself, which has already completed by this point.
  notifyAgent: async ({ agentId, agentName, propertyTitle, inspectionDate, reference, user }) => {
    try {
      if (!agentId) return;
      const agentRes = await supabase.from('users').select('email').eq('id', agentId).limit(1);
      const agentEmail = agentRes.data?.[0]?.email;
      if (!agentEmail) return;
      const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL || '';
      const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY || '';
      await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` },
        body: JSON.stringify({
          type: 'inspection_agent_notify',
          to: agentEmail,
          data: {
            agent_name: agentName || 'there',
            user_name: user?.full_name || 'A student',
            user_email: user?.email || '',
            user_phone: user?.phone || '',
            property_title: propertyTitle,
            inspection_date: inspectionDate,
            reference,
          },
        }),
      });
    } catch (e) { console.warn('inspection_agent_notify email failed:', e); }
  },

  getMyInspections: async (userId) => {
    const { data, error } = await supabase
      .from('inspections')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return { data };
  },

  getAssigned: async (agentId) => {
    const { data, error } = await supabase
      .from('inspections')
      .select('*')
      .eq('agent_id', agentId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return { data };
  },

  getAll: async () => {
    const { data, error } = await supabase
      .from('inspections')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return { data };
  },

  getAgentContact: async (inspectionId) => {
    const { data: inspection, error } = await supabase
      .from('inspections')
      .select('agent_id, agent_name, property_title, inspection_date')
      .eq('id', inspectionId)
      .single();

    if (error || !inspection) throw new Error('Inspection not found');

    // Agent phone comes from users.phone — the number they registered with
    let agentPhone = null;
    if (inspection.agent_id) {
      const { data: agentUser } = await supabase
        .from('users')
        .select('phone')
        .eq('id', inspection.agent_id)
        .single();
      agentPhone = agentUser?.phone || null;
    }

    return {
      data: {
        agent_name: inspection.agent_name,
        agent_phone: agentPhone,
        property_title: inspection.property_title,
        inspection_date: inspection.inspection_date,
      }
    };
  },

  update: async (id, updateData) => {
    const { error } = await supabase
      .from('inspections')
      .update(updateData)
      .eq('id', id);
    
    if (error) throw error;
    return { data: { message: 'Inspection updated' } };
  }
};

// ============== TRANSACTION APIs ==============

export const transactionAPI = {
  getMyTransactions: async (userId) => {
    const { data: tokenTxs } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    
    const { data: inspTxs } = await supabase
      .from('inspection_transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    
    return {
      data: {
        token_transactions: tokenTxs || [],
        inspection_transactions: inspTxs || []
      }
    };
  },

  getAll: async () => {
    const { data: tokenTxs } = await supabase
      .from('transactions')
      .select('*')
      .order('created_at', { ascending: false });
    
    const { data: inspTxs } = await supabase
      .from('inspection_transactions')
      .select('*')
      .order('created_at', { ascending: false });
    
    return {
      data: {
        token_transactions: tokenTxs || [],
        inspection_transactions: inspTxs || []
      }
    };
  }
};

// ============== VERIFICATION APIs ==============

export const verificationAPI = {
  request: async (data, user) => {
    // Check for existing pending request
    const { data: existing } = await supabase
      .from('agent_verification_requests')
      .select('id')
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .single();
    
    if (existing) {
      throw new Error('You already have a pending verification request');
    }
    
    const requestId = uuidv4();
    await supabase
      .from('agent_verification_requests')
      .insert({
        id: requestId,
        user_id: user.id,
        user_name: user.full_name,
        user_email: user.email,
        id_card_url: data.id_card_url,
        selfie_url: data.selfie_url,
        agreement_url: data.agreement_url || null,
        address: data.address,
        bank_code: data.bank_code || null,
        bank_name: data.bank_name || null,
        account_number: data.account_number || null,
        account_name: data.account_name || null,
        status: 'pending'
      });
    
    return { data: { message: 'Verification request submitted', request_id: requestId } };
  },

  getMyRequest: async (userId) => {
    const { data, error } = await supabase
      .from('agent_verification_requests')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    
    if (error && error.code !== 'PGRST116') throw error;
    return { data };
  },

  getPending: async () => {
    const { data, error } = await supabase
      .from('agent_verification_requests')
      .select('*')
      .eq('status', 'pending');
    
    if (error) throw error;
    return { data };
  },

  getAll: async () => {
    const { data, error } = await supabase
      .from('agent_verification_requests')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return { data };
  },

  review: async (requestId, status, adminId) => {
    // Get the request first
    const { data: request } = await supabase
      .from('agent_verification_requests')
      .select('user_id')
      .eq('id', requestId)
      .single();
    
    // Update request status
    await supabase
      .from('agent_verification_requests')
      .update({
        status,
        reviewed_by_admin_id: adminId,
        reviewed_at: new Date().toISOString()
      })
      .eq('id', requestId);
    
    // If approved, update user role
    if (status === 'approved' && request) {
      await supabase
        .from('users')
        .update({ role: 'agent' })
        .eq('id', request.user_id);
    }
    
    return { data: { message: `Verification ${status}` } };
  }
};

// ============== USER APIs ==============

export const userAPI = {
  getAll: async () => {
    const { data, error } = await supabase
      .from('users')
      .select('id, email, full_name, role, suspended, created_at, phone')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return { data };
  },

  getById: async (userId) => {
    const { data, error } = await supabase
      .from('users')
      .select('id, email, full_name, role, suspended, created_at, phone')
      .eq('id', userId)
      .single();
    
    if (error) throw error;
    return { data };
  },

  updateRole: async (userId, role) => {
    const { error } = await supabase
      .from('users')
      .update({ role })
      .eq('id', userId);
    
    if (error) throw error;
    return { data: { message: `Role updated to ${role}` } };
  },

  // Self-service profile update — only ever pass fields a user is allowed
  // to change themselves (phone, etc). full_name/email/role/suspended are
  // locked to admin-only at the DB level (trg_restrict_self_profile_edits)
  // and will be rejected here if included.
  updateProfile: async (userId, { phone }) => {
    const { error } = await supabase
      .from('users')
      .update({ phone })
      .eq('id', userId);
    if (error) throw new Error(error.message || 'Failed to update profile');
    return { data: { ok: true } };
  },

  suspend: async (userId, suspended) => {
    const { error } = await supabase
      .from('users')
      .update({ suspended })
      .eq('id', userId);
    
    if (error) throw error;
    return { data: { message: suspended ? 'User suspended' : 'User unsuspended' } };
  }
};

// ============== ADMIN APIs ==============

export const adminAPI = {
  getStats: async () => {
    const [
      { count: totalUsers },
      { count: totalAgents },
      { count: totalProperties },
      { count: approvedProperties },
      { count: pendingProperties },
      { count: totalInspections },
      { count: pendingInspections },
      { count: completedInspections },
      { count: pendingVerifications },
      { data: tokenTxs },
      { data: inspTxs },
      { data: rentPayments },
      { data: paidWithdrawals },
    ] = await Promise.all([
      supabase.from('users').select('*', { count: 'exact', head: true }),
      supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'agent'),
      supabase.from('properties').select('*', { count: 'exact', head: true }),
      supabase.from('properties').select('*', { count: 'exact', head: true }).eq('status', 'approved'),
      supabase.from('properties').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('inspections').select('*', { count: 'exact', head: true }),
      supabase.from('inspections').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('inspections').select('*', { count: 'exact', head: true }).eq('status', 'completed'),
      supabase.from('agent_verification_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('transactions').select('amount').eq('status', 'completed'),
      supabase.from('inspection_transactions').select('amount').eq('status', 'completed'),
      supabase.from('property_rent_payments').select('status, rent_amount, agent_fee, service_fee, total_amount'),
      supabase.from('withdrawal_requests').select('fee_amount').eq('status', 'paid'),
    ]);

    const tokenRevenue = tokenTxs?.reduce((sum, tx) => sum + (tx.amount || 0), 0) || 0;
    // Inspection fees are NOT Rentora revenue anymore — agents keep 100% of
    // them. Kept as its own figure purely as a volume/activity metric.
    const inspectionFeesProcessed = inspTxs?.reduce((sum, tx) => sum + (tx.amount || 0), 0) || 0;

    const rentRows = rentPayments || [];
    const heldRows = rentRows.filter(r => r.status === 'held');
    const releasedRows = rentRows.filter(r => r.status === 'released');
    // Rentora's only realized revenue from rent is the service fee — counted
    // once the money has actually landed (held or released), not while still
    // 'pending' (unpaid) or if 'refunded'.
    const rentServiceFeeRevenue = [...heldRows, ...releasedRows].reduce((s, r) => s + Number(r.service_fee || 0), 0);
    // Total currently sitting in escrow: the full amount collected (rent +
    // agent fee + service fee) for payments still 'held' — not yet released
    // to the agent or paid out to the owner.
    const totalEscrowHeld = heldRows.reduce((s, r) => s + Number(r.total_amount || 0), 0);

    const withdrawalFeeRevenue = paidWithdrawals?.reduce((s, w) => s + Number(w.fee_amount || 0), 0) || 0;

    return {
      data: {
        total_users: totalUsers || 0,
        total_agents: totalAgents || 0,
        total_properties: totalProperties || 0,
        approved_properties: approvedProperties || 0,
        pending_properties: pendingProperties || 0,
        total_inspections: totalInspections || 0,
        pending_inspections: pendingInspections || 0,
        completed_inspections: completedInspections || 0,
        pending_verifications: pendingVerifications || 0,
        token_revenue: tokenRevenue,
        inspection_fees_processed: inspectionFeesProcessed,
        rent_service_fee_revenue: rentServiceFeeRevenue,
        withdrawal_fee_revenue: withdrawalFeeRevenue,
        // Rentora's actual revenue: token sales + rent service fee +
        // withdrawal fee. Inspection fees are excluded — 100% goes to agents.
        total_revenue: tokenRevenue + rentServiceFeeRevenue + withdrawalFeeRevenue,
        total_escrow_held: totalEscrowHeld,
        total_rent_payments: rentRows.length,
        held_rent_payments: heldRows.length,
        released_rent_payments: releasedRows.length,
      }
    };
  }
};

// ============== PAYMENT APIs ==============

export const paymentAPI = {
  verify: async (reference) => {
    // Check token transaction
    const { data: tokenTx } = await supabase
      .from('transactions')
      .select('*')
      .eq('reference', reference)
      .single();
    
    if (tokenTx) {
      return {
        data: {
          type: 'token_purchase',
          status: tokenTx.status,
          amount: tokenTx.amount,
          tokens: tokenTx.tokens_added
        }
      };
    }
    
    // Check inspection transaction
    const { data: inspTx } = await supabase
      .from('inspection_transactions')
      .select('*')
      .eq('reference', reference)
      .single();
    
    if (inspTx) {
      // Get inspection details to return agent info
      const { data: inspection } = await supabase
        .from('inspections')
        .select('agent_name, agent_id, property_title')
        .eq('id', inspTx.inspection_id)
        .single();
      // Agent phone comes from users.phone — the number they registered with
      let agentPhone = null;
      if (inspection?.agent_id) {
        const { data: agentUser } = await supabase
          .from('users')
          .select('phone')
          .eq('id', inspection.agent_id)
          .single();
        agentPhone = agentUser?.phone || null;
      }
      return {
        data: {
          type: 'inspection',
          status: inspTx.status,
          amount: inspTx.amount,
          inspection_id: inspTx.inspection_id,
          agent_name: inspection?.agent_name || null,
          agent_phone: agentPhone,
          property_title: inspection?.property_title || null,
        }
      };
    }
    
    // Rent escrow payment
    const { data: rentTx } = await supabase
      .from('property_rent_payments')
      .select('*')
      .eq('reference', reference)
      .maybeSingle();

    if (rentTx) {
      if (rentTx.status === 'pending') {
        await supabase
          .from('property_rent_payments')
          .update({ status: 'held', held_at: new Date().toISOString() })
          .eq('reference', reference);
      }
      return { data: { type: 'rent_held', status: 'held', amount: rentTx.total_amount, rent_amount: rentTx.rent_amount, service_fee: rentTx.service_fee } };
    }

    throw new Error('Transaction not found');
  },

  // Simulate payment for testing
  confirmPayment: async (reference) => {
    // Called by korapay.js onSuccess — marks payment completed in DB
    const { data: tokenTx } = await supabase
      .from('transactions')
      .select('*')
      .eq('reference', reference)
      .single();

    if (tokenTx) {
      if (tokenTx.status !== 'completed') {
        await supabase
          .from('transactions')
          .update({ status: 'completed' })
          .eq('reference', reference);

        const { data: wallet } = await supabase
          .from('wallets')
          .select('token_balance')
          .eq('user_id', tokenTx.user_id)
          .single();

        const newBalance = (wallet?.token_balance || 0) + tokenTx.tokens_added;
        await supabase
          .from('wallets')
          .update({ token_balance: newBalance })
          .eq('user_id', tokenTx.user_id);
      }
      // Send token receipt email
      try {
        const userRes = await supabase.from('users').select('email, full_name').eq('id', tokenTx.user_id).limit(1);
        const u = userRes.data?.[0] || null;
        if (u?.email) {
          await fetch('/api/send-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'token_receipt',
              userEmail: u.email,
              userName: u.full_name || 'User',
              amount: tokenTx.amount,
              tokens: tokenTx.tokens_added,
              reference: reference,
            }),
          });
        }
      } catch (e) { console.warn('Token receipt email failed:', e); }
      return { data: { type: 'token_purchase', status: 'completed', amount: tokenTx.amount, tokens: tokenTx.tokens_added } };
    }

    const { data: inspTx } = await supabase
      .from('inspection_transactions')
      .select('*')
      .eq('reference', reference)
      .single();

    if (inspTx) {
      if (inspTx.status !== 'completed') {
        await supabase
          .from('inspection_transactions')
          .update({ status: 'completed' })
          .eq('reference', reference);

        await supabase
          .from('inspections')
          .update({ payment_status: 'completed', status: 'assigned' })
          .eq('id', inspTx.inspection_id);
      }
      // Send inspection receipt emails to client and agent
      try {
        const inspFullRes = await supabase
          .from('inspections')
          .select('user_id, user_name, user_email, agent_id, agent_name, property_title, inspection_date')
          .eq('id', inspTx.inspection_id)
          .limit(1);
        const insp = inspFullRes.data?.[0] || null;
        if (insp) {
          let agentPhone = null;
          let agentEmail = null;
          if (insp.agent_id) {
            const agentRes = await supabase.from('users').select('phone, email').eq('id', insp.agent_id).limit(1);
            const agentUser = agentRes.data?.[0] || null;
            agentPhone = agentUser?.phone || null;
            agentEmail = agentUser?.email || null;
          }
          let userPhone = null;
          if (insp.user_id) {
            const userRes = await supabase.from('users').select('phone').eq('id', insp.user_id).limit(1);
            userPhone = userRes.data?.[0]?.phone || null;
          }
          await fetch('/api/send-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'inspection_receipt',
              userEmail: insp.user_email,
              userName: insp.user_name,
              userPhone: userPhone || 'Not provided',
              agentName: insp.agent_name || 'Your Agent',
              agentEmail: agentEmail,
              agentPhone: agentPhone,
              propertyTitle: insp.property_title,
              inspectionDate: insp.inspection_date,
              reference: reference,
              amount: inspTx.amount,
            }),
          });
        }
      } catch (e) { console.warn('Inspection receipt email failed:', e); }
      return { data: { type: 'inspection', status: 'completed', amount: inspTx.amount } };
    }

    throw new Error('Transaction not found');
  },

  simulate: async (reference) => {
    // Check token transaction
    const { data: tokenTx } = await supabase
      .from('transactions')
      .select('*')
      .eq('reference', reference)
      .single();
    
    if (tokenTx) {
      await supabase
        .from('transactions')
        .update({ status: 'completed' })
        .eq('reference', reference);
      
      // Add tokens to wallet
      const { data: wallet } = await supabase
        .from('wallets')
        .select('token_balance')
        .eq('user_id', tokenTx.user_id)
        .single();
      
      const newBalance = (wallet?.token_balance || 0) + tokenTx.tokens_added;
      await supabase
        .from('wallets')
        .update({ token_balance: newBalance })
        .eq('user_id', tokenTx.user_id);
      
      return { data: { message: 'Token payment simulated', tokens_added: tokenTx.tokens_added } };
    }
    
    // Check inspection transaction
    const { data: inspTx } = await supabase
      .from('inspection_transactions')
      .select('*')
      .eq('reference', reference)
      .single();
    
    if (inspTx) {
      await supabase
        .from('inspection_transactions')
        .update({ status: 'completed' })
        .eq('reference', reference);
      
      await supabase
        .from('inspections')
        .update({ payment_status: 'completed', status: 'assigned' })
        .eq('id', inspTx.inspection_id);
      
      return { data: { message: 'Inspection payment simulated' } };
    }
    
    throw new Error('Transaction not found');
  }
};

// ============== STORAGE APIs ==============

export const storageAPI = {
  uploadImage: async (file, bucket = 'property-images') => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${uuidv4()}.${fileExt}`;
    
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(fileName, file);
    
    if (error) throw error;
    
    const { data: { publicUrl } } = supabase.storage
      .from(bucket)
      .getPublicUrl(fileName);
    
    return { data: { url: publicUrl, path: data.path } };
  },

  // Used by BecomeAgent.jsx — uploads to dedicated verification bucket
  uploadFile: async (file, folder = 'verification') => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${folder}-${uuidv4()}.${fileExt}`;
    const bucket = 'verification';

    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(fileName, file);

    if (error) throw error;

    const { data: { publicUrl } } = supabase.storage
      .from(bucket)
      .getPublicUrl(fileName);

    return { data: { url: publicUrl, path: data.path } };
  }
};

// ============== REVIEW APIs ==============

export const reviewAPI = {
  submit: async (data, user) => {
    const { error } = await supabase
      .from('property_reviews')
      .insert({
        id: uuidv4(),
        property_id: data.property_id,
        user_id: user.id,
        user_name: user.full_name,
        rating: data.rating,
        comment: data.comment,
      });
    if (error) throw error;
    return { data: { message: 'Review submitted' } };
  },

  getByProperty: async (propertyId) => {
    const { data, error } = await supabase
      .from('property_reviews')
      .select('*')
      .eq('property_id', propertyId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return { data };
  },

  deleteReview: async (id) => {
    const { error } = await supabase
      .from('property_reviews')
      .delete()
      .eq('id', id);
    if (error) throw error;
    return { data: { message: 'Review deleted' } };
  },
};

// ============== CONTACT APIs ==============

export const contactAPI = {
  submit: async (data) => {
    const { error } = await supabase
      .from('contact_messages')
      .insert({
        name: data.name,
        email: data.email,
        subject: data.subject,
        message: data.message,
        status: 'unread',
      });
    if (error) throw error;
    return { data: { message: 'Message submitted' } };
  },

  getAll: async () => {
    const { data, error } = await supabase
      .from('contact_messages')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return { data };
  },

  markRead: async (id) => {
    const { error } = await supabase
      .from('contact_messages')
      .update({ status: 'read' })
      .eq('id', id);
    if (error) throw error;
    return { data: { message: 'Marked as read' } };
  },

  delete: async (id) => {
    const { error } = await supabase
      .from('contact_messages')
      .delete()
      .eq('id', id);
    if (error) throw error;
    return { data: { message: 'Message deleted' } };
  },
};


// ============== BALANCE APIs ==============

export const balanceAPI = {
  getMyBalance: async (agentId) => {
    const balRes = await supabase
      .from('agent_balances')
      .select('*')
      .eq('agent_id', agentId)
      .limit(1);
    if (balRes.error) throw balRes.error;
    const data = balRes.data?.[0] || null;
    if (!data) return { data: { total_earned: 0, total_withdrawn: 0, available: 0 } };
    const available = Number(data.total_earned || 0) - Number(data.total_withdrawn || 0);
    return { data: { ...data, available } };
  },

  getAllBalances: async () => {
    const res = await supabase
      .from('agent_balances')
      .select('*')
      .order('total_earned', { ascending: false });
    if (res.error) { console.warn('agent_balances:', res.error.message); return { data: [] }; }
    return { data: res.data || [] };
  },

  // A real, itemized earnings history for the agent — combines completed
  // inspection fees (100% to agent) and released rent agent fees into one
  // sorted list, since agent_balances only stores a running total, not a
  // per-transaction ledger.
  getEarningsHistory: async (agentId) => {
    const [inspectionRes, rentRes] = await Promise.all([
      supabase
        .from('inspection_transactions')
        .select('id, amount, created_at, inspection:inspections!inner(agent_id, property:properties(title))')
        .eq('status', 'completed')
        .eq('inspection.agent_id', agentId),
      supabase
        .from('property_rent_payments')
        .select('id, agent_fee, released_at, property:properties(title)')
        .eq('agent_id', agentId)
        .eq('status', 'released'),
    ]);

    const inspectionRows = (inspectionRes.data || []).map((tx) => ({
      id: `insp_${tx.id}`,
      type: 'inspection',
      label: 'Inspection Fee',
      property_title: tx.inspection?.property?.title || 'Property',
      amount: Number(tx.amount || 0),
      date: tx.created_at,
    }));

    const rentRows = (rentRes.data || []).map((rp) => ({
      id: `rent_${rp.id}`,
      type: 'rent_agent_fee',
      label: 'Agent Fee (Rent)',
      property_title: rp.property?.title || 'Property',
      amount: Number(rp.agent_fee || 0),
      date: rp.released_at,
    }));

    const combined = [...inspectionRows, ...rentRows].sort(
      (a, b) => new Date(b.date || 0) - new Date(a.date || 0)
    );
    return { data: combined };
  },
};

// ============== WITHDRAWAL APIs ==============

export const withdrawalAPI = {
  WITHDRAWAL_FEE_PCT: 3.5,
  MIN_WITHDRAWAL_AMOUNT: 3000, // minimum per request

  // Preview the fee/net split for a given withdrawal amount (used by the UI
  // to show "you'll receive ₦X" before the agent submits).
  previewFee: (amount) => {
    const fee = Math.round(Number(amount || 0) * (withdrawalAPI.WITHDRAWAL_FEE_PCT / 100));
    return { fee, net: Number(amount || 0) - fee };
  },

  request: async ({ agentId, agentName, agentEmail, amount, bankName, accountNumber, accountName }) => {
    if (amount < withdrawalAPI.MIN_WITHDRAWAL_AMOUNT) {
      throw new Error(`Minimum withdrawal is ₦${withdrawalAPI.MIN_WITHDRAWAL_AMOUNT.toLocaleString('en-NG')} per request.`);
    }
    // Check available balance — use array select to avoid maybeSingle body-lock bug
    const balRes = await supabase
      .from('agent_balances')
      .select('total_earned, total_withdrawn')
      .eq('agent_id', agentId)
      .limit(1);
    const bal = balRes.data?.[0] || null;
    const available = Number(bal?.total_earned || 0) - Number(bal?.total_withdrawn || 0);
    if (amount > available) throw new Error(`Amount exceeds available balance (₦${available.toLocaleString('en-NG')})`);

    // Rentora takes a 3.5% fee on every withdrawal. The agent's balance is
    // still debited by the full requested amount (that's what leaves their
    // available balance) — the fee is what Rentora keeps out of it, and
    // net_amount is what actually gets paid out to their bank account.
    const { fee, net } = withdrawalAPI.previewFee(amount);

    const insertRes = await supabase
      .from('withdrawal_requests')
      .insert({
        agent_id: agentId,
        agent_name: agentName,
        agent_email: agentEmail,
        amount,
        fee_amount: fee,
        net_amount: net,
        bank_name: bankName,
        account_number: accountNumber,
        account_name: accountName,
        status: 'pending',
        requested_at: new Date().toISOString(),
      });
    if (insertRes.error) throw new Error(insertRes.error.message);
    return { data: { ok: true, fee, net } };
  },

  getMyRequests: async (agentId) => {
    const res = await supabase
      .from('withdrawal_requests')
      .select('*')
      .eq('agent_id', agentId)
      .order('requested_at', { ascending: false });
    // Return empty array on error (e.g. table not yet created)
    if (res.error) { console.warn('withdrawal_requests:', res.error.message); return { data: [] }; }
    return { data: res.data || [] };
  },

  getAll: async () => {
    const res = await supabase
      .from('withdrawal_requests')
      .select('*')
      .order('requested_at', { ascending: false });
    if (res.error) { console.warn('withdrawal_requests:', res.error.message); return { data: [] }; }
    return { data: res.data || [] };
  },

  markPaid: async (requestId, adminId) => {
    // Get the request first
    const { data: req, error: reqErr } = await supabase
      .from('withdrawal_requests')
      .select('*')
      .eq('id', requestId)
      .single();
    if (reqErr) throw reqErr;

    // Update status
    const { error: updErr } = await supabase
      .from('withdrawal_requests')
      .update({ status: 'paid', resolved_at: new Date().toISOString(), resolved_by: adminId })
      .eq('id', requestId);
    if (updErr) throw updErr;

    // Add to total_withdrawn in agent_balances
    const balRes2 = await supabase
      .from('agent_balances')
      .select('total_withdrawn')
      .eq('agent_id', req.agent_id)
      .limit(1);
    const bal = balRes2.data?.[0] || null;
    const newWithdrawn = Number(bal?.total_withdrawn || 0) + Number(req.amount);
    await supabase
      .from('agent_balances')
      .update({ total_withdrawn: newWithdrawn, updated_at: new Date().toISOString() })
      .eq('agent_id', req.agent_id);

    return { data: { ok: true } };
  },

  reject: async (requestId, adminId, notes) => {
    const { error } = await supabase
      .from('withdrawal_requests')
      .update({ status: 'rejected', resolved_at: new Date().toISOString(), resolved_by: adminId, notes: notes || null })
      .eq('id', requestId);
    if (error) throw error;
    return { data: { ok: true } };
  },
};

// Owner payouts — rent paid straight to the property owner, NOT the agent.
// Owners aren't platform users, so there's no "withdrawal request" from
// them; instead a payout obligation is created automatically the moment
// rent is released, and an admin manually transfers the money and marks
// it paid here. Kept as its own API/table so it never mixes with agent
// withdrawal_requests in the UI.
export const ownerPayoutAPI = {
  getAll: async () => {
    const res = await supabase
      .from('owner_payouts')
      .select('*, properties(title, location)')
      .order('created_at', { ascending: false });
    if (res.error) { console.warn('owner_payouts:', res.error.message); return { data: [] }; }
    const rows = res.data || [];

    // Attach the listing agent's name/email — fetched separately rather
    // than guessing a foreign-key constraint name for an embedded join.
    const agentIds = [...new Set(rows.map((r) => r.agent_id).filter(Boolean))];
    if (agentIds.length > 0) {
      const agentsRes = await supabase.from('users').select('id, full_name, email').in('id', agentIds);
      const agentsById = {};
      for (const a of (agentsRes.data || [])) agentsById[a.id] = a;
      for (const r of rows) r.agent = agentsById[r.agent_id] || null;
    }

    return { data: rows };
  },

  markPaid: async (payoutId, adminId, notes) => {
    const { error } = await supabase
      .from('owner_payouts')
      .update({ status: 'paid', paid_at: new Date().toISOString(), paid_by: adminId, notes: notes || null })
      .eq('id', payoutId)
      .eq('status', 'pending'); // guard against double-paying
    if (error) throw error;
    return { data: { ok: true } };
  },
};

// Opportunistic fallback for the pending-payment expiry job. Safe to call
// often — it's a no-op if nothing is actually stale. This exists in case
// pg_cron isn't enabled on the Supabase plan; call it from any page load
// that a user is likely to hit periodically (Profile, Admin Dashboard).
export const maintenanceAPI = {
  expireStalePending: async () => {
    try {
      await supabase.rpc('expire_stale_pending_payments');
    } catch (e) {
      // Non-critical — silently ignore (e.g. function not deployed yet).
      console.warn('expireStalePending:', e.message);
    }
  },
};

export default {
  propertyAPI,
  reviewAPI,
  contactAPI,
  walletAPI,
  tokenAPI,
  unlockAPI,
  inspectionAPI,
  transactionAPI,
  verificationAPI,
  userAPI,
  adminAPI,
  paymentAPI,
  storageAPI,
  balanceAPI,
  withdrawalAPI
};


// ============== RENT (ESCROW) APIs ==============
// Rentora holds the rent until the user confirms move-in. A configurable
// service fee (default 5%) is added on top of the rent price.

export const rentAPI = {
  // Read the platform service fee percentage (default 5).
  getServiceFeePct: async () => {
    const { data } = await supabase
      .from('platform_settings')
      .select('value')
      .eq('key', 'rent_service_fee_pct')
      .maybeSingle();
    const pct = Number(data?.value);
    return Number.isFinite(pct) && pct > 0 ? pct : 5;
  },

  // Initiate a rent payment. Rentora holds (rent + agent_fee) until move-in,
  // then releases the FULL amount to the agent — Rentora's only cut is the
  // service_fee, added on top, never a percentage of the rent itself.
  // Agent fee is always 20% of rent, computed here — it is not a value
  // agents type into the listing form.
  initiate: async (propertyId, user) => {
    const { data: property, error: propErr } = await supabase
      .from('properties')
      .select('*')
      .eq('id', propertyId)
      .single();
    if (propErr || !property) throw new Error('Property not found');
    if (property.availability === 'unavailable') {
      throw new Error('This property is no longer available');
    }
    // Rent is paid out directly to the property owner's bank account, not
    // the agent — so payment can't proceed until the agent has added the
    // owner's details to the listing.
    if (!property.owner_full_name || !property.owner_phone || !property.owner_bank_name || !property.owner_account_number || !property.owner_account_name) {
      throw new Error('This property is missing the owner\'s payout details. Please ask the listing agent to update the listing before paying rent.');
    }

    const feePct = await rentAPI.getServiceFeePct();
    const rentAmount  = Number(property.price);
    const agentFee    = Math.round(rentAmount * 0.20);      // 20% of rent, always
    const baseAmount  = rentAmount + agentFee;               // rent portion goes to the owner, agent fee to the agent
    const serviceFee  = Math.round(baseAmount * (feePct / 100)); // Rentora's only cut, on top
    const totalAmount = baseAmount + serviceFee;
    const reference   = generateReference('RENT');

    // 5-day auto-release window from now
    const autoRelease = new Date();
    autoRelease.setDate(autoRelease.getDate() + 5);

    const { data: row, error } = await supabase
      .from('property_rent_payments')
      .insert({
        property_id: propertyId,
        user_id: user.id,
        agent_id: property.uploaded_by_agent_id,
        rent_amount: rentAmount,
        agent_fee: agentFee,
        service_fee: serviceFee,
        total_amount: totalAmount,
        reference,
        status: 'pending',
        auto_release_at: autoRelease.toISOString(),
        // Snapshot the owner's payout details at payment time, so a later
        // edit to the listing doesn't retroactively change where an
        // already-in-progress payment is owed.
        owner_name: property.owner_full_name,
        owner_phone: property.owner_phone,
        owner_bank_name: property.owner_bank_name,
        owner_account_number: property.owner_account_number,
        owner_account_name: property.owner_account_name,
      })
      .select()
      .single();
    if (error) throw error;

    return {
      data: {
        id: row.id,
        reference,
        rent_amount: rentAmount,
        agent_fee: agentFee,
        service_fee: serviceFee,
        amount: totalAmount,
        service_fee_pct: feePct,
        payment_type: 'rent',
      },
    };
  },

  // Called by the Korapay success callback: mark the rent as held in escrow.
  // Returns held/released rent payments for properties this agent owns, so
  // the Agent Dashboard can show an accurate "Taken" state and block the
  // availability toggle client-side (the DB also blocks it — this is just
  // for a clear UI instead of a surprise error).
  getPaymentsForAgent: async (agentId) => {
    const { data, error } = await supabase
      .from('property_rent_payments')
      .select('id, property_id, status, rent_amount, agent_fee, total_amount, held_at, released_at, auto_release_at')
      .eq('agent_id', agentId)
      .in('status', ['held', 'released']);
    if (error) throw error;
    return { data: data || [] };
  },

  markHeld: async (reference, koralpayRef) => {
    // This is the critical write — payment confirmation must succeed even
    // if everything below it (agent notification) fails for any reason.
    // No chained .select().single() here on purpose: that can throw on
    // an unrelated hiccup and would silently break a payment that Korapay
    // already actually charged.
    const { error } = await supabase
      .from('property_rent_payments')
      .update({
        status: 'held',
        held_at: new Date().toISOString(),
        koralpay_reference: koralpayRef || null,
      })
      .eq('reference', reference)
      .eq('status', 'pending');
    if (error) throw error;

    // Notify the agent (and student) — best-effort only, wrapped so a
    // failure here can never undo or block the payment confirmation above.
    try {
      const { data: rows } = await supabase
        .from('property_rent_payments')
        .select('*, property:properties(title)')
        .eq('reference', reference)
        .limit(1);
      const row = rows?.[0];
      if (row?.agent_id) {
        const agentRes = await supabase.from('users').select('email, full_name').eq('id', row.agent_id).limit(1);
        const agent = agentRes.data?.[0];
        const studentRes = row.user_id
          ? await supabase.from('users').select('email, full_name, phone').eq('id', row.user_id).limit(1)
          : { data: [] };
        const student = studentRes.data?.[0];
        if (agent?.email) {
          const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL || '';
          const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY || '';
          await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` },
            body: JSON.stringify({
              type: 'rent_payment_held',
              to: agent.email,
              data: {
                agent_name: agent.full_name || 'there',
                property_title: row.property?.title || 'your property',
                amount: row.total_amount,
                agent_fee: row.agent_fee,
                reference: row.reference,
                student_name: student?.full_name || 'A student',
                student_email: student?.email || '',
                student_phone: student?.phone || '',
              },
            }),
          });
          if (student?.email) {
            await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` },
              body: JSON.stringify({
                type: 'rent_payment_receipt',
                to: student.email,
                data: {
                  student_name: student.full_name || 'there',
                  property_title: row.property?.title || 'the property',
                  amount: row.total_amount,
                  reference: row.reference,
                },
              }),
            });
          }
        }
      }
    } catch (e) { console.warn('rent_payment_held email failed:', e); }
  },

  // User confirms move-in / keys received → release funds to agent.
  confirmMoveIn: async (rentPaymentId, userId, moveInPhotoUrl) => {
    const { error } = await supabase
      .from('property_rent_payments')
      .update({
        status: 'released',
        released_by: 'user',
        released_at: new Date().toISOString(),
        move_in_photo_url: moveInPhotoUrl || null,
      })
      .eq('id', rentPaymentId)
      .eq('user_id', userId)
      .eq('status', 'held');
    if (error) throw error;

    // Notify agent + student that funds have been released — best-effort,
    // never allowed to affect the confirmation above (already succeeded).
    try {
      const { data: rows } = await supabase
        .from('property_rent_payments')
        .select('*, property:properties(title)')
        .eq('id', rentPaymentId)
        .limit(1);
      const row = rows?.[0];
      if (row) {
        const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL || '';
        const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY || '';
        const [agentRes, studentRes] = await Promise.all([
          row.agent_id ? supabase.from('users').select('email, full_name').eq('id', row.agent_id).limit(1) : Promise.resolve({ data: [] }),
          supabase.from('users').select('email, full_name').eq('id', userId).limit(1),
        ]);
        const agent = agentRes.data?.[0];
        const student = studentRes.data?.[0];
        const sendMail = (body) => fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` },
          body: JSON.stringify(body),
        });
        if (agent?.email) {
          await sendMail({
            type: 'rent_payment_released',
            to: agent.email,
            data: {
              agent_name: agent.full_name || 'there',
              property_title: row.property?.title || 'your property',
              agent_fee: row.agent_fee,
              reference: row.reference,
            },
          });
        }
        if (student?.email) {
          await sendMail({
            type: 'rent_payment_released_student',
            to: student.email,
            data: {
              student_name: student.full_name || 'there',
              property_title: row.property?.title || 'the property',
              reference: row.reference,
            },
          });
        }
      }
    } catch (e) { console.warn('rent_payment_released email failed:', e); }
  },

  // Rent payments for the logged-in user (their held/released receipts).
  getMyPayments: async (userId) => {
    const { data, error } = await supabase
      .from('property_rent_payments')
      .select('*, property:properties(*)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return { data: data || [] };
  },

  // Admin visibility into every rent payment — used by the Escrow tab so
  // admins can see exactly which payments are currently held, not just a
  // total figure.
  getAllForAdmin: async () => {
    const { data, error } = await supabase
      .from('property_rent_payments')
      .select('*, property:properties(title, location)')
      .order('created_at', { ascending: false });
    if (error) { console.warn('property_rent_payments:', error.message); return { data: [] }; }
    return { data: data || [] };
  },
};

// ============== MARK PROPERTY AS TAKEN ==============
// A user who has unlocked a property can flag it as taken so it no longer
// shows up on the public browse page. Agents/admins can still revert.
export const propertyStatusAPI = {
  markTaken: async (propertyId) => {
    const { data, error } = await supabase
      .from('properties')
      .update({ availability: 'unavailable' })
      .eq('id', propertyId)
      .select();
    if (error) throw error;
    if (!data || data.length === 0) {
      throw new Error('Could not mark this property as taken — you may not have unlocked it, or it was already updated.');
    }
    return data[0];
  },
};