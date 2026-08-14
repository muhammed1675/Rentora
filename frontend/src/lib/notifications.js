// lib/notifications.js
//
// In-app notifications. Runs alongside the existing email system (see
// auth.js / api.js / api/confirm-payment.js) — it does not replace it.
//
// notifyUser() is called at the exact same moments the app already sends
// an email (e.g. property approved, rent released), so the same event
// produces both an email AND a bell notification.
//
// Two sources feed the same bell/page:
//  - user_notifications: one row per (user, event) — personal.
//  - admin_broadcasts:   one row per admin message, fanned out to every
//    matching user at READ time (not write time) via broadcast_reads for
//    per-user read state. See supabase/schema/13_admin_broadcasts.sql.
// useNotifications() merges both into a single, sorted list so the bell,
// the popover, and the /notifications page don't need to know two sources
// exist.
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from './supabase';

// Fire-and-forget, same non-blocking pattern as the email calls elsewhere
// in the app: never throws, never blocks the calling action.
export async function notifyUser(userId, type, title, body, link = null) {
  if (!userId) return;
  try {
    const { error } = await supabase.rpc('create_notification', {
      p_user_id: userId,
      p_type: type,
      p_title: title,
      p_body: body,
      p_link: link,
    });
    if (error) throw error;
  } catch (e) {
    console.warn(`notifyUser(${type}) failed (non-critical):`, e.message);
  }
}

// Admin-only. Sends one message to every user, or to just students/agents.
// Used by AdminDashboard's Broadcasts tab. p_target: 'all' | 'user' | 'agent'.
export async function sendBroadcast(title, body, target = 'all', link = null) {
  const { data, error } = await supabase.rpc('send_broadcast', {
    p_title: title,
    p_body: body,
    p_target: target,
    p_link: link,
  });
  if (error) throw error;
  return data; // new broadcast id
}

// Admin-only. Emails an already-created broadcast to every matching user's
// email address, via /api/broadcast-email (Resend, batched server-side).
// The endpoint claims each broadcast_id exactly once, so calling it twice for
// the same broadcast is a no-op ({ already_sent: true }) rather than a
// duplicate blast. See supabase/schema/18_broadcast_emails.sql.
export async function sendBroadcastEmail({ broadcastId, title, body, target = 'all', link = null, linkLabel = null }) {
  const { data: { session } } = await supabase.auth.getSession();
  const accessToken = session?.access_token;
  if (!accessToken) throw new Error('Your session expired — log in again to send emails.');

  const res = await fetch('/api/broadcast-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({
      broadcast_id: broadcastId,
      title,
      message: body,
      target,
      link,
      link_label: linkLabel,
    }),
  });

  let payload = null;
  try { payload = await res.json(); } catch { /* non-JSON error page */ }
  if (!res.ok) throw new Error(payload?.error || `Email send failed (${res.status})`);
  return payload; // { recipients, sent, failed, already_sent? }
}

const PAGE_SIZE = 30;
const dismissedKey = (userId) => `rentora:dismissed_broadcasts:${userId}`;

function loadDismissed(userId) {
  try {
    return new Set(JSON.parse(localStorage.getItem(dismissedKey(userId)) || '[]'));
  } catch {
    return new Set();
  }
}

function saveDismissed(userId, set) {
  try {
    localStorage.setItem(dismissedKey(userId), JSON.stringify([...set]));
  } catch {
    // storage unavailable (private mode, quota) — dismiss is session-only, fine
  }
}

// Normalizes a row from either source into the shape the UI renders, plus
// a `source` tag so markAsRead/delete know which table to act on.
function fromPersonal(row) {
  return { ...row, source: 'personal' };
}
function fromBroadcast(row, readAt) {
  return {
    id: row.id,
    type: 'broadcast',
    title: row.title,
    body: row.body,
    link: row.link,
    created_at: row.created_at,
    read_at: readAt || null,
    source: 'broadcast',
  };
}

