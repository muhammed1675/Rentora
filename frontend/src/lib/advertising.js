import { supabase } from './supabase';
import { v4 as uuidv4 } from 'uuid';

export const AD_SLOT_SPECS = {
  home_hero: { label: 'Home hero', width: 1200, height: 400 },
  browse_banner: { label: 'Browse banner', width: 1200, height: 300 },
  property_sidebar: { label: 'Property sidebar', width: 400, height: 600 },
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
    const { data, error } = await supabase.rpc('create_pending_ad', {
      p_idempotency_key: payload.idempotencyKey,
      p_slot: payload.slot,
      p_duration_days: payload.durationDays,
      p_advertiser_name: payload.advertiserName,
      p_whatsapp: payload.whatsapp,
      p_destination_url: payload.destinationUrl,
      p_creative_url: payload.creativeUrl,
      p_creative_path: payload.creativePath,
    });
    if (error) throw error;
    return data;
  },
  incrementClick: async (id) => { await supabase.rpc('increment_ad_click', { p_ad_id: id }); },
  getPublicAd: async (id) => {
    const { data, error } = await supabase.from('advertisements').select('id, advertiser_name, slot, destination_url, creative_url, headline, description').eq('id', id).eq('status', 'approved').eq('payment_status', 'paid').maybeSingle();
    if (error) throw error;
    return data;
  },
};

export const safeExternalUrl = (value) => {
  try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) ? url.href : ''; } catch { return ''; }
};
