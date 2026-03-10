import { supabase } from './supabase';
import { v4 as uuidv4 } from 'uuid';

// Helper to generate payment reference
const generateReference = (prefix) => {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `${prefix}-${date}-${uuidv4().slice(0, 8).toUpperCase()}`;
};

// ============== PROPERTY APIs ==============

export const propertyAPI = {
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
    
    const koralpayPublicKey = process.env.REACT_APP_KORALPAY_PUBLIC_KEY || 'pk_test_xxx';
    const checkoutUrl = `https://checkout.korapay.com/checkout?amount=${amount}&currency=NGN&reference=${reference}&merchant=${koralpayPublicKey}&email=${data.email}`;
    
    return {
      data: {
        reference,
        amount,
        quantity: data.quantity,
        checkout_url: checkoutUrl,
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
    
    // Create inspection transaction
    await supabase
      .from('inspection_transactions')
      .insert({
        id: uuidv4(),
        inspection_id: inspectionId,
        user_id: user.id,
        reference,
        amount: 3000,
        status: 'pending'
      });
    
    const koralpayPublicKey = process.env.REACT_APP_KORALPAY_PUBLIC_KEY || 'pk_test_xxx';
    const checkoutUrl = `https://checkout.korapay.com/checkout?amount=3000&currency=NGN&reference=${reference}&merchant=${koralpayPublicKey}&email=${data.email}`;
    
    return {
      data: {
        inspection_id: inspectionId,
        reference,
        amount: 3000,
        checkout_url: checkoutUrl,
        payment_type: 'inspection'
      }
    };
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
      { data: inspTxs }
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
      supabase.from('inspection_transactions').select('amount').eq('status', 'completed')
    ]);
    
    const tokenRevenue = tokenTxs?.reduce((sum, tx) => sum + (tx.amount || 0), 0) || 0;
    const inspectionRevenue = inspTxs?.reduce((sum, tx) => sum + (tx.amount || 0), 0) || 0;
    
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
        inspection_revenue: inspectionRevenue,
        total_revenue: tokenRevenue + inspectionRevenue
      }
    };
  }
};

// ============== PAYMENT APIs ==============

