import { supabase } from './supabase';
import { v4 as uuidv4 } from 'uuid';

export const AD_SLOT_SPECS = {
  header_billboard: { label: 'Header billboard', width: 970, height: 250 },
  mid_page_content: { label: 'Mid-page content', width: 728, height: 90 },
  in_feed_banner: { label: 'In-feed banner', width: 300, height: 200 },
};

// DISPLAY-ONLY estimate shown to the advertiser before checkout. The real,
// authoritative price is always computed server-side in
// /api/advertise-init-payment.js (from the same ad_slot_config row) — that
// server figure, never this one, is what gets charged and later verified.
// Keep the 7/14/30-day mapping identical to api/_advertising.js.
export const estimateAdPrice = (slotConfig, durationDays) => {
  const days = Number(durationDays);
  const weekly = Number(slotConfig?.weekly_price ?? slotConfig?.price_per_week);
  const monthly = Number(slotConfig?.monthly_price ?? slotConfig?.price_per_month);
  if (days === 7) return Number.isFinite(weekly) ? weekly : 0;
  if (days === 14) return Number.isFinite(weekly) ? weekly * 2 : 0;
  if (days === 30) return Number.isFinite(monthly) ? monthly : 0;
  return 0;
};

// Database constraint: ads.billing_period IN ('week', 'month'). This column
// is NOT NULL, and the very first insert (createPendingAd, below) happens
// before any server round-trip, so it must be set here too — not just in
// the later server-side price update. A 14-day campaign is still billed
// weekly (2x rate), so it's still 'week' — only 30 days is 'month'. Setting
// this client-side does not weaken payment integrity: the browser-supplied
// value is unconditionally overwritten by advertisingAPI.initPayment
// (server-side, from api/advertise-init-payment.js) once checkout starts,
// using the same mapping. Keep this identical to billingPeriodLabel in
// api/_advertising.js.
export const billingPeriodLabel = (durationDays) => {
  const days = Number(durationDays);
  if (days === 7 || days === 14) return 'week';
  if (days === 30) return 'month';
  return null;
};

export const normalizeWhatsApp = (value) => {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.startsWith('234')) return `+${digits}`;
  if (digits.startsWith('0') && digits.length === 11) return `+234${digits.slice(1)}`;
  return digits.length >= 10 ? `+${digits}` : '';
};

export const validateCreative = (file, slot) => {
  const spec = AD_SLOT_SPECS[slot];
  if (!file || !spec) return 'Choose an ad slot and creative.';
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return 'Creative must be JPG, PNG, or WebP.';
  if (file.size > 5 * 1024 * 1024) return 'Creative must be 5 MB or smaller.';
  return null;
};

export const advertisingAPI = {
  getSlotConfig: async () => {
    // ad_slot_config has no is_active column — every configured slot is
    // returned; max_concurrent_ads governs how many ads run per slot, not
    // whether the slot itself is offered.
    const { data, error } = await supabase.from('ad_slot_config').select('*').order('slot');
    if (error) throw error;
    return data || [];
  },
  uploadCreative: async (file) => {
    const path = `advertisements/${uuidv4()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '')}`;
    const { data, error } = await supabase.storage.from('ads').upload(path, file, { contentType: file.type, upsert: false });
    if (error) throw error;
    const { data: urlData } = supabase.storage.from('ads').getPublicUrl(data.path);
    return { path: data.path, url: urlData.publicUrl };
  },
  createPendingAd: async (payload) => {
    // Note: no `status` or `payment_status` are set here — the table
    // defaults apply. `price` and `billing_period` ARE set here because
    // both columns are NOT NULL and this insert runs before any server
    // round-trip. `price` is just the same display estimate already shown
    // to the advertiser (estimateAdPrice, computed from ad_slot_config) —
    // it is NOT trusted for payment. The moment checkout starts, the
    // server unconditionally overwrites this with its own computed value
    // (see api/advertise-init-payment.js, step 4: `.update({ price: amount,
    // billing_period })`), so a browser-supplied number here can never
    // change what gets charged or verified.
    const startsAt = new Date();
    const endsAt = new Date(startsAt.getTime() + Number(payload.durationDays) * 86400000);
    const { data, error } = await supabase.from('ads').insert({
      user_id: payload.userId,
      full_name: payload.advertiserName.trim(),
      business_name: payload.advertiserName.trim(),
      whatsapp_number: payload.whatsapp,
      link_url: payload.destinationUrl,
      slot: payload.slot,
      ad_text: [payload.headline, payload.description].filter(Boolean).join(' — '),
      message_body: payload.description?.trim() || null,
      image_url: payload.creativeUrl,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      billing_period: billingPeriodLabel(payload.durationDays),
      price: payload.price,
    }).select('*').single();
    if (error) throw error;
    return data;
  },
  // Server-side price + Korapay init. The browser sends only which advert
  // it's paying for and where to bounce back to — never an amount. See
  // /api/advertise-init-payment.js for the authoritative pricing.
  initPayment: async (adId, redirectUrl) => {
    const { data: { session } } = await supabase.auth.getSession();
    const accessToken = session?.access_token;
    if (!accessToken) throw new Error('Your session has expired. Please log in again.');
    const res = await fetch('/api/advertise-init-payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ ad_id: adId, redirect_url: redirectUrl }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body?.error || 'Failed to start payment for this advert.');
    return body;
  },
  // Admin-only: edit a slot's pricing / concurrency cap. Direct table write —
  // same pattern already used elsewhere in AdminDashboard for admin-only
  // config (e.g. agent_invites, student verification) — not an RPC, because
  // unlike `ads`, ad_slot_config has no public write path for a regular
  // user to abuse. `updates` must only contain keys already present on the
  // row returned by getSlotConfig, so this never assumes a column name
  // that isn't confirmed to exist.
  updateSlotConfig: async (slot, updates) => {
    const { data, error } = await supabase.from('ad_slot_config').update(updates).eq('slot', slot).select('*').single();
    if (error) throw error;
    return data;
  },
  incrementClick: async (id) => { await supabase.rpc('increment_ad_click', { p_ad_id: id }); },
  getPublicAd: async (id) => {
    const { data, error } = await supabase.from('ads').select('id, full_name, business_name, slot, image_url, ad_text, message_body, whatsapp_number, link_url, starts_at, ends_at').eq('id', id).in('status', ['approved', 'active']).in('payment_status', ['paid', 'completed']).maybeSingle();
    if (error) throw error;
    const now = new Date().toISOString();
    return data && (!data.starts_at || data.starts_at <= now) && (!data.ends_at || data.ends_at >= now) ? data : null;
  },
};

export const safeExternalUrl = (value) => {
  try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) ? url.href : ''; } catch { return ''; }
};
