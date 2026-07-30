// lib/notifications.js
//
// In-app notifications. Runs alongside the existing email system (see
// auth.js / api.js / api/confirm-payment.js) — it does not replace it.
//
// notifyUser() is called at the exact same moments the app already sends
// an email (e.g. property approved, rent released), so the same event
// produces both an email AND a bell notification.
import { useState, useEffect, useCallback } from 'react';
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

const PAGE_SIZE = 30;

// Live list + unread count for the current user. Subscribes to Realtime so
// the bell updates immediately when a new notification is inserted, without
// a page refresh or polling.
export function useNotifications(userId) {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!userId) { setNotifications([]); setUnreadCount(0); setLoading(false); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from('user_notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE);
    if (!error && data) {
      setNotifications(data);
      setUnreadCount(data.filter(n => !n.read_at).length);
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`user_notifications:${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'user_notifications', filter: `user_id=eq.${userId}` },
        (payload) => {
          setNotifications(prev => [payload.new, ...prev].slice(0, PAGE_SIZE));
          setUnreadCount(prev => prev + 1);
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'user_notifications', filter: `user_id=eq.${userId}` },
        (payload) => {
          setNotifications(prev => prev.map(n => (n.id === payload.new.id ? payload.new : n)));
          setUnreadCount(prev => Math.max(0, prev - (payload.new.read_at && !payload.old.read_at ? 1 : 0)));
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  const markAsRead = useCallback(async (notificationId) => {
    setNotifications(prev => prev.map(n => (n.id === notificationId ? { ...n, read_at: n.read_at || new Date().toISOString() } : n)));
    setUnreadCount(prev => Math.max(0, prev - 1));
    const { error } = await supabase
      .from('user_notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', notificationId)
      .is('read_at', null);
    if (error) console.warn('markAsRead failed:', error.message);
  }, []);

  const markAllAsRead = useCallback(async () => {
    setNotifications(prev => prev.map(n => ({ ...n, read_at: n.read_at || new Date().toISOString() })));
    setUnreadCount(0);
    const { error } = await supabase.rpc('mark_all_notifications_read');
    if (error) console.warn('markAllAsRead failed:', error.message);
  }, []);

  return { notifications, unreadCount, loading, markAsRead, markAllAsRead, refresh: load };
}
