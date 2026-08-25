import { supabase } from './supabase';
import { v4 as uuidv4 } from 'uuid';

export const AD_SLOT_SPECS = {
  header_billboard: { label: 'Header billboard', width: 970, height: 250 },
  mid_page_content: { label: 'Mid-page content', width: 728, height: 90 },
  in_feed_banner: { label: 'In-feed banner', width: 300, height: 200 },
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
    const { data, error } = await supabase.from('ad_slot_config').select('*').eq('is_active', true).order('slot');
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
    const startsAt = new Date();
    const endsAt = new Date(startsAt.getTime() + Number(payload.durationDays) * 86400000);
    const { data, error } = await supabase.from('ads').insert({
      full_name: payload.advertiserName.trim(),
      business_name: payload.advertiserName.trim(),
      whatsapp_number: payload.whatsapp,
      slot: payload.slot,
      ad_text: [payload.headline, payload.description].filter(Boolean).join(' — '),
      image_url: payload.creativeUrl,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      status: 'pending',
      payment_status: 'pending',
    }).select('*').single();
    if (error) throw error;
    return data;
  },
  incrementClick: async (id) => { await supabase.rpc('increment_ad_click', { p_ad_id: id }); },
  getPublicAd: async (id) => {
    const { data, error } = await supabase.from('ads').select('id, full_name, business_name, slot, image_url, ad_text, whatsapp_number, starts_at, ends_at').eq('id', id).in('status', ['approved', 'active']).in('payment_status', ['paid', 'completed']).maybeSingle();
    if (error) throw error;
    const now = new Date().toISOString();
    return data && (!data.starts_at || data.starts_at <= now) && (!data.ends_at || data.ends_at >= now) ? data : null;
  },
};

export const safeExternalUrl = (value) => {
  try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) ? url.href : ''; } catch { return ''; }
};
