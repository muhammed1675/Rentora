import { supabase } from './supabase';
import { v4 as uuidv4 } from 'uuid';
import { notifyUser } from './notifications';
import { compressImage } from './imageCompression';

// Helper to generate payment reference
const generateReference = (prefix) => {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `${prefix}-${date}-${uuidv4().slice(0, 8).toUpperCase()}`;
};

// Turns the nested `locations` join into a flat `location` string so every
// existing screen that reads `property.location` keeps working unchanged.
const withLocationName = (row) => row ? { ...row, location: row.locations?.name || null } : row;
const withLocationNames = (rows) => (rows || []).map(withLocationName);

// Calls the send-email edge function using the CURRENT USER'S real session
// token (not the public anon key). The edge function verifies this token
// resolves to a real logged-in account before sending anything — see
// supabase/functions/send-email/index.ts. Falls back to the anon key only
// if there's genuinely no session (the function will then reject anything
// except the few email types that don't require auth, if any); this keeps
// the call from throwing in edge cases rather than silently no-op'ing.
const sendTransactionalEmail = async (payload) => {
  const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL || '';
  const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY || '';
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token || SUPABASE_ANON_KEY;

  return fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
};

// Emails every admin (users.role = 'admin') about a significant site event —
// a new listing submitted, a new agent verification request, a withdrawal
// request, a property report, a contact message, a student reporting
// move-in, and so on. Uses the generic 'admin_activity_alert' template in
// the send-email edge function (see supabase/functions/send-email) so new
// event types don't each need their own template.
//
// Best-effort only: never allowed to throw or block the calling flow — a
// failed admin email should never stop a listing from being submitted, a
// report from being filed, etc.
const notifyAdmins = async ({ title, eventLabel, summary, breakdown, actionUrl }) => {
  try {
    const { data: admins, error } = await supabase.from('users').select('email, full_name').eq('role', 'admin');
    if (error || !admins?.length) return;

    await Promise.allSettled(
      admins.filter((a) => a.email).map((admin) =>
        sendTransactionalEmail({
          type: 'admin_activity_alert',
          to: admin.email,
          data: {
            title,
            event_label: eventLabel,
            summary,
            breakdown: breakdown || [],
            action_url: actionUrl,
            admin_name: admin.full_name || 'Admin',
          },
        })
      )
    );
  } catch (e) {
    console.warn(`notifyAdmins(${title}) failed:`, e.message);
  }
};

// ============== LOCATION APIs ==============

export const locationAPI = {
  getAll: async () => {
    const { data, error } = await supabase.from('locations').select('id, name').order('name');
    if (error) throw error;
    return { data: data || [] };
  },
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
      .select('*, locations(name)')
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

    if (params.location_id) {
      query = query.eq('location_id', params.location_id);
    }
    
    if (params.min_price) {
      query = query.gte('price', params.min_price);
    }
    
    if (params.max_price) {
      query = query.lte('price', params.max_price);
    }
    
    const { data, error } = await query;
    if (error) throw error;
    return { data: withLocationNames(data) };
  },

  getPublic: async (id) => {
    const { data, error } = await supabase
      .from('properties')
      .select('*, locations(name)')
      .eq('id', id)
      .eq('status', 'approved')
      .single();
    
    if (error) throw error;
    
    return { data: withLocationName(data) };
  },

  getById: async (id, userId) => {
    const { data: property, error } = await supabase
      .from('properties')
      .select('*, locations(name)')
      .eq('id', id)
      .single();
    
    if (error) throw error;
    
    return { data: withLocationName(property) };
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

    notifyUser(
      user.id,
      'property_listed',
      'Listing submitted',
      `Your property "${data.title || 'listing'}" has been submitted and is pending review.`,
      '/agent'
    );

    notifyAdmins({
      title: `New listing awaiting review: ${data.title || 'Untitled property'}`,
      eventLabel: 'New listing',
      summary: `${user.full_name || 'An agent'} submitted a new property listing that needs approval before it goes live.`,
      breakdown: [
        ['Property', data.title || '—'],
        ['Price', data.price ? `NGN ${Number(data.price).toLocaleString('en-NG')}` : '—'],
        ['Agent', user.full_name || '—'],
        ['Agent email', user.email || '—'],
      ],
      actionUrl: 'https://www.rentora.com.ng/admin',
    });

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
    // Free the rows that reference this property first — Postgres FKs such as
    // property_reports_property_id_fkey block a bare delete otherwise.
    const dependents = ['property_reports', 'property_reviews', 'unlocks', 'inspections', 'property_rent_payments'];
    for (const table of dependents) {
      const { error: depError } = await supabase.from(table).delete().eq('property_id', id);
      // A missing table / no-permission on an unrelated table shouldn't block the delete.
      if (depError && !/does not exist|schema cache/i.test(depError.message || '')) throw depError;
    }

    const { error } = await supabase
      .from('properties')
      .delete()
      .eq('id', id);

    if (error) {
      // Check for foreign key constraint violations related to rent payments
      if (error.message && error.message.includes('foreign key constraint') && error.message.includes('property_rent_payments')) {
        const customError = new Error('This property has rent payment history and cannot be deleted. Please contact support if you need assistance.');
        customError.code = 'RENT_PAYMENT_EXISTS';
        throw customError;
      }
      // Generic foreign key constraint error
      if (error.message && error.message.includes('foreign key constraint')) {
        const customError = new Error('This property has associated records and cannot be deleted. Please contact support if you need assistance.');
        customError.code = 'FK_CONSTRAINT_VIOLATION';
        throw customError;
      }
      throw error;
    }
    return { data: { message: 'Property deleted' } };
  },

  approve: async (id, status, adminId) => {
    const { data: rows, error } = await supabase
      .from('properties')
      .update({ status, approved_by_admin_id: adminId })
      .eq('id', id)
      .select('title, uploaded_by_agent_id')
      .limit(1);

    if (error) throw error;

    // Notify the agent — best-effort, never allowed to affect the
    // approval itself, which has already succeeded above.
    if (status === 'approved') {
      try {
        const property = rows?.[0];
        if (property?.uploaded_by_agent_id) {
          const agentRes = await supabase.from('users').select('email, full_name').eq('id', property.uploaded_by_agent_id).limit(1);
          const agent = agentRes.data?.[0];
          if (agent?.email) {
            await sendTransactionalEmail({
              type: 'property_approved',
              to: agent.email,
              data: {
                agent_name: agent.full_name || 'there',
                property_title: property.title,
              },
            });
          }
          notifyUser(
            property.uploaded_by_agent_id,
            'property_approved',
            'Your listing is now live',
            `"${property.title}" has been approved and is now visible to students.`,
            '/agent'
          );
        }
      } catch (e) { console.warn('property_approved email failed:', e); }
    }

    return { data: { message: `Property ${status}` } };
  },

  getMyListings: async (userId) => {
    const { data, error } = await supabase
      .from('properties')
      .select('*, locations(name)')
      .eq('uploaded_by_agent_id', userId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return { data: withLocationNames(data) };
  },

  getPending: async () => {
    const { data, error } = await supabase
      .from('properties')
      .select('*, locations(name)')
      .eq('status', 'pending');
    
    if (error) throw error;
    return { data: withLocationNames(data) };
  },

  getAllAdmin: async () => {
    const { data, error } = await supabase
      .from('properties')
      .select('*, locations(name)')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return { data: withLocationNames(data) };
  },
};

