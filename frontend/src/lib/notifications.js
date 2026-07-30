// lib/notifications.js
//
// In-app notifications. Runs alongside the existing email system (see
// auth.js / api.js / api/confirm-payment.js) — it does not replace it.
//
// notifyUser() is called at the exact same moments the app already sends
// an email (e.g. property approved, rent released), so the same event
// produces both an email AND a bell notification.
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

const PAGE_SIZE = 30;

// Live list + unread count for the current user. Subscribes to Realtime so
// the bell updates immediately when a new notification is inserted, without
// a page refresh or polling.
export function useNotifications(userId) {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  // Every hook instance (bell + notifications page can be mounted at the same
  // time, and StrictMode mounts effects twice) needs its OWN channel topic.
  // Re-using one topic makes supabase-js hand back an already-subscribed
  // channel, and calling .on('postgres_changes') on it throws
  // "cannot add postgres_changes callbacks ... after subscribe()", which
  // crashed the notifications page to a blank screen.
  const instanceId = useRef(Math.random().toString(36).slice(2));

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
    let channel;
    try {
      channel = supabase
        .channel(`user_notifications:${userId}:${instanceId.current}`)
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
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'user_notifications' },
        (payload) => {
          const deletedId = payload.old?.id;
          if (!deletedId) return;
          setNotifications(prev => {
            const removed = prev.find(n => n.id === deletedId);
            if (removed && !removed.read_at) setUnreadCount(c => Math.max(0, c - 1));
            return prev.filter(n => n.id !== deletedId);
          });
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

  // Delete a single notification. Optimistic: the row disappears instantly,
  // and is restored if the delete fails server-side.
  const deleteNotification = useCallback(async (notificationId) => {
    let snapshot;
    setNotifications(prev => {
      snapshot = prev;
      const removed = prev.find(n => n.id === notificationId);
      if (removed && !removed.read_at) setUnreadCount(c => Math.max(0, c - 1));
      return prev.filter(n => n.id !== notificationId);
    });
    const { error } = await supabase
      .from('user_notifications')
      .delete()
      .eq('id', notificationId);
    if (error) {
      console.warn('deleteNotification failed:', error.message);
      if (snapshot) {
        setNotifications(snapshot);
        setUnreadCount(snapshot.filter(n => !n.read_at).length);
      }
    }
  }, []);

  // Delete every notification for the current user.
  const clearAll = useCallback(async () => {
    if (!userId) return;
    let snapshot;
    setNotifications(prev => { snapshot = prev; return []; });
    setUnreadCount(0);
    const { error } = await supabase
      .from('user_notifications')
      .delete()
      .eq('user_id', userId);
    if (error) {
      console.warn('clearAll failed:', error.message);
      if (snapshot) {
        setNotifications(snapshot);
        setUnreadCount(snapshot.filter(n => !n.read_at).length);
      }
    }
  }, [userId]);

  return { notifications, unreadCount, loading, markAsRead, markAllAsRead, deleteNotification, clearAll, refresh: load };
}
