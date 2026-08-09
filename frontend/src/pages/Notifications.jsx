import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, BellRing, CheckCheck, Trash2 } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { useNotifications } from '../lib/notifications';
import { isPushSupported, isPushEnabledOnThisDevice, enablePush, disablePush } from '../lib/push';

function timeAgo(dateString) {
  const seconds = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateString).toLocaleDateString();
}

// Enable/disable toggle for real push notifications on this device.
// Separate from the always-on in-app bell — this is the "even with the
// app closed" layer, opt-in only. See lib/push.js.
function PushToggle({ userId }) {
  const [supported, setSupported] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const ok = isPushSupported();
    setSupported(ok);
    if (ok) setEnabled(await isPushEnabledOnThisDevice());
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  if (!supported) return null;

  const toggle = async () => {
    setBusy(true);
    try {
      if (enabled) {
        await disablePush();
        setEnabled(false);
      } else {
        const ok = await enablePush(userId);
        setEnabled(ok);
        if (!ok && Notification.permission === 'denied') {
          alert("Notifications are blocked for Rentora in your browser settings. You'll need to allow them there to turn this on.");
        }
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      onClick={toggle}
      disabled={busy}
      className={`flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-medium hover:bg-white disabled:opacity-60 ${
        enabled ? 'border-primary/20 text-primary' : 'border-black/10 text-muted-foreground'
      }`}
    >
      <BellRing className="h-4 w-4" />
      {enabled ? 'Push on' : 'Turn on push'}
    </button>
  );
}

export default function Notifications() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { notifications, unreadCount, loading, markAsRead, markAllAsRead, deleteNotification, clearAll } =
    useNotifications(user?.id, user?.role);

  const handleClick = (n) => {
    if (!n.read_at) markAsRead(n);
    if (n.link) navigate(n.link);
  };

  return (
    <div className="mx-auto max-w-2xl px-5 py-10 sm:px-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-primary">Notifications</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {unreadCount > 0 ? `${unreadCount} unread` : "You're all caught up"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <PushToggle userId={user?.id} />
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="flex items-center gap-1.5 rounded-full border border-primary/20 px-3.5 py-2 text-xs font-medium text-primary hover:bg-white"
            >
              <CheckCheck className="h-4 w-4" /> Mark all read
            </button>
          )}
          {notifications.length > 0 && (
            <button
              onClick={clearAll}
              className="flex items-center gap-1.5 rounded-full border border-destructive/20 px-3.5 py-2 text-xs font-medium text-destructive hover:bg-white"
            >
              <Trash2 className="h-4 w-4" /> Clear all
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
        </div>
      ) : notifications.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-black/5 bg-white py-16 text-center">
          <Bell className="h-8 w-8 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">Nothing here yet — updates on your listings, payments, and bookings will show up in this list.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-black/5 bg-white">
          {notifications.map((n) => (
            <div
              key={n.id}
              className={`group flex items-start gap-2 border-b border-black/5 px-5 py-4 last:border-0 hover:bg-black/[0.02] ${!n.read_at ? 'bg-primary/[0.04]' : ''}`}
            >
              <button onClick={() => handleClick(n)} className="flex min-w-0 flex-1 flex-col gap-1 text-left">
                <div className="flex items-start justify-between gap-3">
                  <span className="flex items-center gap-1.5 text-sm font-medium text-primary">
                    {n.source === 'broadcast' && (
                      <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">Announcement</span>
                    )}
                    {n.title}
                  </span>
                  {!n.read_at && <span className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-primary" />}
                </div>
                <span className="text-sm leading-6 text-muted-foreground">{n.body}</span>
                <span className="text-xs text-muted-foreground/70">{timeAgo(n.created_at)}</span>
              </button>
              <button
                onClick={() => deleteNotification(n)}
                aria-label="Delete notification"
                className="mt-0.5 flex-shrink-0 rounded-full p-2 text-muted-foreground/60 hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}