// ============== VIEWING REQUEST APIs ==============
// (Property viewings — formerly "inspections". Table names are unchanged
// so historical data and the old fee columns stay intact; viewings are
// now free, so no payment record is created.)

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
    if (property.availability === 'unavailable') {
      throw new Error('This property has already been taken and is no longer accepting viewing requests.');
    }

    const reference = generateReference('VIEW');
    const inspectionId = uuidv4();

    const inspectionFee = Math.max(0, Math.round(Number(property.inspection_fee) || 0));

    // Create the viewing request in a pending payment state. The agent's
    // inspection_fee is the amount the student must pay before the viewing
    // is assigned to the agent. A zero fee remains supported for properties
    // where the agent explicitly chooses to offer a free viewing.
    const { error: insertError } = await supabase
      .from('inspections')
      .insert({
        id: inspectionId,
        user_id: user.id,
        user_name: user.full_name,
        user_email: user.email,
        user_email_override: data.email || null,
        user_phone: data.phone_number || null,
        property_id: data.property_id,
        property_title: property.title,
        agent_id: property.uploaded_by_agent_id,
        agent_name: property.uploaded_by_agent_name,
        inspection_date: data.inspection_date,
        status: inspectionFee > 0 ? 'pending' : 'confirmed',
        payment_status: inspectionFee > 0 ? 'pending' : 'not_required',
        payment_reference: reference
      });

    if (insertError) {
      // RLS blocks unverified students from creating viewing requests.
      if (insertError.code === '42501' || /row-level security/i.test(insertError.message || '')) {
        throw new Error('Your student account must be verified before you can request a viewing.');
      }
      throw insertError;
    }

    const sendMail = sendTransactionalEmail;

    // Free viewing: notify immediately. Paid viewing: confirmation emails are
    // sent by /api/confirm-payment only after KoraPay verification succeeds.
    if (inspectionFee <= 0) {
      try {
        const studentEmail = data.email || user.email;
        if (studentEmail) {
          await sendMail({
            type: 'inspection_booked',
            to: studentEmail,
            data: {
              name: user.full_name || 'there',
              property_title: property.title,
              inspection_date: data.inspection_date,
              reference,
              amount: 0,
            },
          });
        }
      } catch (e) { console.warn('inspection_booked email failed:', e.message); }
    }

    // Tell the agent about a free viewing immediately. Paid viewing
    // notifications are sent by /api/confirm-payment after successful payment.
    if (property.uploaded_by_agent_id && inspectionFee <= 0) {
      try {
        const { data: agent } = await supabase
          .from('users')
          .select('email, full_name')
          .eq('id', property.uploaded_by_agent_id)
          .maybeSingle();
        if (agent?.email) {
          await sendMail({
            type: 'inspection_agent_notify',
            to: agent.email,
            data: {
              agent_name: agent.full_name || property.uploaded_by_agent_name || 'there',
              user_name: user.full_name || 'A student',
              user_email: user.email || '',
              user_phone: data.phone_number || '',
              property_title: property.title,
              inspection_date: data.inspection_date,
              reference,
            },
          });
        }
      } catch (e) { console.warn('inspection_agent_notify email failed:', e.message); }

      notifyUser(
        property.uploaded_by_agent_id,
        'viewing_requested',
        'New viewing request',
        `${user.full_name || 'A student'} requested a viewing of "${property.title}" on ${data.inspection_date}.`,
        '/agent'
      );
    }

    // Tell admins a viewing request came in.
    notifyAdmins({
      title: `New viewing request: ${property.title}`,
      eventLabel: 'New viewing request',
      summary: `${user.full_name || 'A student'} requested a viewing of "${property.title}" on ${data.inspection_date}.`,
      breakdown: [
        ['Property', property.title || '—'],
        ['Student', user.full_name || '—'],
        ['Student email', user.email || '—'],
        ['Agent', property.uploaded_by_agent_name || '—'],
        ['Date', data.inspection_date || '�����'],
      ],
      actionUrl: 'https://www.rentora.com.ng/admin',
    });

    return {
      data: {
        inspection_id: inspectionId,
        reference,
        amount: inspectionFee,
        agent_id: property.uploaded_by_agent_id,
        agent_name: property.uploaded_by_agent_name,
        property_title: property.title,
        inspection_date: data.inspection_date,
        payment_required: inspectionFee > 0,
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
    const { data: viewing, error } = await supabase
      .from('inspections')
      .select('agent_id, agent_name, property_title, inspection_date')
      .eq('id', inspectionId)
      .single();

    if (error || !viewing) throw new Error('Inspection not found');

    // Agent phone comes from users.phone — the number they registered with
    let agentPhone = null;
    if (viewing.agent_id) {
      const { data: agentUser } = await supabase
        .from('users')
        .select('phone')
        .eq('id', viewing.agent_id)
        .single();
      agentPhone = agentUser?.phone || null;
    }

    return {
      data: {
        agent_name: viewing.agent_name,
        agent_phone: agentPhone,
        property_title: viewing.property_title,
        inspection_date: viewing.inspection_date,
      }
    };
  },

  update: async (id, updateData) => {
    const { error } = await supabase
      .from('inspections')
      .update(updateData)
      .eq('id', id);
    
    if (error) throw error;
    return { data: { message: 'Viewing request updated' } };
  }
};

