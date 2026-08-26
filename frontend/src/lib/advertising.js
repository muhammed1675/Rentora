import { supabase } from './supabase';
import { v4 as uuidv4 } from 'uuid';

// The dedicated advertising portal. Every "Advertise here" CTA on the main
// rentora.com.ng site must send prospective advertisers here — never to
// https://www.rentora.com.ng/advertise (a different, non-existent
// destination on the main domain).
export const ADVERTISE_PORTAL_URL = 'https://advertise.rentora.com.ng/';

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

// Human-readable label written to ads.billing_period. This column is
// NOT NULL, and the very first insert (createPendingAd, below) happens
// before any server round-trip, so it must be set here too — not just
// in the later server-side price update. This mapping is purely
// descriptive (weekly/biweekly/monthly), never a price, so setting it
// client-side does not weaken payment integrity: the browser-supplied
// value is unconditionally overwritten by advertisingAPI.initPayment
// (server-side, from api/advertise-init-payment.js) once checkout
// starts, using the same mapping. Keep this identical to
// billingPeriodLabel in api/_advertising.js.
export const billingPeriodLabel = (durationDays) => {
  const days = Number(durationDays);
  if (days === 7) return 'weekly';
  if (days === 14) return 'biweekly';
  if (days === 30) return 'monthly';
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
    // `price` IS set here — as a client-side ESTIMATE only — because the
    // `ads.price` column is NOT NULL with no database default, so this
    // insert fails outright without it. This value is never trusted for
    // billing: advertisingAPI.initPayment (via /api/advertise-init-payment.js)
    // overwrites it moments later with the authoritative, server-computed
    // price from ad_slot_config before any Korapay charge is created, and
    // confirm-payment.js verifies the paid amount against that
    // server-written value, never this one. `billing_period` is set here
    // too for the same NOT-NULL reason and is likewise overwritten
    // server-side.
    const startsAt = new Date();
    const endsAt = new Date(startsAt.getTime() + Number(payload.durationDays) * 86400000);
    const estimatedPrice = estimateAdPrice(payload.slotConfig, payload.durationDays);
    const { data, error } = await supabase.from('ads').insert({
      user_id: payload.userId,
      full_name: payload.advertiserName.trim(),
      business_name: payload.advertiserName.trim(),
      whatsapp_number: payload.whatsapp,
      link_url: payload.destinationUrl,
      slot: payload.slot,
      ad_text: [payload.headline, payload.description].filter(Boolean).join(' — '),
      image_url: payload.creativeUrl,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      billing_period: billingPeriodLabel(payload.durationDays),
      price: Number.isFinite(estimatedPrice) && estimatedPrice > 0 ? estimatedPrice : 0,
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
  incrementClick: async (id) => { await supabase.rpc('increment_ad_click', { p_ad_id: id }); },
  getPublicAd: async (id) => {
    const { data, error } = await supabase.from('ads').select('id, full_name, business_name, slot, image_url, ad_text, whatsapp_number, link_url, starts_at, ends_at').eq('id', id).in('status', ['approved', 'active']).in('payment_status', ['paid', 'completed']).maybeSingle();
    if (error) throw error;
    const now = new Date().toISOString();
    return data && (!data.starts_at || data.starts_at <= now) && (!data.ends_at || data.ends_at >= now) ? data : null;
  },
};

export const safeExternalUrl = (value) => {
  try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) ? url.href : ''; } catch { return ''; }
};