export const paymentAPI = {
  verify: async (reference) => {
    // Check token transaction
    const tokenVerifyRes = await supabase
      .from('transactions')
      .select('*')
      .eq('reference', reference)
      .limit(1);
    const tokenTx = tokenVerifyRes.data?.[0] || null;
    
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
    const inspVerifyRes = await supabase
      .from('inspection_transactions')
      .select('*')
      .eq('reference', reference)
      .limit(1);
    const inspTx = inspVerifyRes.data?.[0] || null;
    
    if (inspTx) {
      const inspDetailVerifyRes = await supabase
        .from('inspections')
        .select('agent_name, agent_id, property_title')
        .eq('id', inspTx.inspection_id)
        .limit(1);
      const inspection = inspDetailVerifyRes.data?.[0] || null;
      let agentPhone = null;
      if (inspection?.agent_id) {
        const agentVerifyRes = await supabase
          .from('users')
          .select('phone')
          .eq('id', inspection.agent_id)
          .limit(1);
        const agentUser = agentVerifyRes.data?.[0] || null;
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
    
    throw new Error('Transaction not found');
  },

  // Simulate payment for testing
  confirmPayment: async (reference) => {
    // Called by korapay.js onSuccess — marks payment completed in DB
    // Using .limit(1) + data[0] instead of .single() to avoid body-stream-read errors
    const tokenRes = await supabase
      .from('transactions')
      .select('*')
      .eq('reference', reference)
      .limit(1);
    const tokenTx = tokenRes.data?.[0] || null;

    if (tokenTx) {
      if (tokenTx.status !== 'completed') {
        await supabase
          .from('transactions')
          .update({ status: 'completed' })
          .eq('reference', reference);

        const walletRes = await supabase
          .from('wallets')
          .select('token_balance')
          .eq('user_id', tokenTx.user_id)
          .limit(1);
        const wallet = walletRes.data?.[0] || null;

        const newBalance = (wallet?.token_balance || 0) + tokenTx.tokens_added;
        await supabase
          .from('wallets')
          .update({ token_balance: newBalance })
          .eq('user_id', tokenTx.user_id);
      }
      return { data: { type: 'token_purchase', status: 'completed', amount: tokenTx.amount, tokens: tokenTx.tokens_added } };
    }

    const inspRes = await supabase
      .from('inspection_transactions')
      .select('*')
      .eq('reference', reference)
      .limit(1);
    const inspTx = inspRes.data?.[0] || null;

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
      return { data: { type: 'inspection', status: 'completed', amount: inspTx.amount } };
    }

    throw new Error('Transaction not found');
  },

  simulate: async (reference) => {
    // Check token transaction
    const tokenTxRes = await supabase
      .from('transactions')
      .select('*')
      .eq('reference', reference).limit(1);
    const tokenTx = tokenTxRes.data?.[0] || null;
    
    if (tokenTx) {
      await supabase
        .from('transactions')
        .update({ status: 'completed' })
        .eq('reference', reference);
      
      // Add tokens to wallet
      const walletRes = await supabase
        .from('wallets')
        .select('token_balance')
        .eq('user_id', tokenTx.user_id).limit(1);
    const wallet = walletRes.data?.[0] || null;
      
      const newBalance = (wallet?.token_balance || 0) + tokenTx.tokens_added;
      await supabase
        .from('wallets')
        .update({ token_balance: newBalance })
        .eq('user_id', tokenTx.user_id);
      
      return { data: { message: 'Token payment simulated', tokens_added: tokenTx.tokens_added } };
    }
    
    // Check inspection transaction
    const inspTxRes = await supabase
      .from('inspection_transactions')
      .select('*')
      .eq('reference', reference).limit(1);
    const inspTx = inspTxRes.data?.[0] || null;
    
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
};

// ============== WITHDRAWAL APIs ==============

export const withdrawalAPI = {
  request: async ({ agentId, agentName, agentEmail, amount, bankName, accountNumber, accountName }) => {
    // Check available balance
    const balRes = await supabase
      .from('agent_balances')
      .select('total_earned, total_withdrawn')
      .eq('agent_id', agentId)
      .limit(1);
    const bal = balRes.data?.[0] || null;
    const available = Number(bal?.total_earned || 0) - Number(bal?.total_withdrawn || 0);
    if (amount > available) throw new Error(`Amount exceeds available balance (₦${available.toLocaleString('en-NG')})`);

    // Use raw fetch so we can read the real error from the response body
    const SUPA_URL = process.env.REACT_APP_SUPABASE_URL;
    const SUPA_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY;
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token || SUPA_KEY;

    const rawRes = await fetch(`${SUPA_URL}/rest/v1/withdrawal_requests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPA_KEY,
        'Authorization': `Bearer ${token}`,
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify({
        agent_id: agentId,
        agent_name: agentName,
        agent_email: agentEmail,
        amount,
        bank_name: bankName,
        account_number: accountNumber,
        account_name: accountName,
        status: 'pending',
        requested_at: new Date().toISOString(),
      }),
    });

    if (!rawRes.ok) {
      const errText = await rawRes.text();
      let errMsg = `HTTP ${rawRes.status}`;
      try {
        const errJson = JSON.parse(errText);
        errMsg = errJson.message || errJson.error || errText;
        if (errJson.details) errMsg += ' — ' + errJson.details;
        if (errJson.hint) errMsg += ' | ' + errJson.hint;
      } catch { errMsg = errText || errMsg; }
      throw new Error(errMsg);
    }

    return { data: { ok: true } };
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
    const reqRes = await supabase
      .from('withdrawal_requests')
      .select('*')
      .eq('id', requestId)
      .limit(1);
    if (reqRes.error) throw reqRes.error;
    const req = reqRes.data?.[0] || null;
    if (!req) throw new Error('Withdrawal request not found');

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