// Preferred name going forward — same object, clearer wording.
export const viewingAPI = inspectionAPI;

// ============== AGENT TIP APIs ==============
// A student can optionally tip the agent assigned to their (free) viewing
// request. Money goes straight to the agent's Rentora balance — Rentora
// takes no cut. Only ONE completed tip is ever allowed per viewing; this
// is enforced both here (checked before inserting) and, as the real
// backstop, by a partial unique index in the DB (see
// 12_agent_tips.sql) so a race between two tabs can't produce two
// paid tips on the same viewing.
export const tipAPI = {
  // Fetch every tip the current student has ever attempted, so the UI can
  // tell which viewings already have a completed tip (hide the button) vs
  // which don't (show it).
  getMyTips: async (userId) => {
    const { data, error } = await supabase
      .from('inspection_tips')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) { console.warn('inspection_tips:', error.message); return { data: [] }; }
    return { data: data || [] };
  },

  // Creates the pending tip row and returns what's needed to open the
  // Korapay checkout. Actual crediting only happens once
  // /api/confirm-payment.js independently verifies the charge and flips
  // this row to 'completed' — never on the client's word alone.
  initiate: async (inspection, amount, user) => {
    const amt = Math.round(Number(amount));
    if (!Number.isFinite(amt) || amt <= 0) throw new Error('Enter a valid tip amount');
    if (!inspection?.agent_id) throw new Error('This viewing has no agent assigned yet, so it can\'t be tipped.');

    // Belt-and-braces client-side check — the DB's partial unique index is
    // the real guarantee, this just avoids a pointless checkout for the
    // common case.
    const { data: existing } = await supabase
      .from('inspection_tips')
      .select('id')
      .eq('inspection_id', inspection.id)
      .eq('status', 'completed')
      .maybeSingle();
    if (existing) throw new Error('You\'ve already tipped the agent for this viewing.');

    const reference = generateReference('TIP');
    const { error } = await supabase
      .from('inspection_tips')
      .insert({
        inspection_id: inspection.id,
        user_id: user.id,
        agent_id: inspection.agent_id,
        amount: amt,
        reference,
        status: 'pending',
      });
    if (error) {
      if (error.code === '23505') throw new Error('You\'ve already tipped the agent for this viewing.');
      throw error;
    }

    return { data: { reference, amount: amt } };
  },
};

// ============== STUDENT VERIFICATION APIs ==============
// School document (student ID card or admission letter) + selfie.
// Every student must be approved before they can use Rentora.