// Live list + unread count for the current user, merging personal
// notifications and targeted admin broadcasts. Subscribes to Realtime so
// the bell updates immediately without a page refresh or polling.
export function useNotifications(userId, role) {
  const [personal, setPersonal] = useState([]);
  const [broadcasts, setBroadcasts] = useState([]); // normalized, already merged with read state
  const [loading, setLoading] = useState(true);
  const dismissed = useRef(new Set());
  // Every hook instance (bell + notifications page can be mounted at the same
  // time, and StrictMode mounts effects twice) needs its OWN channel topic.
  // Re-using one topic makes supabase-js hand back an already-subscribed
  // channel, and calling .on('postgres_changes') on it throws
  // "cannot add postgres_changes callbacks ... after subscribe()", which
  // crashed the notifications page to a blank screen.
  const instanceId = useRef(Math.random().toString(36).slice(2));

  const matchesRole = useCallback((target) => target === 'all' || target === role, [role]);

  const load = useCallback(async () => {
    if (!userId) { setPersonal([]); setBroadcasts([]); setLoading(false); return; }
    setLoading(true);
    dismissed.current = loadDismissed(userId);

    const [personalRes, broadcastRes, readsRes] = await Promise.all([
      supabase.from('user_notifications').select('*')
        .eq('user_id', userId).order('created_at', { ascending: false }).limit(PAGE_SIZE),
      supabase.from('admin_broadcasts').select('*')
        .order('created_at', { ascending: false }).limit(PAGE_SIZE),
      supabase.from('broadcast_reads').select('broadcast_id, read_at').eq('user_id', userId),
    ]);

    if (!personalRes.error && personalRes.data) setPersonal(personalRes.data.map(fromPersonal));

    if (!broadcastRes.error && broadcastRes.data) {
      const readMap = new Map((readsRes.data || []).map(r => [r.broadcast_id, r.read_at]));
      const list = broadcastRes.data
        .filter(b => matchesRole(b.target) && !dismissed.current.has(b.id))
        .map(b => fromBroadcast(b, readMap.get(b.id)));
      setBroadcasts(list);
    }

    setLoading(false);
  }, [userId, matchesRole]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!userId) return;
    let channel;
    try {
      channel = supabase
        .channel(`user_notifications:${userId}:${instanceId.current}`)
        .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'user_notifications', filter: `user_id=eq.${userId}` },
        (payload) => {
          setPersonal(prev => [fromPersonal(payload.new), ...prev].slice(0, PAGE_SIZE));
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'user_notifications', filter: `user_id=eq.${userId}` },
        (payload) => {
          setPersonal(prev => prev.map(n => (n.id === payload.new.id ? fromPersonal(payload.new) : n)));
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'user_notifications' },
        (payload) => {
          const deletedId = payload.old?.id;
          if (!deletedId) return;
          setPersonal(prev => prev.filter(n => n.id !== deletedId));
        }
      )
      // No server-side filter on target here — postgres_changes filters only
      // support simple equality, and target can be 'all' OR the user's role.
      // The table is small/low-frequency (admin sends), so filtering the
      // small payload client-side is cheap.
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'admin_broadcasts' },
        (payload) => {
          const b = payload.new;
          if (!matchesRole(b.target) || dismissed.current.has(b.id)) return;
          setBroadcasts(prev => [fromBroadcast(b, null), ...prev].slice(0, PAGE_SIZE));
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'admin_broadcasts' },
        (payload) => {
          const deletedId = payload.old?.id;
          if (!deletedId) return;
          setBroadcasts(prev => prev.filter(b => b.id !== deletedId));
        }
      )
      .subscribe();
    } catch (e) {
      // Realtime is a nice-to-have: never let it take the page down.
      console.warn('notifications realtime unavailable:', e?.message || e);
    }

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [userId, matchesRole]);

  const markAsRead = useCallback(async (notification) => {
    if (notification.source === 'broadcast') {
      setBroadcasts(prev => prev.map(b => (b.id === notification.id ? { ...b, read_at: b.read_at || new Date().toISOString() } : b)));
      const { error } = await supabase.rpc('mark_broadcast_read', { p_broadcast_id: notification.id });
      if (error) console.warn('markAsRead(broadcast) failed:', error.message);
      return;
    }
    setPersonal(prev => prev.map(n => (n.id === notification.id ? { ...n, read_at: n.read_at || new Date().toISOString() } : n)));
    const { error } = await supabase
      .from('user_notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', notification.id)
      .is('read_at', null);
    if (error) console.warn('markAsRead failed:', error.message);
  }, []);

  const markAllAsRead = useCallback(async () => {
    const now = new Date().toISOString();
    setPersonal(prev => prev.map(n => ({ ...n, read_at: n.read_at || now })));
    setBroadcasts(prev => prev.map(b => ({ ...b, read_at: b.read_at || now })));

    const { error } = await supabase.rpc('mark_all_notifications_read');
    if (error) console.warn('markAllAsRead failed:', error.message);

    const unreadBroadcastIds = broadcasts.filter(b => !b.read_at).map(b => b.id);
    if (userId && unreadBroadcastIds.length) {
      const rows = unreadBroadcastIds.map(broadcast_id => ({ broadcast_id, user_id: userId }));
      const { error: bErr } = await supabase
        .from('broadcast_reads')
        .upsert(rows, { onConflict: 'broadcast_id,user_id', ignoreDuplicates: true });
      if (bErr) console.warn('markAllAsRead(broadcasts) failed:', bErr.message);
    }
  }, [userId, broadcasts]);

  // Removes a notification from view. Personal notifications are truly
  // deleted server-side. Broadcasts are shared rows other users still need
  // to see, so "delete" here means: mark read + remember locally that this
  // user dismissed it, so it won't resurface for THEM on reload.
  const deleteNotification = useCallback(async (notification) => {
    if (notification.source === 'broadcast') {
      dismissed.current.add(notification.id);
      if (userId) saveDismissed(userId, dismissed.current);
      setBroadcasts(prev => prev.filter(b => b.id !== notification.id));
      if (!notification.read_at) {
        const { error } = await supabase.rpc('mark_broadcast_read', { p_broadcast_id: notification.id });
        if (error) console.warn('dismiss(broadcast) failed:', error.message);
      }
      return;
    }

    let snapshot;
    setPersonal(prev => { snapshot = prev; return prev.filter(n => n.id !== notification.id); });
    const { error } = await supabase
      .from('user_notifications')
      .delete()
      .eq('id', notification.id);
    if (error) {
      console.warn('deleteNotification failed:', error.message);
      if (snapshot) setPersonal(snapshot);
    }
  }, [userId]);

  // Clears everything currently in view: deletes personal notifications,
  // dismisses every loaded broadcast (see deleteNotification above).
  const clearAll = useCallback(async () => {
    if (!userId) return;
    let snapshot;
    setPersonal(prev => { snapshot = prev; return []; });
    const broadcastIds = broadcasts.map(b => b.id);
    if (broadcastIds.length) {
      broadcastIds.forEach(id => dismissed.current.add(id));
      saveDismissed(userId, dismissed.current);
      setBroadcasts([]);
    }

    const { error } = await supabase
      .from('user_notifications')
      .delete()
      .eq('user_id', userId);
    if (error) {
      console.warn('clearAll failed:', error.message);
      if (snapshot) setPersonal(snapshot);
    }

    const unread = broadcasts.filter(b => !b.read_at).map(b => ({ broadcast_id: b.id, user_id: userId }));
    if (unread.length) {
      const { error: bErr } = await supabase
        .from('broadcast_reads')
        .upsert(unread, { onConflict: 'broadcast_id,user_id', ignoreDuplicates: true });
      if (bErr) console.warn('clearAll(broadcasts) failed:', bErr.message);
    }
  }, [userId, broadcasts]);

  const notifications = [...personal, ...broadcasts].sort(
    (a, b) => new Date(b.created_at) - new Date(a.created_at)
  );
  const unreadCount = notifications.filter(n => !n.read_at).length;

  return { notifications, unreadCount, loading, markAsRead, markAllAsRead, deleteNotification, clearAll, refresh: load };
}