export const studentVerificationAPI = {
  submit: async ({ document_type, document_url, selfie_url, matric_number }, user) => {
    if (!document_url || !selfie_url) {
      throw new Error('Both your school document and a selfie are required.');
    }

    const { data: existing } = await supabase
      .from('student_verification_requests')
      .select('id, status')
      .eq('user_id', user.id)
      .in('status', ['pending', 'approved'])
      .maybeSingle();

    if (existing?.status === 'pending') {
      throw new Error('Your documents are already under review.');
    }
    if (existing?.status === 'approved') {
      throw new Error('Your account is already verified.');
    }

    const requestId = uuidv4();
    const { error } = await supabase
      .from('student_verification_requests')
      .insert({
        id: requestId,
        user_id: user.id,
        user_name: user.full_name,
        user_email: user.email,
        document_type: document_type || 'student_id',
        document_url,
        selfie_url,
        matric_number: matric_number || null,
        status: 'pending',
      });

    if (error) throw error;

    await supabase.from('users').update({ verification_status: 'pending' }).eq('id', user.id);

    notifyAdmins({
      title: `New student verification from ${user.full_name || user.email}`,
      eventLabel: 'Student verification',
      summary: `${user.full_name || 'A student'} submitted their school document and selfie for review.`,
      breakdown: [
        ['Student', user.full_name || '—'],
        ['Email', user.email || '—'],
        ['Document', document_type === 'admission_letter' ? 'Admission letter' : 'Student ID card'],
      ],
      actionUrl: 'https://www.rentora.com.ng/admin',
    });

    return { data: { message: 'Verification submitted', request_id: requestId } };
  },

  getMyRequest: async (userId) => {
    const { data, error } = await supabase
      .from('student_verification_requests')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') throw error;
    return { data };
  },

  getAll: async () => {
    const { data, error } = await supabase
      .from('student_verification_requests')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return { data };
  },

  // Signed URL for the private `verification` bucket so admins can preview
  // documents (images and PDFs) without making the bucket public.
  getSignedDocumentUrl: async (publicUrl) => {
    if (!publicUrl) return null;
    const marker = '/verification/';
    const idx = publicUrl.indexOf(marker);
    if (idx === -1) return publicUrl;
    const path = publicUrl.substring(idx + marker.length).split('?')[0];
    const { data, error } = await supabase.storage
      .from('verification')
      .createSignedUrl(decodeURIComponent(path), 60 * 10);
    if (error) return publicUrl;
    return data?.signedUrl || publicUrl;
  },

  review: async (requestId, status, adminId, adminNote = '') => {
    if (status === 'rejected' && !adminNote.trim()) {
      throw new Error('A reason is required when rejecting a student.');
    }

    const { data: request } = await supabase
      .from('student_verification_requests')
      .select('user_id, user_email, user_name, selfie_url')
      .eq('id', requestId)
      .single();

    if (!request) throw new Error('Verification request not found');

    await supabase
      .from('student_verification_requests')
      .update({
        status,
        admin_note: adminNote || null,
        reviewed_by_admin_id: adminId,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', requestId);

    // Approving releases the student into the app and promotes the selfie
    // to their profile picture.
    const userUpdate = { verification_status: status };
    if (status === 'approved' && request.selfie_url) {
      userUpdate.avatar_url = request.selfie_url;
    }
    await supabase.from('users').update(userUpdate).eq('id', request.user_id);

    const emailType = status === 'approved'
      ? 'student_verification_approved'
      : 'student_verification_rejected';

    try {
      if (request.user_email) {
        await sendTransactionalEmail({
          type: emailType,
          to: request.user_email,
          data: { name: request.user_name || 'there', reason: adminNote || '' },
        });
      }
    } catch (e) { console.warn(`${emailType} email failed:`, e); }

    notifyUser(
      request.user_id,
      emailType,
      status === 'approved' ? 'Student verification approved!' : 'Student verification update',
      status === 'approved'
        ? 'You are now a Verified LAUTECH Student. Welcome to Rentora.'
        : `Your verification was not approved: ${adminNote}`,
      status === 'approved' ? '/browse' : '/verify-account'
    );

    return { data: { message: `Verification ${status}` } };
  }
};



// ============== TRANSACTION APIs ==============

export const transactionAPI = {
  getMyTransactions: async (userId) => {
    const { data: inspTxs } = await supabase
      .from('inspection_transactions')
      .select('*, viewing:inspections(property_id)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    return {
      data: {
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

    notifyAdmins({
      title: `New agent verification request from ${user.full_name || user.email}`,
      eventLabel: 'Agent verification',
      summary: `${user.full_name || 'A user'} applied to become a verified agent and is waiting for review.`,
      breakdown: [
        ['Applicant', user.full_name || '—'],
        ['Email', user.email || '—'],
        ['Address', data.address || '—'],
      ],
      actionUrl: 'https://www.rentora.com.ng/admin',
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
    // Get the request first — user_email/user_name are already stored on
    // the request row itself (captured at submission time), so no extra
    // join to `users` is needed to email/notify the applicant.
    const { data: request } = await supabase
      .from('agent_verification_requests')
      .select('user_id, user_email, user_name')
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

    // Email + in-app notification to the applicant — best-effort, never
    // allowed to affect the status change above (already succeeded).
    if (request && (status === 'approved' || status === 'rejected')) {
      const emailType = status === 'approved' ? 'verification_approved' : 'verification_rejected';
      try {
        if (request.user_email) {
          await sendTransactionalEmail({
            type: emailType,
            to: request.user_email,
            data: { name: request.user_name || 'there' },
          });
        }
      } catch (e) { console.warn(`${emailType} email failed:`, e); }

      notifyUser(
        request.user_id,
        emailType,
        status === 'approved' ? 'Agent verification approved!' : 'Agent verification update',
        status === 'approved'
          ? 'Your agent verification has been approved. You can now list properties.'
          : 'Your agent verification request was not approved this time. Contact support for details.',
        '/agent'
      );
    }
    
    return { data: { message: `Verification ${status}` } };
  }
};

// ============== USER APIs ==============

export const userAPI = {
  getAll: async () => {
    const { data, error } = await supabase
      .from('users')
      .select('id, email, full_name, role, suspended, created_at, phone, avatar_url, last_login_at')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return { data };
  },

  getById: async (userId) => {
    const { data, error } = await supabase
      .from('users')
      .select('id, email, full_name, role, suspended, created_at, phone, avatar_url, last_login_at')
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
  updateProfile: async (userId, { phone, avatar_url }) => {
    const patch = {};
    if (phone !== undefined) patch.phone = phone;
    if (avatar_url !== undefined) patch.avatar_url = avatar_url;

    const { error } = await supabase
      .from('users')
      .update(patch)
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
    // Viewing fees are NOT Rentora revenue anymore — agents keep 100% of
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
        // withdrawal fee. Viewing fees are excluded — 100% goes to agents.
        total_revenue: tokenRevenue + rentServiceFeeRevenue + withdrawalFeeRevenue,
        total_escrow_held: totalEscrowHeld,
        total_rent_payments: rentRows.length,
        held_rent_payments: heldRows.length,
        released_rent_payments: releasedRows.length,
      }
    };
  },

  // Resolve a held rent payment where the property turned out not to be
  // available (or was misrepresented): refunds the student in full via
  // Korapay and soft-delists the property (status -> 'rejected', not
  // 'available' — see /api/admin-refund-payment.js). Admin-only; the
  // server independently re-checks the caller's role from their own token.
  refundRentPayment: async (paymentId, reason, note = '') => {
    const { data: { session } } = await supabase.auth.getSession();
    const accessToken = session?.access_token;
    if (!accessToken) throw new Error('Your session has expired. Please log in again.');

    const res = await fetch('/api/admin-refund-payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` },
      body: JSON.stringify({ payment_id: paymentId, reason, note }),
    });
    const result = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(result.error || 'Failed to process refund.');
    return result;
  },
};

// ============== PAYMENT APIs ==============

export const paymentAPI = {
  initializeKorapay: async (payload) => {
    const res = await fetch('/api/korapay-init', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body?.error || 'Failed to initialize payment');
    return body;
  },
  // Calls the server-side verified confirmation endpoint (/api/confirm-payment)
  // instead of writing to the database directly. That endpoint independently
  // verifies the charge with Korapay using the secret key before marking
  // anything paid — this function no longer trusts the browser's own word
  // that a payment succeeded. Works for token purchases, viewings, and
  // rent (the endpoint auto-detects which one based on the reference).
  confirmPayment: async (reference) => {
    const res = await fetch('/api/confirm-payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reference }),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body?.error || 'Failed to confirm payment');
    return { data: body };
  },
};

// ============== STORAGE APIs ==============

export const storageAPI = {
  uploadImage: async (rawFile, bucket = 'property-images', compressOptions = null) => {
    // Compress client-side so oversized camera photos never hit storage.
    const file = await compressImage(rawFile, { maxWidthOrHeight: 1600, maxSizeMB: 0.5, ...(compressOptions || {}) });
    const fileExt = file.name.split('.').pop();
    const fileName = `${uuidv4()}.${fileExt}`;

    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(fileName, file, { contentType: file.type, cacheControl: '31536000' });
    
    if (error) throw error;
    
    const { data: { publicUrl } } = supabase.storage
      .from(bucket)
      .getPublicUrl(fileName);
    
    return { data: { url: publicUrl, path: data.path } };
  },

  // Used by BecomeAgent.jsx and the student verification page — uploads to
  // the private `verification` bucket. PDFs are uploaded as-is; only images
  // are compressed.
  uploadFile: async (rawFile, folder = 'verification') => {
    const isPdf = rawFile.type === 'application/pdf' || /\.pdf$/i.test(rawFile.name || '');
    // ID cards / selfies still need to stay legible, so compress a bit gentler.
    const file = isPdf
      ? rawFile
      : await compressImage(rawFile, { maxWidthOrHeight: 1000, maxSizeMB: 0.4, initialQuality: 0.8 });
    const fileExt = (file.name.split('.').pop() || 'jpg');
    const fileName = `${folder}-${uuidv4()}.${fileExt}`;

    const bucket = 'verification';

    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(fileName, file, { contentType: file.type, cacheControl: '31536000' });

    if (error) throw error;

    const { data: { publicUrl } } = supabase.storage
      .from(bucket)
      .getPublicUrl(fileName);

    return { data: { url: publicUrl, path: data.path } };
  },

  // Removes a previously uploaded file given its public URL (best-effort —
  // failures here shouldn't block the calling flow, just log a warning).
  deleteImage: async (publicUrl, bucket) => {
    if (!publicUrl) return;
    try {
      const marker = `/${bucket}/`;
      const idx = publicUrl.indexOf(marker);
      if (idx === -1) return;
      const path = publicUrl.substring(idx + marker.length);
      await supabase.storage.from(bucket).remove([path]);
    } catch (e) {
      console.warn('Failed to delete old file from storage (non-critical):', e.message);
    }
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

// ============== REPORT-A-LISTING APIs ==============

export const reportAPI = {
  // Requires login — reporter_id must match auth.uid() per RLS.
  submit: async ({ property_id, reason, details }, user) => {
    const { error } = await supabase
      .from('property_reports')
      .insert({
        property_id,
        reporter_id: user.id,
        reporter_name: user.full_name,
        reporter_email: user.email,
        reason,
        details: details || null,
      });
    if (error) throw new Error(error.message || 'Failed to submit report');

    notifyAdmins({
      title: `New property report: ${reason}`,
      eventLabel: 'Property report',
      summary: `${user.full_name || 'A user'} reported a property listing.`,
      breakdown: [
        ['Reporter', user.full_name || '—'],
        ['Reporter email', user.email || '—'],
        ['Reason', reason || '—'],
        ['Details', details || '—'],
      ],
      actionUrl: 'https://www.rentora.com.ng/admin',
    });

    return { data: { ok: true } };
  },

  // Admin only (RLS-enforced) — includes the reported property's title
  // and location via the FK relationship to properties.
  getAll: async () => {
    const { data, error } = await supabase
      .from('property_reports')
      .select('*, property:properties(title, location_text)')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return { data: data || [] };
  },

  resolve: async (id, status, adminNote, adminId) => {
    const { error } = await supabase
      .from('property_reports')
      .update({
        status,
        admin_note: adminNote || null,
        resolved_by: adminId,
        resolved_at: new Date().toISOString(),
      })
      .eq('id', id);
    if (error) throw error;
    return { data: { ok: true } };
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
        phone: data.phone,
        subject: data.subject,
        message: data.message,
        status: 'unread',
      });
    if (error) throw error;

    // Contact page is public — most senders are NOT logged in, so
    // notifyAdmins() (which auths with the caller's session token, falling
    // back to the anon key) gets a silent 401 from the send-email edge
    // function and no email ever goes out. Use the server-side endpoint
    // instead, which works whether or not the sender has a session.
    // Best-effort: a failed notification should never block the message
    // from being saved.
    try {
      await fetch('/api/notify-contact-admins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.name,
          email: data.email,
          phone: data.phone,
          subject: data.subject,
          message: data.message,
        }),
      });
    } catch (e) {
      console.warn('notify-contact-admins failed:', e.message);
    }

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

  // Persists the admin's reply text on the message row so it's still
  // visible after a refresh/navigation. Call this AFTER the reply email
  // (frontend/api/send-reply.js) succeeds — this is the "did we actually
  // record it" step, separate from "did the email send" step.
  reply: async (id, replyText, adminId) => {
    const { data, error } = await supabase
      .from('contact_messages')
      .update({
        admin_reply: replyText,
        replied_at: new Date().toISOString(),
        replied_by: adminId || null,
        status: 'read',
      })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return { data };
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
  // viewing fees (100% to agent) and released rent agent fees into one
  // sorted list, since agent_balances only stores a running total, not a
  // per-transaction ledger.
  getEarningsHistory: async (agentId) => {
    const [inspectionRes, rentRes, tipsRes] = await Promise.all([
      supabase
        .from('inspection_transactions')
        .select('id, amount, created_at, viewing:inspections!inner(agent_id, property:properties(title))')
        .eq('status', 'completed')
        .eq('viewing.agent_id', agentId),
      supabase
        .from('property_rent_payments')
        .select('id, rent_amount, agent_fee, caution_fee, released_at, property:properties(title)')
        .eq('agent_id', agentId)
        .eq('status', 'released'),
      supabase
        .from('inspection_tips')
        .select('id, amount, completed_at, user_id, inspection:inspections(property:properties(title))')
        .eq('status', 'completed')
        .eq('agent_id', agentId),
    ]);

    const inspectionRows = (inspectionRes.data || []).map((tx) => ({
      id: `insp_${tx.id}`,
      type: 'inspection',
      label: 'Inspection Fee',
      property_title: tx.inspection?.property?.title || 'Property',
      amount: Number(tx.amount || 0),
      date: tx.created_at,
    }));

    // Rent, agent fee, and caution fee are all released to the agent as one
    // payout — service fee is Rentora's cut and is never part of this.
    const rentRows = (rentRes.data || []).map((rp) => ({
      id: `rent_${rp.id}`,
      type: 'rent_agent_fee',
      label: 'Rent Released',
      property_title: rp.property?.title || 'Property',
      amount: Number(rp.rent_amount || 0) + Number(rp.agent_fee || 0) + Number(rp.caution_fee || 0),
      date: rp.released_at,
    }));

    // Tips go straight to the agent's balance with no Rentora cut (see
    // 12_agent_tips.sql) — fetched separately here so they show up in the
    // same Earnings History list instead of only being reflected silently
    // in the total balance.
    const tipRows = tipsRes.data || [];
    const tipperIds = [...new Set(tipRows.map((t) => t.user_id).filter(Boolean))];
    let tippersById = {};
    if (tipperIds.length) {
      const { data: tippers } = await supabase.from('users').select('id, full_name').in('id', tipperIds);
      tippersById = Object.fromEntries((tippers || []).map((u) => [u.id, u.full_name]));
    }
    const tipRowsMapped = tipRows.map((t) => ({
      id: `tip_${t.id}`,
      type: 'tip',
      label: 'Tip Received',
      property_title: t.inspection?.property?.title || 'Property',
      tipper_name: tippersById[t.user_id] || 'A student',
      amount: Number(t.amount || 0),
      date: t.completed_at,
    }));

    const combined = [...inspectionRows, ...rentRows, ...tipRowsMapped].sort(
      (a, b) => new Date(b.date || 0) - new Date(a.date || 0)
    );
    return { data: combined };
  },
};

// ============== WITHDRAWAL APIs ==============

export const withdrawalAPI = {
  WITHDRAWAL_FEE_PCT: 0,
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

// Withdrawals have no Rentora fee; the requested amount is paid in full.
  const fee = 0;
  const net = Number(amount);

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

    notifyAdmins({
      title: `New withdrawal request from ${agentName || agentEmail}`,
      eventLabel: 'Withdrawal request',
      summary: `${agentName || 'An agent'} requested a payout. It needs to be processed and marked paid once sent.`,
      breakdown: [
        ['Agent', agentName || '—'],
        ['Agent email', agentEmail || '—'],
        ['Amount requested', `NGN ${Number(amount).toLocaleString('en-NG')}`],
        ['Withdrawal fee', 'NGN 0'],
        ['Net payout', `NGN ${net.toLocaleString('en-NG')}`],
        ['Bank', bankName || '—'],
        ['Account number', accountNumber || '—'],
        ['Account name', accountName || '—'],
      ],
      actionUrl: 'https://www.rentora.com.ng/admin',
    });

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

  // The DB trigger trg_settle_withdrawal_on_paid (migration v17) now
  // atomically re-validates this amount against the agent's CURRENT
  // available balance and increments total_withdrawn itself — this no
  // longer needs to fetch/compute/update balance from the client, which
  // was vulnerable to a race condition (two withdrawals paid at once
  // could both pass a stale balance check). If the trigger rejects this
  // (balance changed since the request was made), the update throws and
  // status stays unpaid — surfaced to the admin as an error.
  markPaid: async (requestId, adminId) => {
    const { error } = await supabase
      .from('withdrawal_requests')
      .update({ status: 'paid', resolved_at: new Date().toISOString(), resolved_by: adminId })
      .eq('id', requestId);
    if (error) throw new Error(error.message || 'Failed to mark withdrawal as paid');
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
  reportAPI,
  contactAPI,
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
  // Agency fee is entered on the property and snapshotted into this payment
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
    // Rent, agent fee and caution fee are all credited to the listing
    // agent's wallet — the property owner is no longer paid directly, so
    // no bank details are required to start a rent payment.

    const feePct = 3.5;
    const rentAmount = Number(property.price) || 0;
    const agentFee = Number(property.agency_fee ?? property.agent_fee) || 0;
    const agreementFee = Number(property.agreement_fee) || 0;
    const cautionFee = Number(property.caution_fee) || 0;
    const inspectionFee = 0; // Rental checkout does not charge the legacy viewing/inspection fee.
    const documentationFee = Number(property.documentation_fee) || 0;
    const otherFees = Array.isArray(property.other_fees)
      ? property.other_fees.map((fee) => ({ name: String(fee.name || 'Other Fee'), amount: Math.max(0, Math.round(Number(fee.amount) || 0)) })).filter((fee) => fee.amount > 0)
      : [];
    const otherFeesTotal = otherFees.reduce((sum, fee) => sum + fee.amount, 0);
    const serviceFee = Math.round(rentAmount * 0.035);
    const totalAmount = rentAmount + agentFee + agreementFee + cautionFee + inspectionFee + documentationFee + otherFeesTotal + serviceFee;
    const reference     = generateReference('RENT');

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
        agreement_fee: agreementFee,
        caution_fee: cautionFee,
        inspection_fee: inspectionFee,
        documentation_fee: documentationFee,
        other_fees: otherFees,
        other_fees_total: otherFeesTotal,
        service_fee: serviceFee,
        total_amount: totalAmount,
        reference,
        status: 'pending',
        auto_release_at: autoRelease.toISOString(),
        // Snapshot the owner contact info at payment time for the receipt.
        // Payout details are no longer stored — the agent is the payee.
        owner_name: property.owner_full_name,
        owner_phone: property.owner_phone,
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
        agency_fee: agentFee,
        agreement_fee: agreementFee,
        caution_fee: cautionFee,
        inspection_fee: inspectionFee,
        documentation_fee: documentationFee,
        other_fees: otherFees,
        other_fees_total: otherFeesTotal,
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
    // Includes 'refunded' alongside 'held'/'released' so a booking that was
    // cancelled and refunded to the student is shown plainly on the Agent
    // Dashboard too, instead of just disappearing from view.
    const { data, error } = await supabase
      .from('property_rent_payments')
      .select('id, property_id, user_id, status, rent_amount, agent_fee, caution_fee, agreement_fee, inspection_fee, documentation_fee, other_fees, other_fees_total, service_fee, total_amount, reference, held_at, released_at, auto_release_at, refunded_at, refund_reason, admin_note, created_at, property:properties(title, locations(name)), student:users!property_rent_payments_user_id_fkey(full_name, email, phone)')
      .eq('agent_id', agentId)
      .in('status', ['held', 'released', 'refunded'])
      .order('created_at', { ascending: false });
    if (error) {
      // Fall back to the narrower shape if the join name differs — never break the dashboard.
      const fallback = await supabase
        .from('property_rent_payments')
        .select('id, property_id, user_id, status, rent_amount, agent_fee, caution_fee, agreement_fee, inspection_fee, documentation_fee, other_fees, other_fees_total, service_fee, total_amount, reference, held_at, released_at, auto_release_at, refunded_at, refund_reason, admin_note, created_at')
        .eq('agent_id', agentId)
        .in('status', ['held', 'released', 'refunded'])
        .order('created_at', { ascending: false });
      if (fallback.error) throw fallback.error;
      return { data: fallback.data || [] };
    }
    return { data: data || [] };
  },

  // Calls the server-side verified confirmation endpoint — no longer
  // writes directly to the database or trusts the browser's own claim
  // that Korapay succeeded. See /api/confirm-payment.js. The endpoint
  // handles the agent/student notification emails itself, only on the
  // actual first transition (never on a repeat call), which also closes
  // the duplicate-email risk from a double-fired success callback.
  markHeld: async (reference, koralpayRef) => {
    const res = await fetch('/api/confirm-payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reference }),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body?.error || 'Failed to confirm rent payment');
    return { data: body };
  },

  // Student reports move-in (uploads proof photo) — this NO LONGER releases
  // funds directly. It puts the payment into 'move_in_reported' so an admin
  // can preview the photo and confirm before Rentora releases money to the
  // agent. The DB also enforces this: rent_payments_update_own only allows
  // a student to move status held -> move_in_reported, never -> released.
  confirmMoveIn: async (rentPaymentId, userId, moveInPhotoUrl) => {
    const { data: updatedRows, error } = await supabase
      .from('property_rent_payments')
      .update({
        status: 'move_in_reported',
        move_in_reported_at: new Date().toISOString(),
        move_in_photo_url: moveInPhotoUrl || null,
      })
      .eq('id', rentPaymentId)
      .eq('user_id', userId)
      .eq('status', 'held')
      .select('id, reference, rent_amount, property:properties(title), student:users!property_rent_payments_user_id_fkey(full_name, email)');
    if (error) throw error;

    // No row matched — already reported (slow double-click / retry), or not
    // actually held. Don't treat this as a failure either way.
    if (!updatedRows || updatedRows.length === 0) return;

    const row = updatedRows[0];
    notifyAdmins({
      title: `Move-in reported: ${row.property?.title || 'a property'}`,
      eventLabel: 'Move-in review needed',
      summary: `${row.student?.full_name || 'A student'} reported moving in and uploaded proof. Review the photo and release funds to the agent once confirmed.`,
      breakdown: [
        ['Property', row.property?.title || '—'],
        ['Student', row.student?.full_name || '—'],
        ['Student email', row.student?.email || '—'],
        ['Reference', row.reference || '—'],
        ['Rent amount', row.rent_amount ? `NGN ${Number(row.rent_amount).toLocaleString('en-NG')}` : '—'],
      ],
      actionUrl: 'https://www.rentora.com.ng/admin',
    });
  },

  // Admin previews the move-in photo and confirms it's genuine → THIS is
  // what actually releases funds to the agent (moves status to 'released',
  // which fires release_rent_to_agent() and credits agent_balances).
  adminConfirmMoveIn: async (rentPaymentId, adminId) => {
    const { data: updatedRows, error } = await supabase
      .from('property_rent_payments')
      .update({
        status: 'released',
        released_by: 'admin',
        released_at: new Date().toISOString(),
      })
      .eq('id', rentPaymentId)
      .eq('status', 'move_in_reported')
      .select('id');
    if (error) throw error;
    if (!updatedRows || updatedRows.length === 0) {
      throw new Error('This payment is no longer awaiting move-in review (already released, or not reported yet).');
    }

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
        const [agentRes, studentRes] = await Promise.all([
          row.agent_id ? supabase.from('users').select('email, full_name').eq('id', row.agent_id).limit(1) : Promise.resolve({ data: [] }),
          supabase.from('users').select('email, full_name').eq('id', row.user_id).limit(1),
        ]);
        const agent = agentRes.data?.[0];
        const student = studentRes.data?.[0];
        const sendMail = sendTransactionalEmail;
        if (agent?.email) {
          await sendMail({
            type: 'rent_payment_released',
            to: agent.email,
            data: {
              agent_name: agent.full_name || 'there',
              property_title: row.property?.title || 'your property',
              rent_amount: row.rent_amount,
              agent_fee: row.agent_fee,
              caution_fee: row.caution_fee,
              reference: row.reference,
            },
          });
        }
        if (row.agent_id) {
          notifyUser(
            row.agent_id,
            'rent_payment_released',
            'Funds released',
            `Rent for ${row.property?.title || 'your property'} has been released to your balance.`,
            '/agent'
          );
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
        notifyUser(
          row.user_id,
          'rent_payment_released_student',
          'Move-in confirmed',
          `Your move-in for ${row.property?.title || 'the property'} is confirmed.`,
          '/profile'
        );
      }
    } catch (e) { console.warn('rent_payment_released email failed:', e); }
  },

  // Admin queue: rent payments awaiting move-in photo review.
  getMoveInReviewQueue: async () => {
    const { data, error } = await supabase
      .from('property_rent_payments')
      .select('*, property:properties(title, locations(name)), student:users!property_rent_payments_user_id_fkey(full_name, email, phone)')
      .eq('status', 'move_in_reported')
      .order('move_in_reported_at', { ascending: true });
    if (error) throw error;
    return { data: (data || []).map(r => ({ ...r, property: withLocationName(r.property) })) };
  },

  // Rent payments for the logged-in user (their held/released receipts).
  getMyPayments: async (userId) => {
    const { data, error } = await supabase
      .from('property_rent_payments')
      .select('*, property:properties(*, locations(name))')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return { data: (data || []).map(r => ({ ...r, property: withLocationName(r.property) })) };
  },

  // Admin visibility into every rent payment — used by the Escrow tab so
  // admins can see exactly which payments are currently held, not just a
  // total figure.
  getAllForAdmin: async () => {
    const { data, error } = await supabase
      .from('property_rent_payments')
      .select('*, property:properties(title, location_id, locations(name)), student:users!property_rent_payments_user_id_fkey(full_name, email, phone)')
      .order('created_at', { ascending: false });
    if (error) { console.warn('property_rent_payments:', error.message); return { data: [] }; }
    return { data: (data || []).map(r => ({ ...r, property: withLocationName(r.property) })) };
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
